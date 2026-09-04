/**
 * frame-video-composer.service.ts
 *
 * Authoritative FrameVideoComposer for PhotoBoothAI / MomentAI CameraOS.
 *
 * Composes per-shot video clips into one final animated MP4 video according to the
 * selected FrameDefinition.
 *
 * Invariants:
 *  - STRICT 1:1 mapping: clip[i] -> frame.slots[i]
 *  - EXACT SAME crop geometry mathematics as still image composition:
 *    normalizeSlotToPixels() + calculateSourceCropRect(..., { horizontalAnchor: 'center', verticalAnchor: 'bottom', fit: 'cover' })
 *  - ALL slots play simultaneously from t = 0 (not sequential)
 *  - Original imported PNG frame overlay drawn on top (Layer 20)
 *  - Duration normalized: short clips loop cleanly, long clips trim deterministically
 *  - Output: MP4 with H.264 (libx264), yuv420p, -movflags +faststart
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { normalizeSlotToPixels, calculateSourceCropRect } from '@/services/render/frame-compositor.service';
import type { FrameVideoCompositionOptions } from './types';
import { VideoEncoderService, videoEncoderService } from './video-encoder.service';

export class FrameVideoComposer {
  private encoder: VideoEncoderService;

  constructor(options?: { encoder?: VideoEncoderService }) {
    this.encoder = options?.encoder || videoEncoderService;
  }

  /**
   * Composes shot clips into a final video matching the frame definition.
   */
  public async composeFrameVideo(options: FrameVideoCompositionOptions): Promise<{
    outputPath: string;
    durationMs: number;
    width: number;
    height: number;
    fileSize: number;
    codec: string;
    fps: number;
  }> {
    const {
      frame,
      clips,
      overlayUrl = frame.assets?.overlay || (frame as unknown as { assetUrl?: string }).assetUrl,
      drawDataUrl,
      outputPath,
      durationMs = 4000,
      targetWidth,
      targetHeight,
    } = options;

    const resolvedOutput = path.resolve(outputPath);
    fs.mkdirSync(path.dirname(resolvedOutput), { recursive: true });

    const rawW = targetWidth || frame.outputWidth || 1800;
    const rawH = targetHeight || frame.outputHeight || 2700;

    // Ensure even width and height for H.264
    const outputWidth = Math.floor(rawW / 2) * 2;
    const outputHeight = Math.floor(rawH / 2) * 2;

    const slots = frame.slots || [];
    if (slots.length === 0) {
      throw new Error('[FrameVideoComposer] Frame definition contains no slots.');
    }

    const durationSec = durationMs / 1000;
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'momentai-video-compose-'));

    try {
      // 1. Prepare Inputs
      const inputArgs: string[] = [];
      const filterChains: string[] = [];

      // Generate base canvas
      const bg = frame.assets?.background;
      const bgColor = bg && bg !== 'transparent' && bg.startsWith('#') ? bg : '#ffffff';
      filterChains.push(`color=c=${bgColor}:s=${outputWidth}x${outputHeight}:d=${durationSec}:r=25 [base0]`);

      let currentBase = 'base0';

      // 2. Add each video clip slot
      let inputCount = 0;
      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        const clip = clips[i];

        if (!clip || clip.status === 'failed' || !clip.localPath || !fs.existsSync(clip.localPath)) {
          throw new Error(`[FrameVideoComposer] Missing required shot clip for slot #${i + 1} (${clip?.localPath || 'not found'})`);
        }

        const inputIndex = inputCount;
        inputCount++;
        inputArgs.push('-stream_loop', '-1', '-i', path.resolve(clip.localPath));

        const slotPx = normalizeSlotToPixels(slot, outputWidth, outputHeight);
        const destW = Math.max(2, Math.floor(slotPx.width / 2) * 2);
        const destH = Math.max(2, Math.floor(slotPx.height / 2) * 2);
        const destX = Math.max(0, Math.round(slotPx.x));
        const destY = Math.max(0, Math.round(slotPx.y));

        const probe = await this.encoder.probeVideo(clip.localPath).catch(() => null);
        const clipW = probe?.width || clip.width || 1920;
        const clipH = probe?.height || clip.height || 1080;

        const crop = calculateSourceCropRect(clipW, clipH, destW, destH, {
          horizontalAnchor: 'center',
          verticalAnchor: 'bottom',
          fit: 'cover',
        });

        const cropW = Math.max(2, Math.floor(crop.cropW / 2) * 2);
        const cropH = Math.max(2, Math.floor(crop.cropH / 2) * 2);
        const cropX = Math.max(0, Math.floor(crop.cropX / 2) * 2);
        const cropY = Math.max(0, Math.floor(crop.cropY / 2) * 2);

        // Filter: loop -> trim -> crop -> scale
        const slotLabel = `slot${i}`;
        const nextBase = `base${i + 1}`;

        filterChains.push(
          `[${inputIndex}:v] trim=duration=${durationSec}, setpts=PTS-STARTPTS, crop=${cropW}:${cropH}:${cropX}:${cropY}, scale=${destW}:${destH} [${slotLabel}]`
        );
        filterChains.push(
          `[${currentBase}][${slotLabel}] overlay=${destX}:${destY}:eof_action=repeat [${nextBase}]`
        );

        currentBase = nextBase;
      }

      // 3. Add Original PNG Frame Overlay (Layer 20)
      let overlayFilePath: string | null = null;
      if (overlayUrl) {
        if (overlayUrl.startsWith('data:image/')) {
          const base64 = overlayUrl.split(',').pop() || '';
          overlayFilePath = path.join(tempDir, 'overlay.png');
          fs.writeFileSync(overlayFilePath, Buffer.from(base64, 'base64'));
        } else if (fs.existsSync(overlayUrl)) {
          overlayFilePath = path.resolve(overlayUrl);
        } else if (overlayUrl.startsWith('/')) {
          const publicPath = path.join(/*turbopackIgnore: true*/ process.cwd(), 'public', overlayUrl);
          if (fs.existsSync(publicPath)) {
            overlayFilePath = publicPath;
          }
        }
      }

      if (overlayFilePath && fs.existsSync(overlayFilePath)) {
        const overlayInputIndex = inputCount;
        inputCount++;
        inputArgs.push('-loop', '1', '-i', overlayFilePath);

        const overlayBase = 'base_overlay';
        filterChains.push(
          `[${overlayInputIndex}:v] trim=duration=${durationSec}, setpts=PTS-STARTPTS, scale=${outputWidth}:${outputHeight} [overlay_scaled]`
        );
        filterChains.push(
          `[${currentBase}][overlay_scaled] overlay=0:0:eof_action=repeat [${overlayBase}]`
        );
        currentBase = overlayBase;
      }

      // 4. Add Draw Layer if provided (Layer 30)
      let drawFilePath: string | null = null;
      if (drawDataUrl && drawDataUrl.startsWith('data:image/')) {
        const base64 = drawDataUrl.split(',').pop() || '';
        drawFilePath = path.join(tempDir, 'draw.png');
        fs.writeFileSync(drawFilePath, Buffer.from(base64, 'base64'));
      }

      if (drawFilePath && fs.existsSync(drawFilePath)) {
        const drawInputIndex = inputCount;
        inputCount++;
        inputArgs.push('-loop', '1', '-i', drawFilePath);

        const drawBase = 'base_draw';
        filterChains.push(
          `[${drawInputIndex}:v] trim=duration=${durationSec}, setpts=PTS-STARTPTS, scale=${outputWidth}:${outputHeight} [draw_scaled]`
        );
        filterChains.push(
          `[${currentBase}][draw_scaled] overlay=0:0:eof_action=repeat [${drawBase}]`
        );
        currentBase = drawBase;
      }

      const filterComplex = filterChains.join('; ');
      const tempOutputFile = path.join(tempDir, 'temp-final-video.mp4');

      const ffmpegArgs = [
        '-y',
        ...inputArgs,
        '-filter_complex', filterComplex,
        '-map', `[${currentBase}]`,
        '-t', String(durationSec),
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-preset', 'veryfast',
        '-crf', '23',
        '-movflags', '+faststart',
        tempOutputFile,
      ];

      await this.encoder.runFfmpeg(ffmpegArgs);

      // FFprobe validation before publishing output
      const probe = await this.encoder.probeVideo(tempOutputFile);
      if (!probe || probe.size === 0 || !probe.width || !probe.height) {
        throw new Error('[FrameVideoComposer] Output video validation failed: empty or corrupt stream.');
      }

      // Atomic publish
      fs.copyFileSync(tempOutputFile, resolvedOutput);
      const stat = fs.statSync(resolvedOutput);

      return {
        outputPath: resolvedOutput,
        durationMs: probe.duration ? Math.round(probe.duration * 1000) : durationMs,
        width: probe.width || outputWidth,
        height: probe.height || outputHeight,
        fileSize: stat.size,
        codec: probe.codec || 'h264',
        fps: probe.fps || 25,
      };
    } finally {
      if (tempDir && fs.existsSync(tempDir)) {
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
        } catch {
          // ignore cleanup
        }
      }
    }
  }
}

export const frameVideoComposer = new FrameVideoComposer();
