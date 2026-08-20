import fs from 'node:fs';
import path from 'node:path';

import type {
  MediaCleanupJob,
  MediaCleanupResult,
  MediaCleanupSessionSnapshot,
  MediaCleanupStatus,
  MediaCleanupSummary,
  MediaRetentionConfig,
} from '@momentai/storage-contract';
import type { Result } from '@momentai/shared-types';

export const DEFAULT_MEDIA_RETENTION_CONFIG: MediaRetentionConfig = {
  enabled: true,
  retentionMinutes: 20,
  cleanupIntervalSeconds: 300,
  mode: 'audit_minimal',
  deferWhilePrintActive: true,
  printCleanupGraceMinutes: 30,
};

export function getEffectiveRetentionMs(config: MediaRetentionConfig = DEFAULT_MEDIA_RETENTION_CONFIG): number {
  if (typeof config.devTtlMs === 'number' && config.devTtlMs > 0) {
    return config.devTtlMs;
  }
  const envDevTtl = process.env.SESSION_CLEANUP_TTL_MS;
  if (envDevTtl && !Number.isNaN(Number(envDevTtl))) {
    const parsed = Number(envDevTtl);
    if (parsed > 0) return parsed;
  }
  const envRetentionMinutes = process.env.SESSION_RETENTION_MINUTES;
  if (envRetentionMinutes && !Number.isNaN(Number(envRetentionMinutes))) {
    const parsed = Number(envRetentionMinutes);
    if (parsed > 0) return parsed * 60 * 1000;
  }
  return (config.retentionMinutes ?? 20) * 60 * 1000;
}

export function isSessionEligibleForCleanup(
  session: MediaCleanupSessionSnapshot,
  config: MediaRetentionConfig = DEFAULT_MEDIA_RETENTION_CONFIG,
  now: Date = new Date()
): { eligible: boolean; status: MediaCleanupStatus; referenceTime?: string; ageMinutes?: number } {
  const normalizedStatus = String(session.status || '').toUpperCase();

  // Rule: ACTIVE sessions are strictly protected
  if (normalizedStatus === 'ACTIVE') {
    return { eligible: false, status: 'skipped_active' };
  }

  // Rule: Upload in progress protection (Section 23)
  const normalizedUpload = String(session.uploadState || '').toUpperCase();
  if (['PENDING', 'UPLOADING', 'RETRYING'].includes(normalizedUpload)) {
    return { eligible: false, status: 'deferred_upload_active' };
  }

  // Rule: Print in progress protection (Section 24)
  const normalizedPrint = String(session.printStatus || '').toUpperCase();
  if (['QUEUED', 'PRINTING', 'RETRYING', 'VALIDATING'].includes(normalizedPrint)) {
    return { eligible: false, status: 'deferred_print_active' };
  }

  // Reference Timestamp: completedAt || lastActivityAt || createdAt
  const referenceTimestamp = session.completedAt || session.lastActivityAt || session.createdAt;
  if (!referenceTimestamp) {
    return { eligible: false, status: 'pending' };
  }

  const refTimeMs = new Date(referenceTimestamp).getTime();
  if (Number.isNaN(refTimeMs)) {
    return { eligible: false, status: 'pending' };
  }

  const ttlMs = getEffectiveRetentionMs(config);
  const elapsedMs = now.getTime() - refTimeMs;
  const ageMinutes = Math.floor(elapsedMs / 60_000);

  if (elapsedMs < ttlMs) {
    return { eligible: false, status: 'pending', referenceTime: referenceTimestamp, ageMinutes };
  }

  return { eligible: true, status: 'eligible', referenceTime: referenceTimestamp, ageMinutes };
}

export function isSafeSessionPath(targetPath: string, rootDir: string): boolean {
  if (!targetPath || typeof targetPath !== 'string') return false;
  const cleanTarget = targetPath.trim();
  if (cleanTarget === '' || cleanTarget === '/' || cleanTarget === '\\') return false;

  const resolvedRoot = path.resolve(rootDir);
  const resolvedSessionsRoot = path.resolve(path.join(resolvedRoot, 'sessions'));
  const resolvedPath = path.resolve(cleanTarget);

  if (resolvedPath === resolvedRoot || resolvedPath === resolvedSessionsRoot) return false;
  if (!resolvedPath.startsWith(resolvedSessionsRoot + path.sep)) return false;

  const relative = path.relative(resolvedSessionsRoot, resolvedPath);
  if (!relative || relative.startsWith('..') || relative.includes('\0')) return false;

  return true;
}

