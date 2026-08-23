import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { MediaCleanupSessionSnapshot } from '@momentai/storage-contract';

import {
  DEFAULT_MEDIA_RETENTION_CONFIG,
  getEffectiveRetentionMs,
  isSafeSessionPath,
  isSessionEligibleForCleanup,
  WindowMiniMediaRetentionService,
} from './media-retention.service';

const TEST_STORAGE_DIR = path.join(process.cwd(), 'artifacts', 'test-media-retention-storage');

describe('WindowMiniMediaRetentionService — 20-Minute Session Cleanup Specification', () => {
  beforeEach(() => {
    delete process.env.SESSION_CLEANUP_TTL_MS;
    fs.mkdirSync(path.join(TEST_STORAGE_DIR, 'sessions'), { recursive: true });
  });

  afterEach(() => {
    delete process.env.SESSION_CLEANUP_TTL_MS;
    if (fs.existsSync(TEST_STORAGE_DIR)) {
      try {
        fs.rmSync(TEST_STORAGE_DIR, { recursive: true, force: true });
      } catch {}
    }
  });

  // Test A: ACTIVE session, age = 30 minutes -> NOT DELETED
  it('Test A: ACTIVE session age 30 minutes with active user interaction is NOT DELETED', () => {
    const service = new WindowMiniMediaRetentionService();
    const now = new Date('2026-08-18T12:30:00.000Z');
    const result = service.runEligibleCleanup(
      [
        {
          sessionId: 'session_active_30m',
          status: 'ACTIVE',
          createdAt: '2026-08-18T12:00:00.000Z',
          lastActivityAt: '2026-08-18T12:25:00.000Z',
        },
      ],
      { now, storageRootDir: TEST_STORAGE_DIR }
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(0);
    }
    expect(service.getSummary().skippedActive).toBe(1);
  });

  // Test B: COMPLETED session, completed 19 minutes ago -> NOT DELETED
  it('Test B: COMPLETED session completed 19 minutes ago is NOT DELETED', () => {
    const service = new WindowMiniMediaRetentionService();
    const now = new Date('2026-08-18T12:19:00.000Z');
    const result = service.runEligibleCleanup(
      [
        {
          sessionId: 'session_completed_19m',
          status: 'COMPLETED',
          createdAt: '2026-08-18T12:00:00.000Z',
          lastActivityAt: '2026-08-18T12:00:00.000Z',
          completedAt: '2026-08-18T12:00:00.000Z',
        },
      ],
      { now, storageRootDir: TEST_STORAGE_DIR }
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(0);
    }
    expect(service.getSummary().pending).toBe(1);
  });

  // Test C: COMPLETED session, completed 21 minutes ago -> DELETED
  it('Test C: COMPLETED session completed 21 minutes ago is DELETED', () => {
    const sessionDir = path.join(TEST_STORAGE_DIR, 'sessions', 'session_completed_21m');
    fs.mkdirSync(sessionDir, { recursive: true });
    fs.writeFileSync(path.join(sessionDir, 'sample_photo.jpg'), 'dummy_photo_data');

    const service = new WindowMiniMediaRetentionService();
    const now = new Date('2026-08-18T12:21:00.000Z');
    let dbDeletedSessionId = '';

    const result = service.runEligibleCleanup(
      [
        {
          sessionId: 'session_completed_21m',
          status: 'COMPLETED',
          createdAt: '2026-08-18T12:00:00.000Z',
          completedAt: '2026-08-18T12:00:00.000Z',
          sessionPath: sessionDir,
        },
      ],
      {
        now,
        storageRootDir: TEST_STORAGE_DIR,
        onDeleteSessionDb: (sessionId) => {
          dbDeletedSessionId = sessionId;
        },
      }
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0].success).toBe(true);
      expect(result.value[0].job.status).toBe('deleted');
    }
    expect(fs.existsSync(sessionDir)).toBe(false);
    expect(dbDeletedSessionId).toBe('session_completed_21m');
  });

  // Test D: ABORTED session, lastActivity 21 minutes ago -> DELETED
  it('Test D: ABORTED session lastActivity 21 minutes ago is DELETED', () => {
    const sessionDir = path.join(TEST_STORAGE_DIR, 'sessions', 'session_aborted_21m');
    fs.mkdirSync(sessionDir, { recursive: true });

    const service = new WindowMiniMediaRetentionService();
    const now = new Date('2026-08-18T12:21:00.000Z');
    const result = service.runEligibleCleanup(
      [
        {
          sessionId: 'session_aborted_21m',
          status: 'ABORTED',
          createdAt: '2026-08-18T12:00:00.000Z',
          lastActivityAt: '2026-08-18T12:00:00.000Z',
          sessionPath: sessionDir,
        },
      ],
      { now, storageRootDir: TEST_STORAGE_DIR }
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0].job.status).toBe('deleted');
    }
    expect(fs.existsSync(sessionDir)).toBe(false);
  });

  // Test E: COMPLETED 30 minutes, uploadState = UPLOADING -> NOT DELETED
  it('Test E: COMPLETED 30 minutes with uploadState UPLOADING is NOT DELETED', () => {
    const service = new WindowMiniMediaRetentionService();
    const now = new Date('2026-08-18T12:30:00.000Z');
    const result = service.runEligibleCleanup(
      [
        {
          sessionId: 'session_uploading_30m',
          status: 'COMPLETED',
          completedAt: '2026-08-18T12:00:00.000Z',
          uploadState: 'UPLOADING',
        },
      ],
      { now, storageRootDir: TEST_STORAGE_DIR }
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(0);
    }
    expect(service.getSummary().deferredUpload).toBe(1);
  });

  // Test F: COMPLETED 30 minutes, printStatus = PRINTING -> NOT DELETED
  it('Test F: COMPLETED 30 minutes with printStatus PRINTING is NOT DELETED', () => {
    const service = new WindowMiniMediaRetentionService();
    const now = new Date('2026-08-18T12:30:00.000Z');
    const result = service.runEligibleCleanup(
      [
        {
          sessionId: 'session_printing_30m',
          status: 'COMPLETED',
          completedAt: '2026-08-18T12:00:00.000Z',
          printStatus: 'PRINTING',
        },
      ],
      { now, storageRootDir: TEST_STORAGE_DIR }
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(0);
    }
    expect(service.getSummary().deferredPrint).toBe(1);
  });

  // Test G: COMPLETED 30 minutes, upload completed, print completed -> DELETED
  it('Test G: COMPLETED 30 minutes with upload COMPLETED and print COMPLETED is DELETED', () => {
    const sessionDir = path.join(TEST_STORAGE_DIR, 'sessions', 'session_ready_cleanup_30m');
    fs.mkdirSync(sessionDir, { recursive: true });

    const service = new WindowMiniMediaRetentionService();
    const now = new Date('2026-08-18T12:30:00.000Z');
    const result = service.runEligibleCleanup(
      [
        {
          sessionId: 'session_ready_cleanup_30m',
          status: 'COMPLETED',
          completedAt: '2026-08-18T12:00:00.000Z',
          uploadState: 'COMPLETED',
          printStatus: 'COMPLETED',
          sessionPath: sessionDir,
        },
      ],
      { now, storageRootDir: TEST_STORAGE_DIR }
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0].job.status).toBe('deleted');
    }
    expect(fs.existsSync(sessionDir)).toBe(false);
  });

  // Test H: App restarted with 1-hour-old completed session -> Startup cleanup deletes it
  it('Test H: App restarted with 1-hour-old completed session is DELETED by startup cleanup', () => {
    const sessionDir = path.join(TEST_STORAGE_DIR, 'sessions', 'session_restart_1h');
    fs.mkdirSync(sessionDir, { recursive: true });

    // Simulate startup scan discovering persisted 1-hour-old session
    const service = new WindowMiniMediaRetentionService();
    const bootTime = new Date('2026-08-18T13:00:00.000Z');
    const result = service.runEligibleCleanup(
      [
        {
          sessionId: 'session_restart_1h',
          status: 'COMPLETED',
          completedAt: '2026-08-18T12:00:00.000Z',
          sessionPath: sessionDir,
        },
      ],
      { now: bootTime, storageRootDir: TEST_STORAGE_DIR }
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0].job.status).toBe('deleted');
    }
    expect(fs.existsSync(sessionDir)).toBe(false);
  });

  // Test I: Corrupt/missing session metadata -> Does not crash, logs warning, applies safe recovery policy
  it('Test I: Corrupt or missing session metadata does not crash and applies safe policy', () => {
    const service = new WindowMiniMediaRetentionService();
    const now = new Date('2026-08-18T12:30:00.000Z');
    const result = service.runEligibleCleanup(
      [
        // @ts-expect-error test corrupt null object
        null,
        { sessionId: '', status: 'COMPLETED' },
        { sessionId: 'corrupt_no_dates', status: 'COMPLETED' },
      ],
      { now, storageRootDir: TEST_STORAGE_DIR }
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(0); // Safely skipped
    }
  });

  // Test J: Path Traversal Safety Verification (Section 30)
  it('Test J: Path Traversal Safety rejects invalid or unsafe session paths', () => {
    expect(isSafeSessionPath('', TEST_STORAGE_DIR)).toBe(false);
    expect(isSafeSessionPath('/', TEST_STORAGE_DIR)).toBe(false);
    expect(isSafeSessionPath(TEST_STORAGE_DIR, TEST_STORAGE_DIR)).toBe(false);
    expect(isSafeSessionPath(path.join(TEST_STORAGE_DIR, 'sessions'), TEST_STORAGE_DIR)).toBe(false);
    expect(isSafeSessionPath(path.join(TEST_STORAGE_DIR, 'sessions', '..'), TEST_STORAGE_DIR)).toBe(false);
    expect(isSafeSessionPath(path.join(TEST_STORAGE_DIR, 'sessions', 'valid_sess_123'), TEST_STORAGE_DIR)).toBe(true);
  });

  // Test K: Dev TTL Override Verification (Section 34)
  it('Test K: Dev TTL Override uses process.env or devTtlMs for fast 60s testing', () => {
    process.env.SESSION_CLEANUP_TTL_MS = '60000'; // 60 seconds
    const effectiveMs = getEffectiveRetentionMs(DEFAULT_MEDIA_RETENTION_CONFIG);
    expect(effectiveMs).toBe(60000);

    const session: MediaCleanupSessionSnapshot = {
      sessionId: 'dev_test_sess',
      status: 'COMPLETED',
      completedAt: '2026-08-18T12:00:00.000Z',
    };

    const check70s = isSessionEligibleForCleanup(session, DEFAULT_MEDIA_RETENTION_CONFIG, new Date('2026-08-18T12:01:10.000Z'));
    expect(check70s.eligible).toBe(true);
  });

  // Test L: COMPLETED 30 minutes, printStatus = REQUIRES_REVIEW -> NOT DELETED (Forensic Safety)
  it('Test L: COMPLETED 30 minutes with printStatus REQUIRES_REVIEW is NOT DELETED', () => {
    const service = new WindowMiniMediaRetentionService();
    const now = new Date('2026-08-18T12:30:00.000Z');
    const result = service.runEligibleCleanup(
      [
        {
          sessionId: 'session_requires_review_30m',
          status: 'COMPLETED',
          completedAt: '2026-08-18T12:00:00.000Z',
          printStatus: 'REQUIRES_REVIEW',
        },
      ],
      { now, storageRootDir: TEST_STORAGE_DIR }
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(0);
    }
    expect(service.getSummary().deferredPrint).toBe(1);
  });
});
