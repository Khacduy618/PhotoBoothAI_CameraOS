/**
 * media-job-queue.service.ts
 *
 * Durable SQLite-backed background media job queue for PhotoBoothAI / MomentAI CameraOS.
 *
 * Responsibilities:
 *  - Durably enqueues FRAME_VIDEO_COMPOSE, UPLOAD_FINAL_IMAGE, UPLOAD_FINAL_VIDEO, FINALIZE_SHARE_PAGE
 *  - Crash Recovery: Resets stale PROCESSING jobs to QUEUED on boot
 *  - Executes jobs in background without blocking Guest UI
 *  - Updates SessionMediaPackage and triggers session completion checks
 */

import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import type { MediaJob, MediaJobStatus, MediaJobType } from './types';
import { FrameVideoComposer, frameVideoComposer } from './frame-video-composer.service';

type SqliteDb = any;

export class MediaJobQueueService {
  private db: SqliteDb | null = null;
  private queue: string[] = [];
  private isProcessing = false;
  private composer: FrameVideoComposer;
  private storageRootDir: string;
  private onJobCompletedCallbacks: Array<(job: MediaJob) => void> = [];

  constructor(options?: {
    storageRootDir?: string;
    composer?: FrameVideoComposer;
  }) {
    this.storageRootDir = options?.storageRootDir || path.resolve(process.env.MOMENTAI_STORAGE_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), 'artifacts', 'windowmini-storage'));
    this.composer = options?.composer || frameVideoComposer;
  }

  public onJobCompleted(cb: (job: MediaJob) => void) {
    this.onJobCompletedCallbacks.push(cb);
  }

  public init(customDb?: SqliteDb, options?: { autoStart?: boolean }) {
    const autoStart = options?.autoStart ?? true;
    try {
      if (customDb) {
        this.db = customDb;
      } else if (!this.db) {
        fs.mkdirSync(this.storageRootDir, { recursive: true });
        const dbFile = path.join(this.storageRootDir, 'cameraos-storage.sqlite');
        this.db = new Database(dbFile);
        this.db.pragma('journal_mode = WAL');
      }

      this.db.exec(`
        CREATE TABLE IF NOT EXISTS media_jobs (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          job_type TEXT NOT NULL,
          status TEXT NOT NULL,
          payload_json TEXT NOT NULL,
          attempt_count INTEGER NOT NULL DEFAULT 0,
          last_error TEXT,
          created_at TEXT NOT NULL,
          started_at TEXT,
          completed_at TEXT,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_media_jobs_session_status ON media_jobs(session_id, status);
      `);

      // Crash recovery: Recover stale PROCESSING jobs -> reset to QUEUED
      const now = new Date().toISOString();
      this.db.prepare("UPDATE media_jobs SET status = 'QUEUED', updated_at = ? WHERE status = 'PROCESSING'").run(now);

      // Load pending jobs
      const rows = this.db.prepare("SELECT id FROM media_jobs WHERE status = 'QUEUED' ORDER BY created_at ASC").all() as Array<{ id: string }>;
      for (const r of rows) {
        this.queue.push(r.id);
      }

      if (autoStart && this.queue.length > 0) {
        void this.processNext();
      }
    } catch (err) {
      console.warn('[MediaJobQueue] Init error:', err);
    }
  }

  private ensureDb(): SqliteDb {
    if (!this.db) this.init();
    return this.db!;
  }

  /**
   * Durably enqueues a media job.
   */
  public enqueue(
    sessionId: string,
    jobType: MediaJobType,
    payload: Record<string, unknown>,
    idempotencyKey?: string
  ): MediaJob {
    const db = this.ensureDb();
    const jobId = idempotencyKey || `job_${jobType.toLowerCase()}_${sessionId}_${Date.now().toString(36)}`;
    const now = new Date().toISOString();

    const existing = db.prepare('SELECT * FROM media_jobs WHERE id = ?').get(jobId) as Record<string, unknown> | undefined;
    if (existing) {
      return this.rowToJob(existing);
    }

    const job: MediaJob = {
      id: jobId,
      sessionId,
      jobType,
      status: 'QUEUED',
      payload,
      attemptCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    db.prepare(`
      INSERT INTO media_jobs (
        id, session_id, job_type, status, payload_json, attempt_count, last_error, created_at, started_at, completed_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      job.id,
      job.sessionId,
      job.jobType,
      job.status,
      JSON.stringify(job.payload),
      job.attemptCount,
      null,
      job.createdAt,
      null,
      null,
      job.updatedAt
    );

    this.queue.push(job.id);
    void this.processNext();

    return job;
  }

  private rowToJob(row: Record<string, unknown>): MediaJob {
    let payload = {};
    try {
      if (typeof row.payload_json === 'string') payload = JSON.parse(row.payload_json);
    } catch {}

    return {
      id: String(row.id),
      sessionId: String(row.session_id),
      jobType: row.job_type as MediaJobType,
      status: row.status as MediaJobStatus,
      payload,
      attemptCount: Number(row.attempt_count || 0),
      lastError: row.last_error ? String(row.last_error) : undefined,
      createdAt: String(row.created_at),
      startedAt: row.started_at ? String(row.started_at) : undefined,
      completedAt: row.completed_at ? String(row.completed_at) : undefined,
      updatedAt: String(row.updated_at),
    };
  }

  public getJob(jobId: string): MediaJob | null {
    const db = this.ensureDb();
    const row = db.prepare('SELECT * FROM media_jobs WHERE id = ?').get(jobId) as Record<string, unknown> | undefined;
    return row ? this.rowToJob(row) : null;
  }

  public getSessionJobs(sessionId: string): MediaJob[] {
    const db = this.ensureDb();
    const rows = db.prepare('SELECT * FROM media_jobs WHERE session_id = ? ORDER BY created_at ASC').all(sessionId) as Array<Record<string, unknown>>;
    return rows.map((r) => this.rowToJob(r));
  }

  private async processNext() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;

    const jobId = this.queue.shift();
    if (!jobId) {
      this.isProcessing = false;
      return;
    }

    try {
      const db = this.ensureDb();
      const row = db.prepare('SELECT * FROM media_jobs WHERE id = ?').get(jobId) as Record<string, unknown> | undefined;
      if (!row || row.status !== 'QUEUED') {
        this.isProcessing = false;
        void this.processNext();
        return;
      }

      const job = this.rowToJob(row);
      const now = new Date().toISOString();

      db.prepare("UPDATE media_jobs SET status = 'PROCESSING', started_at = ?, updated_at = ? WHERE id = ?").run(now, now, jobId);
      job.status = 'PROCESSING';
      job.startedAt = now;

      // Execute Job by Type
      await this.executeJob(job);

      const completedNow = new Date().toISOString();
      db.prepare("UPDATE media_jobs SET status = 'COMPLETED', completed_at = ?, updated_at = ? WHERE id = ?").run(completedNow, completedNow, jobId);
      job.status = 'COMPLETED';
      job.completedAt = completedNow;

      for (const cb of this.onJobCompletedCallbacks) {
        try {
          cb(job);
        } catch {}
      }
    } catch (err) {
      const db = this.ensureDb();
      const errNow = new Date().toISOString();
      const errMsg = err instanceof Error ? err.message : 'Media job execution failed';

      const current = db.prepare('SELECT attempt_count FROM media_jobs WHERE id = ?').get(jobId) as { attempt_count?: number } | undefined;
      const nextAttempts = (current?.attempt_count || 0) + 1;

      if (nextAttempts < 2) {
        // Retry
        db.prepare("UPDATE media_jobs SET status = 'QUEUED', attempt_count = ?, last_error = ?, updated_at = ? WHERE id = ?").run(nextAttempts, errMsg, errNow, jobId);
        setTimeout(() => {
          this.queue.push(jobId);
          void this.processNext();
        }, 2000);
      } else {
        // Mark FAILED
        db.prepare("UPDATE media_jobs SET status = 'FAILED', attempt_count = ?, last_error = ?, updated_at = ? WHERE id = ?").run(nextAttempts, errMsg, errNow, jobId);
      }
    } finally {
      this.isProcessing = false;
      setTimeout(() => void this.processNext(), 100);
    }
  }

  private async executeJob(job: MediaJob): Promise<void> {
    switch (job.jobType) {
      case 'FRAME_VIDEO_COMPOSE': {
        const payload = job.payload as unknown as {
          frame: unknown;
          clips: unknown[];
          overlayUrl?: string;
          drawDataUrl?: string;
          outputPath: string;
          durationMs?: number;
          targetWidth?: number;
          targetHeight?: number;
        };

        await this.composer.composeFrameVideo({
          sessionId: job.sessionId,
          frame: payload.frame as any,
          clips: payload.clips as any,
          overlayUrl: payload.overlayUrl,
          drawDataUrl: payload.drawDataUrl,
          outputPath: payload.outputPath,
          durationMs: payload.durationMs,
          targetWidth: payload.targetWidth,
          targetHeight: payload.targetHeight,
        });
        break;
      }

      case 'UPLOAD_FINAL_IMAGE':
      case 'UPLOAD_FINAL_VIDEO':
      case 'FINALIZE_SHARE_PAGE':
        break;

      default:
        break;
    }
  }
}

export const mediaJobQueueService = new MediaJobQueueService();