function calculateDirSize(dirPath: string): { bytes: number; count: number } {
  let bytes = 0;
  let count = 0;
  if (!fs.existsSync(dirPath)) return { bytes, count };

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        const sub = calculateDirSize(fullPath);
        bytes += sub.bytes;
        count += sub.count;
      } else if (entry.isFile()) {
        try {
          const stats = fs.statSync(fullPath);
          bytes += stats.size;
          count += 1;
        } catch {
          // ignore unreadable file
        }
      }
    }
  } catch {
    // ignore dir error
  }
  return { bytes, count };
}

export class WindowMiniMediaRetentionService {
  private readonly jobs = new Map<string, MediaCleanupJob>();
  private lastRunAt: string | undefined;
  private totalBytesFreed = 0;
  private schedulerTimer: NodeJS.Timeout | null = null;

  constructor(private readonly config: MediaRetentionConfig = DEFAULT_MEDIA_RETENTION_CONFIG) {}

  getConfig(): MediaRetentionConfig {
    return { ...this.config };
  }

  getSummary(): MediaCleanupSummary {
    const jobs = [...this.jobs.values()];
    return {
      config: this.config,
      pending: jobs.filter((job) => job.status === 'pending').length,
      eligible: jobs.filter((job) => job.status === 'eligible').length,
      deleted: jobs.filter((job) => job.status === 'deleted').length,
      failed: jobs.filter((job) => job.status === 'failed').length,
      skippedActive: jobs.filter((job) => job.status === 'skipped_active').length,
      deferredPrint: jobs.filter((job) => job.status === 'deferred_print_active').length,
      deferredUpload: jobs.filter((job) => job.status === 'deferred_upload_active').length,
      bytesFreed: this.totalBytesFreed,
      lastRunAt: this.lastRunAt,
    };
  }

  scheduleSession(session: MediaCleanupSessionSnapshot, now = new Date()): Result<MediaCleanupJob | null> {
    if (!this.config.enabled) return { ok: true, value: null };

    const check = isSessionEligibleForCleanup(session, this.config, now);
    const existing = this.jobs.get(session.sessionId);

    const refTime = session.completedAt || session.lastActivityAt || session.createdAt || now.toISOString();
    const ttlMs = getEffectiveRetentionMs(this.config);
    const retentionUntil = session.mediaRetentionUntil ?? new Date(new Date(refTime).getTime() + ttlMs).toISOString();

    const nowIso = now.toISOString();
    const job: MediaCleanupJob = {
      jobId: existing?.jobId ?? `cleanup_${session.sessionId}`,
      sessionId: session.sessionId,
      retentionUntil,
      status: check.eligible ? 'eligible' : check.status,
      attempts: existing?.attempts ?? 0,
      createdAt: existing?.createdAt ?? nowIso,
      updatedAt: nowIso,
    };

    this.jobs.set(session.sessionId, job);
    return { ok: true, value: job };
  }

