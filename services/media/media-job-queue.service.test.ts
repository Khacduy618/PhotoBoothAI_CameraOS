import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import Database from 'better-sqlite3';
import { MediaJobQueueService } from './media-job-queue.service';

type SqliteDb = any;

describe('MediaJobQueueService', () => {
  let tempDir: string;
  let db: SqliteDb;
  let queue: MediaJobQueueService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'queue-test-'));
    const dbPath = path.join(tempDir, 'test-storage.sqlite');
    db = new Database(dbPath);
    queue = new MediaJobQueueService({ storageRootDir: tempDir });
    queue.init(db);
  });

  afterEach(() => {
    try {
      if (typeof db?.close === 'function') db.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('durably enqueues and retrieves media jobs', () => {
    const job = queue.enqueue('sess_100', 'UPLOAD_FINAL_IMAGE', { test: true });
    expect(job.id).toBeTruthy();
    expect(job.sessionId).toBe('sess_100');
    expect(job.jobType).toBe('UPLOAD_FINAL_IMAGE');

    const fetched = queue.getJob(job.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.sessionId).toBe('sess_100');
  });

  it('performs crash recovery by resetting stale PROCESSING jobs to QUEUED', () => {
    // Insert a fake stale PROCESSING job directly into DB
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO media_jobs (
        id, session_id, job_type, status, payload_json, attempt_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('job_stale_1', 'sess_stale', 'UPLOAD_FINAL_VIDEO', 'PROCESSING', '{}', 0, now, now);

    // Boot a new instance of the queue with autoStart: false to inspect recovery
    const newQueue = new MediaJobQueueService({ storageRootDir: tempDir });
    newQueue.init(db, { autoStart: false });

    const recovered = newQueue.getJob('job_stale_1');
    expect(recovered?.status).toBe('QUEUED');
  });
});
