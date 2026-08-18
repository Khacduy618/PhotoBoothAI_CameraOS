import type {
  MediaCleanupJob,
  MediaCleanupResult,
  MediaCleanupSessionSnapshot,
  MediaCleanupSummary,
  MediaRetentionConfig,
} from '@momentai/storage-contract';
import type { Result } from '@momentai/shared-types';

export const DEFAULT_MEDIA_RETENTION_CONFIG: MediaRetentionConfig = {
  enabled: true,
  retentionMinutes: 10,
  cleanupIntervalSeconds: 60,
  mode: 'audit_minimal',
  deferWhilePrintActive: true,
  printCleanupGraceMinutes: 30,
};

export class WindowMiniMediaRetentionService {
  private readonly jobs = new Map<string, MediaCleanupJob>();
  private lastRunAt: string | undefined;

  constructor(private readonly config: MediaRetentionConfig = DEFAULT_MEDIA_RETENTION_CONFIG) {}

  scheduleSession(session: MediaCleanupSessionSnapshot): Result<MediaCleanupJob | null> {
    if (!this.config.enabled) return { ok: true, value: null };
    if (!session.completedAt) return { ok: true, value: null };
    if (session.status === 'active') return { ok: true, value: null };

    const retentionUntil = session.mediaRetentionUntil ?? new Date(new Date(session.completedAt).getTime() + this.config.retentionMinutes * 60_000).toISOString();
    const existing = this.jobs.get(session.sessionId);
    if (existing) return { ok: true, value: existing };

    const now = new Date().toISOString();
    const job: MediaCleanupJob = {
      jobId: `cleanup_${session.sessionId}`,
      sessionId: session.sessionId,
      retentionUntil,
      status: 'pending',
      attempts: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.jobs.set(session.sessionId, job);
    return { ok: true, value: job };
  }

  getSummary(): MediaCleanupSummary {
    const jobs = [...this.jobs.values()];
    return {
      config: this.config,
      pending: jobs.filter((job) => job.status === 'pending').length,
      eligible: jobs.filter((job) => job.status === 'eligible').length,
      deleted: jobs.filter((job) => job.status === 'deleted').length,
      failed: jobs.filter((job) => job.status === 'failed').length,
      lastRunAt: this.lastRunAt,
    };
  }

  runEligibleCleanup(sessions: readonly MediaCleanupSessionSnapshot[], now = new Date()): Result<MediaCleanupResult[]> {
    this.lastRunAt = now.toISOString();
    const results: MediaCleanupResult[] = [];

    for (const session of sessions) {
      const scheduled = this.scheduleSession(session);
      if (!scheduled.ok) continue;
      const job = scheduled.value ?? this.jobs.get(session.sessionId);
      if (!job || job.status === 'deleted') continue;

      const nextJob = this.evaluateJob(job, session, now);
      this.jobs.set(session.sessionId, nextJob);
      if (nextJob.status === 'deleted') {
        results.push({ job: nextJob, deletedFiles: [`sessions/${session.sessionId}/originals`, `sessions/${session.sessionId}/output`], redactedRows: this.config.mode === 'audit_minimal' ? 2 : 0 });
      }
    }

    return { ok: true, value: results };
  }

  private evaluateJob(job: MediaCleanupJob, session: MediaCleanupSessionSnapshot, now: Date): MediaCleanupJob {
    const updatedAt = now.toISOString();
    if (session.status === 'active') return { ...job, status: 'skipped_active', updatedAt };
    if (session.mediaDeletedAt) return { ...job, status: 'deleted', updatedAt };

    const retentionAt = new Date(job.retentionUntil).getTime();
    if (Number.isNaN(retentionAt) || retentionAt > now.getTime()) {
      return { ...job, status: 'pending', updatedAt };
    }

    if (this.config.deferWhilePrintActive && (session.printStatus === 'queued' || session.printStatus === 'validating' || session.printStatus === 'printing')) {
      const completedAt = session.completedAt ? new Date(session.completedAt).getTime() : now.getTime();
      const printGraceUntil = completedAt + this.config.printCleanupGraceMinutes * 60_000;
      if (printGraceUntil > now.getTime()) return { ...job, status: 'deferred_print_active', updatedAt };
    }

    return { ...job, status: 'deleted', attempts: job.attempts + 1, updatedAt };
  }
}

export const windowMiniMediaRetentionService = new WindowMiniMediaRetentionService();
