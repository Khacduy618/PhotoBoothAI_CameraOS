import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { VideoEncoderService } from './video-encoder.service';
import type { LiveViewFrame } from './types';

// Helper to generate a minimal valid 1x1 JPEG Buffer
function createMinimalJpegBuffer(): Buffer {
  // 1x1 white JPEG
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

describe('VideoEncoderService', () => {
  let tempDir: string;
  let encoder: VideoEncoderService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'encoder-test-'));
    encoder = new VideoEncoderService();
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('locates valid ffmpeg and ffprobe binaries', () => {
    expect(encoder.getFfmpegPath()).toBeTruthy();
    expect(encoder.getFfprobePath()).toBeTruthy();
  });

  it('throws error when no frames are provided', async () => {
    const out = path.join(tempDir, 'empty.mp4');
    await expect(encoder.encodeFramesToMp4({ inputFrames: [], outputPath: out })).rejects.toThrow(
      'no input frames provided'
    );
  });

  it('encodes an array of JPEG frames to an MP4 video', async () => {
    const frameBuffer = createMinimalJpegBuffer();
    const frames: LiveViewFrame[] = [];
    const now = Date.now();
    for (let i = 0; i < 15; i++) {
      frames.push({
        data: frameBuffer,
        timestamp: now + i * 66,
        width: 100,
        height: 100,
      });
    }

    const out = path.join(tempDir, 'output.mp4');
    const result = await encoder.encodeFramesToMp4({
      inputFrames: frames,
      outputPath: out,
      targetFps: 15,
    });

    expect(fs.existsSync(out)).toBe(true);
    expect(result.fileSize).toBeGreaterThan(0);
    expect(result.outputPath).toBe(out);
    expect(result.durationMs).toBeGreaterThan(0);
  });

  it('probes MP4 file metadata correctly', async () => {
    const frameBuffer = createMinimalJpegBuffer();
    const frames: LiveViewFrame[] = [];
    const now = Date.now();
    for (let i = 0; i < 15; i++) {
      frames.push({
        data: frameBuffer,
        timestamp: now + i * 66,
        width: 100,
        height: 100,
      });
    }

    const out = path.join(tempDir, 'probe-test.mp4');
    await encoder.encodeFramesToMp4({
      inputFrames: frames,
      outputPath: out,
      targetFps: 15,
    });

    const probe = await encoder.probeVideo(out);
    expect(probe.width).toBeGreaterThanOrEqual(2);
    expect(probe.height).toBeGreaterThanOrEqual(2);
    expect(probe.codec.toLowerCase()).toContain('h264');
    expect(probe.size).toBeGreaterThan(0);
  });
});
