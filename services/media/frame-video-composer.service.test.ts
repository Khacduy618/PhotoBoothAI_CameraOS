import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { FrameVideoComposer } from './frame-video-composer.service';
import { VideoEncoderService } from './video-encoder.service';
import type { FrameTemplate } from '@/components/momentai-guest-flow/types';
import type { ShotClipMetadata } from './types';

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

describe('FrameVideoComposer', () => {
  let tempDir: string;
  let composer: FrameVideoComposer;
  let encoder: VideoEncoderService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'composer-test-'));
    encoder = new VideoEncoderService();
    composer = new FrameVideoComposer({ encoder });
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('composes a 2-slot video frame with simultaneous playback', async () => {
    const frameBuffer = createMinimalJpegBuffer();
    const clip1Path = path.join(tempDir, 'clip1.mp4');
    const clip2Path = path.join(tempDir, 'clip2.mp4');

    // Create 2 minimal clip mp4s
    const frames = Array.from({ length: 15 }, (_, i) => ({
      data: frameBuffer,
      timestamp: Date.now() + i * 66,
      width: 100,
      height: 100,
    }));

    await encoder.encodeFramesToMp4({ inputFrames: frames, outputPath: clip1Path });
    await encoder.encodeFramesToMp4({ inputFrames: frames, outputPath: clip2Path });

    const testFrame: FrameTemplate = {
      id: 'frame_2slot_test',
      name: '2-Slot Test Frame',
      thumbnail: '',
      category: 'test',
      outputWidth: 600,
      outputHeight: 900,
      layout: { type: '1x2', slotCount: 2 },
      slots: [
        { id: 1, x: 5, y: 5, width: 90, height: 42 },
        { id: 2, x: 5, y: 52, width: 90, height: 42 },
      ],
      assets: {
        background: '#ffffff',
      },
      supportedPapers: ['4x6'],
      preferredPaper: '4x6',
    };

    const clips: ShotClipMetadata[] = [
      {
        id: 'clip_1',
        sessionId: 'sess_test',
        shotIndex: 0,
        localPath: clip1Path,
        status: 'ready',
        provider: 'canon',
        width: 100,
        height: 100,
      },
      {
        id: 'clip_2',
        sessionId: 'sess_test',
        shotIndex: 1,
        localPath: clip2Path,
        status: 'ready',
        provider: 'canon',
        width: 100,
        height: 100,
      },
    ];

    const outVideo = path.join(tempDir, 'final-video.mp4');
    const result = await composer.composeFrameVideo({
      sessionId: 'sess_test',
      frame: testFrame,
      clips,
      outputPath: outVideo,
      durationMs: 2000,
      targetWidth: 600,
      targetHeight: 900,
    });

    expect(fs.existsSync(outVideo)).toBe(true);
    expect(result.fileSize).toBeGreaterThan(0);
    expect(result.width).toBe(600);
    expect(result.height).toBe(900);
    expect(result.codec.toLowerCase()).toContain('h264');
  });

  it('rejects composition when required shot clip is missing', async () => {
    const testFrame: FrameTemplate = {
      id: 'frame_1slot_test',
      name: '1-Slot Test Frame',
      thumbnail: '',
      category: 'test',
      outputWidth: 600,
      outputHeight: 900,
      layout: { type: '1x1', slotCount: 1 },
      slots: [{ id: 1, x: 0, y: 0, width: 100, height: 100 }],
      assets: { background: '#ffffff' },
      supportedPapers: ['4x6'],
      preferredPaper: '4x6',
    };

    const outVideo = path.join(tempDir, 'missing.mp4');
    await expect(
      composer.composeFrameVideo({
        sessionId: 'sess_test',
        frame: testFrame,
        clips: [null],
        outputPath: outVideo,
      })
    ).rejects.toThrow('Missing required shot clip');
  });
});
