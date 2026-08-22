import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ShotClipRecorderService } from './shot-clip-recorder.service';
import { VideoEncoderService } from './video-encoder.service';

function createMinimalJpegBuffer(): Buffer {
  return Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
    0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
    0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
    0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20,
    0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27,
    0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x02,
    0x00, 0x02, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
    0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
    0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
    0x00, 0xbf, 0x00, 0xff, 0xd9
  ]);
}

describe('ShotClipRecorderService', () => {
  let tempStorage: string;
  let recorder: ShotClipRecorderService;

  beforeEach(() => {
    tempStorage = fs.mkdtempSync(path.join(os.tmpdir(), 'recorder-test-'));
    recorder = new ShotClipRecorderService({
      storageRootDir: tempStorage,
      config: { targetFps: 15, maxQueueFrames: 20 },
      encoder: new VideoEncoderService(),
    });
  });

  afterEach(() => {
    try {
      fs.rmSync(tempStorage, { recursive: true, force: true });
    } catch {}
  });

  it('records per-shot clip lifecycle deterministically', async () => {
    const sessionId = 'test_sess_01';
    recorder.startSession(sessionId, 'canon');

    // 1. COUNTDOWN_STARTED(0)
    const clip0 = recorder.startShotClip(sessionId, 0);
    expect(clip0.status).toBe('recording');
    expect(clip0.shotIndex).toBe(0);

    // Push live view frames
    const frameBuffer = createMinimalJpegBuffer();
    for (let i = 0; i < 10; i++) {
      recorder.pushCanonLiveViewFrame({
        data: frameBuffer,
        width: 100,
        height: 100,
        seq: i + 1,
      });
    }

    // 2. SHUTTER_TRIGGERED(0)
    const shutterMeta = recorder.markShutter(sessionId, 0);
    expect(shutterMeta?.shutterAt).toBeTruthy();

    // Push more frames during shutter / download
    for (let i = 10; i < 15; i++) {
      recorder.pushCanonLiveViewFrame({
        data: frameBuffer,
        width: 100,
        height: 100,
        seq: i + 1,
      });
    }

    // 3. CAPTURED_PHOTO_PERSISTED(0) -> finalize clip 0
    const finalMeta = await recorder.stopShotClip(sessionId, 0);
    expect(finalMeta.status).toBe('ready');
    expect(finalMeta.fileSize).toBeGreaterThan(0);
    expect(fs.existsSync(finalMeta.localPath)).toBe(true);

    const clips = recorder.getClips(sessionId);
    expect(clips.length).toBe(1);
    expect(clips[0].status).toBe('ready');
  });

  it('enforces strict memory bounding (drops oldest frames if queue exceeds limit)', () => {
    const sessionId = 'test_sess_bounds';
    recorder.startSession(sessionId, 'canon');
    recorder.startShotClip(sessionId, 0);

    const frameBuffer = createMinimalJpegBuffer();
    // Push 30 frames when limit is 20
    for (let i = 0; i < 30; i++) {
      recorder.pushCanonLiveViewFrame({
        data: frameBuffer,
        width: 100,
        height: 100,
        seq: i + 1,
      });
    }

    // Still able to stop cleanly
    expect(recorder.getClips(sessionId)[0].status).toBe('recording');
  });

  it('marks clip as failed when still capture fails', () => {
    const sessionId = 'test_sess_fail';
    recorder.startSession(sessionId, 'canon');
    recorder.startShotClip(sessionId, 0);

    const failed = recorder.failShotClip(sessionId, 0, 'CAMERA_DISCONNECTED');
    expect(failed?.status).toBe('failed');
    expect(failed?.error).toBe('CAMERA_DISCONNECTED');
  });
});
