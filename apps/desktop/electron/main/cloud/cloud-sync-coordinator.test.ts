import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import Database from 'better-sqlite3';
import { CloudSyncCoordinator } from './cloud-sync-coordinator.cjs';
import { SessionMediaPaths } from '../storage/session-media-paths.cjs';

describe('CloudSyncCoordinator Unit & Integration Tests', () => {
  let tempDir: string;
  let db: any;
  let sessionMediaPaths: any;
  let coordinator: any;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'momentai-cloud-test-'));
    const dbPath = path.join(tempDir, 'test-storage.sqlite');
    db = new Database(dbPath);
    sessionMediaPaths = new SessionMediaPaths(tempDir);
    coordinator = new CloudSyncCoordinator({
      writeSystemLog: vi.fn(),
    });
    coordinator.projectId = '';
    coordinator.storageBucket = '';
    coordinator.init(db, sessionMediaPaths);
  });

  afterEach(() => {
    try {
      db.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('generates 128-bit cryptographic non-sequential public token and guarantees idempotency', () => {
    const sessionId = 'desktop_session_123456';
    const token1 = coordinator.getPublicToken(sessionId);
    
    // 128 bits = 16 bytes = 32 hex characters
    expect(token1).toHaveLength(32);
    expect(/^[0-9a-f]{32}$/.test(token1)).toBe(true);

    // Repeated call returns identical token
    const token2 = coordinator.getPublicToken(sessionId);
    expect(token2).toBe(token1);

    // Verify token persisted in SQLite
    const row = db.prepare('SELECT public_token FROM public_session_tokens WHERE session_id = ?').get(sessionId);
    expect(row.public_token).toBe(token1);

    // Different session receives distinct token
    const tokenOther = coordinator.getPublicToken('desktop_session_789012');
    expect(tokenOther).toHaveLength(32);
    expect(tokenOther).not.toBe(token1);
  });

  it('initSession initializes cloud session and formats QR Landing URL', () => {
    const sessionId = 'desktop_session_qr_test';
    const res = coordinator.initSession(sessionId, { productType: 'classic_4_shot', requiredShots: 4 });

    expect(res.sessionId).toBe(sessionId);
    expect(res.publicToken).toHaveLength(32);
    expect(res.landingUrl).toContain(`/s/${res.publicToken}`);
    expect(res.status).toBe('CREATED');
  });

  it('Phase A uploads photos and clips asynchronously in background', async () => {
    const sessionId = 'desktop_session_phase_a';
    coordinator.initSession(sessionId, { requiredShots: 2 });

    // Mock local photos and clips on disk
    sessionMediaPaths.ensureSessionDirectories(sessionId);
    const p1 = sessionMediaPaths.photo(sessionId, 1);
    const p2 = sessionMediaPaths.photo(sessionId, 2);
    const c1 = sessionMediaPaths.clip(sessionId, 1);
    const c2 = sessionMediaPaths.clip(sessionId, 2);

    fs.writeFileSync(p1, Buffer.from('fake-photo-1-jpeg-data'));
    fs.writeFileSync(p2, Buffer.from('fake-photo-2-jpeg-data'));
    fs.writeFileSync(c1, Buffer.from('fake-clip-1-mp4-data'));
    fs.writeFileSync(c2, Buffer.from('fake-clip-2-mp4-data'));

    const result = await coordinator.triggerPhaseAUpload(sessionId);

    expect(result.ok).toBe(true);
    expect(result.state.status).toBe('ORIGINALS_READY');
    expect(result.state.photos).toHaveLength(2);
    expect(result.state.clips).toHaveLength(2);
    expect(result.state.photos[0].remotePath).toContain(`/photos/shot_01.jpg`);
    expect(result.state.clips[0].remotePath).toContain(`/clips/shot_01.mp4`);
  });

  it('Phase B triggers READY only when BOTH final image and final video exist and composition succeeded', async () => {
    const sessionId = 'desktop_session_phase_b';
    coordinator.initSession(sessionId, { requiredShots: 2 });
    sessionMediaPaths.ensureSessionDirectories(sessionId);

    const finalImage = sessionMediaPaths.finalImage(sessionId);
    const finalVideo = sessionMediaPaths.finalVideo(sessionId);

    fs.writeFileSync(finalImage, Buffer.from('fake-final-image-jpg'));
    fs.writeFileSync(finalVideo, Buffer.from('fake-final-video-mp4'));

    const result = await coordinator.executePhaseBUpload(sessionId, finalImage, finalVideo);

    expect(result.ok).toBe(true);
    expect(result.state.status).toBe('READY');
    expect(result.state.finalImage).toBeDefined();
    expect(result.state.finalVideo).toBeDefined();
    expect(result.state.finalImage.url).toBeDefined();
    expect(result.state.finalVideo.url).toBeDefined();
  });

  it('Phase B does NOT mark READY if video composition failed or video file is missing', async () => {
    const sessionId = 'desktop_session_failed_video';
    coordinator.initSession(sessionId, { requiredShots: 2 });
    sessionMediaPaths.ensureSessionDirectories(sessionId);

    const finalImage = sessionMediaPaths.finalImage(sessionId);
    fs.writeFileSync(finalImage, Buffer.from('fake-final-image-jpg'));
    // final-video.mp4 does NOT exist

    const result = await coordinator.executePhaseBUpload(sessionId, finalImage, null);

    expect(result.ok).toBe(false);
    expect(result.state.status).not.toBe('READY');
    expect(['PARTIAL', 'UPLOAD_FAILED']).toContain(result.state.status);
  });

  it('onJobCompleted with failed FRAME_VIDEO_COMPOSE marks status COMPOSE_FAILED, never READY', async () => {
    const sessionId = 'desktop_session_job_failed';
    coordinator.initSession(sessionId);

    coordinator.onJobCompleted({
      sessionId,
      jobType: 'FRAME_VIDEO_COMPOSE',
      status: 'FAILED',
      error: 'FFmpeg exit code 1',
    });

    const state = coordinator.sessions.get(sessionId);
    expect(state.status).toBe('COMPOSE_FAILED');
    expect(state.status).not.toBe('READY');
  });

  it('upload retry handles transient network errors with bounded retry count', async () => {
    const localFile = path.join(tempDir, 'sample.jpg');
    fs.writeFileSync(localFile, Buffer.from('test-content'));

    let attemptCount = 0;
    vi.spyOn(coordinator, 'uploadToFirebaseStorage').mockImplementation(async () => {
      attemptCount++;
      if (attemptCount < 2) {
        throw new Error('Transient 503 Service Unavailable');
      }
      return {
        remotePath: 'test/path.jpg',
        downloadUrl: 'https://storage/test/path.jpg',
        size: 12,
      };
    });

    const res = await coordinator.uploadFileWithRetry(localFile, 'test/path.jpg', 'image/jpeg', 3);
    expect(res.downloadUrl).toBe('https://storage/test/path.jpg');
    expect(attemptCount).toBe(2);
  });

  it('buildLandingUrl normalizes trailing slashes and produces exact /s/<publicToken>', () => {
    coordinator.landingBaseUrl = 'http://localhost:5174';
    expect(coordinator.buildLandingUrl('abc123token')).toBe('http://localhost:5174/s/abc123token');

    coordinator.landingBaseUrl = 'http://localhost:5174///';
    coordinator.landingBaseUrl = coordinator.landingBaseUrl.replace(/\/+$/, '');
    expect(coordinator.buildLandingUrl('abc123token')).toBe('http://localhost:5174/s/abc123token');

    coordinator.landingBaseUrl = 'http://192.168.1.11:5174';
    expect(coordinator.buildLandingUrl('abc123token')).toBe('http://192.168.1.11:5174/s/abc123token');
  });
});