  runEligibleCleanup(
    sessions: readonly MediaCleanupSessionSnapshot[],
    options: {
      now?: Date;
      storageRootDir?: string;
      onDeleteSessionDisk?: (sessionId: string, sessionPath: string) => void;
      onDeleteSessionDb?: (sessionId: string) => void;
    } = {}
  ): Result<MediaCleanupResult[]> {
    const now = options.now ?? new Date();
    this.lastRunAt = now.toISOString();
    const results: MediaCleanupResult[] = [];
    const rootDir = path.resolve(options.storageRootDir || process.env.MOMENTAI_STORAGE_DIR || path.join(process.cwd(), 'artifacts', 'windowmini-storage'));

    // Step 1: Scan and recover stale ACTIVE sessions (Section 28)
    const recoveredSessions = this.recoverStaleActiveSessions(sessions, now);

    for (const session of recoveredSessions) {
      if (!session || !session.sessionId) {
        console.warn('[SessionCleanup] Corrupt/missing session snapshot encountered. Skipping safely.');
        continue;
      }

      const scheduled = this.scheduleSession(session, now);
      if (!scheduled.ok) continue;

      const job = scheduled.value ?? this.jobs.get(session.sessionId);
      if (!job || job.status === 'deleted') continue;

      const check = isSessionEligibleForCleanup(session, this.config, now);
      if (!check.eligible) {
        const updatedJob: MediaCleanupJob = { ...job, status: check.status, updatedAt: now.toISOString() };
        this.jobs.set(session.sessionId, updatedJob);
        continue;
      }

      // Session is eligible for deletion!
      const defaultPath = path.join(rootDir, 'sessions', session.sessionId);
      const targetPath = session.sessionPath || defaultPath;
      let deletedFiles: string[] = [];
      let bytesFreed = 0;
      let deletionSuccess = true;
      let errMessage: string | undefined;

      if (isSafeSessionPath(targetPath, rootDir)) {
        if (fs.existsSync(targetPath)) {
          const stats = calculateDirSize(targetPath);
          bytesFreed = stats.bytes;
          try {
            fs.rmSync(targetPath, { recursive: true, force: true });
            deletedFiles = [`sessions/${session.sessionId}`];
            if (options.onDeleteSessionDisk) {
              options.onDeleteSessionDisk(session.sessionId, targetPath);
            }
          } catch (err) {
            deletionSuccess = false;
            errMessage = err instanceof Error ? err.message : 'Directory removal failed.';
          }
        } else {
          deletedFiles = [`sessions/${session.sessionId}`];
        }
      } else {
        deletionSuccess = false;
        errMessage = `Unsafe session deletion path rejected: ${targetPath}`;
        console.warn(`[SessionCleanup] ${errMessage}`);
      }

      if (deletionSuccess && options.onDeleteSessionDb) {
        try {
          options.onDeleteSessionDb(session.sessionId);
        } catch (dbErr) {
          console.warn(`[SessionCleanup] SQLite record deletion warning for ${session.sessionId}:`, dbErr);
        }
      }

      const finalStatus: MediaCleanupStatus = deletionSuccess ? 'deleted' : 'failed';
      const updatedJob: MediaCleanupJob = {
        ...job,
        status: finalStatus,
        attempts: job.attempts + 1,
        lastError: errMessage,
        updatedAt: now.toISOString(),
      };

      this.jobs.set(session.sessionId, updatedJob);
      this.totalBytesFreed += bytesFreed;

      const ageMinutes = check.ageMinutes ?? 0;
      console.log(
        `[SessionCleanup] sessionId=${session.sessionId} status=${session.status} createdAt=${session.createdAt || 'N/A'} lastActivityAt=${session.lastActivityAt || 'N/A'} completedAt=${session.completedAt || 'N/A'} ageMinutes=${ageMinutes} sessionPath=${targetPath} filesDeleted=${deletedFiles.length} bytesFreed=${bytesFreed} cleanupReason=${check.status} success=${deletionSuccess}`
      );

      results.push({
        job: updatedJob,
        sessionId: session.sessionId,
        deletedFiles,
        bytesFreed,
        redactedRows: this.config.mode === 'audit_minimal' ? 2 : 0,
        success: deletionSuccess,
        error: errMessage,
      });
    }

    return { ok: true, value: results };
  }

  private recoverStaleActiveSessions(sessions: readonly MediaCleanupSessionSnapshot[], now: Date): MediaCleanupSessionSnapshot[] {
    const ttlMs = getEffectiveRetentionMs(this.config);

    return sessions.map((session) => {
      if (!session || !session.sessionId) return session;
      const normalizedStatus = String(session.status || '').toUpperCase();

      if (normalizedStatus === 'ACTIVE') {
        const refTime = session.lastActivityAt || session.createdAt;
        if (refTime) {
          const elapsed = now.getTime() - new Date(refTime).getTime();
          if (!Number.isNaN(elapsed) && elapsed >= ttlMs) {
            // Orphaned active session past TTL -> mark ABORTED for cleanup!
            return {
              ...session,
              status: 'ABORTED',
            };
          }
        }
      }
      return session;
    });
  }

  startPeriodicCleanupScheduler(
    scanSessionsFn: () => MediaCleanupSessionSnapshot[],
    storageRootDir?: string
  ): void {
    if (this.schedulerTimer) return; // Single instance worker requirement (Section 26)

    const intervalMs = (this.config.cleanupIntervalSeconds || 300) * 1000;
    const runWorker = () => {
      try {
        const sessions = scanSessionsFn();
        this.runEligibleCleanup(sessions, { storageRootDir });
      } catch (err) {
        console.warn('[SessionCleanupWorker] Exception during scheduled cleanup cycle:', err);
      }
    };

    // Run once on startup
    runWorker();

    // Schedule interval every 5 minutes
    this.schedulerTimer = setInterval(runWorker, intervalMs);
    if (this.schedulerTimer.unref) {
      this.schedulerTimer.unref();
    }
  }

  stopPeriodicCleanupScheduler(): void {
    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
  }
}

export const windowMiniMediaRetentionService = new WindowMiniMediaRetentionService();
