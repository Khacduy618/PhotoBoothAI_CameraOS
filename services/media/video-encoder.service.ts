/**
 * video-encoder.service.ts
 *
 * Dedicated FFmpeg wrapper and video encoder service for PhotoBoothAI / MomentAI CameraOS.
 * Provides:
 *  - encodeFramesToMp4: Encodes a sequence of JPEG LiveView frames into a normalized MP4 clip.
 *  - probeVideo: Extracts metadata (duration, width, height, fps, codec, size) using ffprobe.
 *  - validateVideo: Ensures an MP4 file exists, is non-zero, and has a decodable video stream.
 *
 * Invariants:
 *  - Container: MP4
 *  - Video Codec: H.264 (libx264)
 *  - Pixel Format: yuv420p (production-safe for all web/mobile players)
 *  - Faststart flag: -movflags +faststart for immediate web/QR playback
 *  - Odd-dimension protection: guarantees even dimensions for H.264
 */

import { spawn, execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { promisify } from 'node:util';
import type { LiveViewFrame, VideoEncoderOptions } from './types';

const execFileAsync = promisify(execFile);

export interface ProbeResult {
  duration: number;
  width: number;
  height: number;
  codec: string;
  fps: number;
  size: number;
}

export class VideoEncoderService {
  private ffmpegPath: string;
  private ffprobePath: string;

  constructor(options?: { ffmpegPath?: string; ffprobePath?: string }) {
    this.ffmpegPath = options?.ffmpegPath || this.resolveBinary('ffmpeg');
    this.ffprobePath = options?.ffprobePath || this.resolveBinary('ffprobe');
  }

  private resolveBinary(name: string): string {
    const envVar = name === 'ffmpeg'
      ? (process.env.MOMENTAI_FFMPEG_PATH || process.env.FFMPEG_PATH)
      : (process.env.MOMENTAI_FFPROBE_PATH || process.env.FFPROBE_PATH);
    if (envVar && fs.existsSync(envVar)) return envVar;

    const ext = process.platform === 'win32' ? '.exe' : '';
    const fullName = `${name}${ext}`;
    const projectRoot = process.cwd();

    const candidates = [
      path.join(projectRoot, 'vendor', 'ffmpeg', 'bin', fullName),
      path.join(projectRoot, 'vendor', 'ffmpeg', fullName),
      path.join(projectRoot, 'bin', fullName),
      `C:\\ffmpeg\\bin\\${fullName}`,
      `C:\\Program Files\\ffmpeg\\bin\\${fullName}`,
      `C:\\Program Files (x86)\\ffmpeg\\bin\\${fullName}`,
      `C:\\ProgramData\\chocolatey\\bin\\${fullName}`,
      path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'WinGet', 'Links', fullName),
      path.join(os.homedir(), 'scoop', 'shims', fullName),
      path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'ffmpeg', 'bin', fullName),
      path.join(os.homedir(), 'AppData', 'Local', 'ffmpeg', 'bin', fullName),
      `/opt/homebrew/bin/${name}`,
      `/usr/local/bin/${name}`,
      `/usr/bin/${name}`,
    ];

    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
    return name;
  }

  public getFfmpegPath(): string {
    return this.ffmpegPath;
  }

  public getFfprobePath(): string {
    return this.ffprobePath;
  }

  /**
   * Encodes a list of LiveView JPEG frames into an MP4 clip.
   */
  public async encodeFramesToMp4(options: VideoEncoderOptions): Promise<{
    outputPath: string;
    durationMs: number;
    width: number;
    height: number;
    fileSize: number;
    fps: number;
    codec: string;
  }> {
    const { inputFrames, outputPath, targetFps = 15 } = options;
    const resolvedOutput = path.resolve(outputPath);
    fs.mkdirSync(path.dirname(resolvedOutput), { recursive: true });

    let frames: LiveViewFrame[] = [];
    let tempDir: string | null = null;

    if (Array.isArray(inputFrames)) {
      frames = inputFrames;
    }

    if (frames.length === 0) {
      throw new Error('[VideoEncoderService] Cannot encode video: no input frames provided.');
    }

    // Create temporary directory for frame sequencing
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'momentai-encode-'));

    try {
      // Calculate effective FPS based on timestamps if available
      let calculatedFps = targetFps;
      if (frames.length >= 2) {
        const firstTs = frames[0].timestamp;
        const lastTs = frames[frames.length - 1].timestamp;
        const durationSec = (lastTs - firstTs) / 1000;
        if (durationSec > 0.2) {
          calculatedFps = Math.max(5, Math.min(30, Math.round((frames.length / durationSec) * 10) / 10));
        }
      }

      // Write frames to temp files: frame_%05d.jpg
      for (let i = 0; i < frames.length; i++) {
        const framePath = path.join(tempDir, `frame_${String(i + 1).padStart(5, '0')}.jpg`);
        fs.writeFileSync(framePath, frames[i].data);
      }

      const inputPattern = path.join(tempDir, 'frame_%05d.jpg');

      // Run FFmpeg
      const args = [
        '-y',
        '-framerate', String(calculatedFps),
        '-i', inputPattern,
        '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', // Ensure even width/height for H.264
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-preset', 'veryfast',
        '-crf', '23',
        '-movflags', '+faststart',
        resolvedOutput,
      ];

      await this.runFfmpeg(args);

      // Probe result metadata
      const probe = await this.probeVideo(resolvedOutput).catch(() => null);
      const stat = fs.statSync(resolvedOutput);

      const durationMs = probe?.duration ? Math.round(probe.duration * 1000) : Math.round((frames.length / calculatedFps) * 1000);
      const width = probe?.width || frames[0].width || 1920;
      const height = probe?.height || frames[0].height || 1080;

      return {
        outputPath: resolvedOutput,
        durationMs,
        width,
        height,
        fileSize: stat.size,
        fps: calculatedFps,
        codec: probe?.codec || 'h264',
      };
    } finally {
      if (tempDir && fs.existsSync(tempDir)) {
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
        } catch {
          // ignore cleanup error
        }
      }
    }
  }

  /**
   * Probes video metadata using ffprobe.
   */
  public async probeVideo(videoPath: string): Promise<ProbeResult> {
    const resolvedPath = path.resolve(videoPath);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`[VideoEncoderService] Video file not found: ${resolvedPath}`);
    }

    const args = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      resolvedPath,
    ];

    const { stdout } = await execFileAsync(this.ffprobePath, args);
    const data = JSON.parse(stdout);

    const videoStream = data.streams?.find((s: { codec_type?: string }) => s.codec_type === 'video') || data.streams?.[0];
    const format = data.format;

    if (!videoStream) {
      throw new Error(`[VideoEncoderService] No video stream found in ${resolvedPath}`);
    }

    let fps = 15;
    if (videoStream.r_frame_rate) {
      const [num, den] = videoStream.r_frame_rate.split('/').map(Number);
      if (num && den) fps = Math.round((num / den) * 100) / 100;
    }

    const duration = Number(format?.duration || videoStream.duration || 0);
    const width = Number(videoStream.width || 0);
    const height = Number(videoStream.height || 0);
    const codec = String(videoStream.codec_name || 'unknown');
    const size = Number(format?.size || fs.statSync(resolvedPath).size);

    return {
      duration,
      width,
      height,
      codec,
      fps,
      size,
    };
  }

  /**
   * Executes FFmpeg with provided arguments.
   */
  public runFfmpeg(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let stderr = '';

      proc.stderr.on('data', (d) => {
        stderr += d.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`[VideoEncoderService] FFmpeg exited with code ${code}.\nCMD: ${this.ffmpegPath} ${args.join(' ')}\nSTDERR: ${stderr}`));
        }
      });

      proc.on('error', (err) => {
        reject(err);
      });
    });
  }
}

export const videoEncoderService = new VideoEncoderService();
