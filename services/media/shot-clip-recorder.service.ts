/**
 * shot-clip-recorder.service.ts
 *
 * Authoritative ShotClipRecorderService for MomentAI CameraOS.
 *
 * Deterministic Shot-Based Policy:
 *  - For every shot i:
 *    COUNTDOWN_STARTED(i) -> startShotClip(sessionId, i)
 *    Live view frames stream continuously into shot queue
 *    SHUTTER_TRIGGERED(i) -> markShutter(sessionId, i)
 *    Authoritative still photo downloaded & persisted
 *    CAPTURED_PHOTO_PERSISTED(i) -> stopShotClip(sessionId, i)
 *    FFmpeg encodes shot_0X.mp4
 *
 * Invariants:
 *  - videoClip[i] strictly corresponds to photo[i]
 *  - Still photo capture is authoritative; video failure never blocks still photo
 *  - Canon EVF frames feed directly in Electron Main without renderer round-trip
 *  - Strict memory bounding: maxQueueFrames drops oldest frames if queue exceeds limit
 */

import fs from 'node:fs';
import path from 'node:path';
import type { LiveViewFrame, ShotClipMetadata, ShotClipStatus, ShotClipTimingConfig } from './types';
import { DEFAULT_SHOT_CLIP_TIMING_CONFIG } from './types';
import { VideoEncoderService, videoEncoderService } from './video-encoder.service';

interface ActiveShotState {
  shotIndex: number;
  status: ShotClipStatus;
  recordingActive?: boolean;
  startedAt: string;
  shutterAt?: string;
  completedAt?: string;
  frames: LiveViewFrame[];
  provider: 'canon' | 'device' | 'simulator';
  error?: string;
  metadata?: ShotClipMetadata;
}

export class ShotClipRecorderService {
  private activeSessionId: string | null = null;
  private storageRootDir: string;
  private config: ShotClipTimingConfig;
  private encoder: VideoEncoderService;
  private sessionClips = new Map<string, Map<number, ActiveShotState>>();
  private sessionProviders = new Map<string, 'canon' | 'device' | 'simulator'>();
  private activeProvider: 'canon' | 'device' | 'simulator' = 'canon';

  constructor(options?: {
    storageRootDir?: string;
    config?: Partial<ShotClipTimingConfig>;
    encoder?: VideoEncoderService;
  }) {
    this.storageRootDir = options?.storageRootDir || path.resolve(process.env.MOMENTAI_STORAGE_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), 'artifacts', 'windowmini-storage'));
    this.config = { ...DEFAULT_SHOT_CLIP_TIMING_CONFIG, ...options?.config };
    this.encoder = options?.encoder || videoEncoderService;
  }

  public setStorageRootDir(dir: string) {
    this.storageRootDir = path.resolve(dir);
  }

  public setProvider(provider: 'canon' | 'device' | 'simulator') {
    this.activeProvider = provider;
  }

  /**
   * Initializes a recording session.
   */
  public startSession(sessionId: string, provider?: 'canon' | 'device' | 'simulator') {
    this.activeSessionId = sessionId;
    const resolvedProvider = provider || this.activeProvider;
    this.sessionProviders.set(sessionId, resolvedProvider);
    if (!this.sessionClips.has(sessionId)) {
      this.sessionClips.set(sessionId, new Map());
    }

    const clipsDir = path.join(this.storageRootDir, 'sessions', sessionId, 'clips');
    fs.mkdirSync(clipsDir, { recursive: true });
  }

  /**
   * Starts recording the video clip for shotIndex at COUNTDOWN_STARTED.
   */
  public startShotClip(sessionId: string, shotIndex: number, countdownStartedAt?: string): ShotClipMetadata {
    const provider = this.sessionProviders.get(sessionId) || this.activeProvider;
    this.startSession(sessionId, provider);
    const sessionMap = this.sessionClips.get(sessionId)!;

    const startedAt = countdownStartedAt || new Date().toISOString();
    const clipsDir = path.join(this.storageRootDir, 'sessions', sessionId, 'clips');
    const localPath = path.join(clipsDir, `shot_${String(shotIndex + 1).padStart(2, '0')}.mp4`);

    const shotState: ActiveShotState = {
      shotIndex,
      status: 'recording',
      recordingActive: true,
      startedAt,
      frames: [],
      provider,
    };

    sessionMap.set(shotIndex, shotState);

    const meta: ShotClipMetadata = {
      id: `clip_${sessionId}_${shotIndex + 1}`,
      sessionId,
      shotIndex,
      localPath,
      status: 'recording',
      startedAt,
      provider,
    };

    shotState.metadata = meta;
    return meta;
  }

  /**
   * Pushes an EVF live view frame directly from CanonCameraBridge (Electron Main).
   */
  public pushCanonLiveViewFrame(frame: { data?: Buffer; dataUrl?: string; width?: number; height?: number; seq?: number }) {
    if (!this.activeSessionId) return;
    const sessionMap = this.sessionClips.get(this.activeSessionId);
    if (!sessionMap) return;

    // Find currently recording shot
    for (const shotState of sessionMap.values()) {
      if (shotState.status === 'recording' && shotState.recordingActive !== false) {
        let buffer: Buffer | null = null;
        if (frame.data && Buffer.isBuffer(frame.data)) {
          buffer = frame.data;
        } else if (frame.dataUrl && typeof frame.dataUrl === 'string') {
          const base64Data = frame.dataUrl.split(',').pop() || frame.dataUrl;
          buffer = Buffer.from(base64Data, 'base64');
        }

        if (buffer && buffer.length > 0) {
          const liveFrame: LiveViewFrame = {
            data: buffer,
            timestamp: Date.now(),
            width: frame.width,
            height: frame.height,
            seq: frame.seq,
          };

          shotState.frames.push(liveFrame);

          // Bound queue length to prevent unbounded memory growth
          if (shotState.frames.length > this.config.maxQueueFrames) {
            shotState.frames.shift(); // drop oldest frame
          }
        }
      }
    }
  }

  /**
   * Pushes a fallback frame from device webcam.
   */
  public pushDevicePreviewFrame(sessionId: string, shotIndex: number, frameBuffer: Buffer, width?: number, height?: number) {
    const sessionMap = this.sessionClips.get(sessionId);
    if (!sessionMap) return;
    const shotState = sessionMap.get(shotIndex);
    if (shotState && shotState.status === 'recording' && shotState.recordingActive !== false) {
      shotState.frames.push({
        data: frameBuffer,
        timestamp: Date.now(),
        width: width || 1920,
        height: height || 1080,
      });

      if (shotState.frames.length > this.config.maxQueueFrames) {
        shotState.frames.shift();
      }
    }
  }

  /**
   * Marks the shutter trigger timestamp.
   */
  public markShutter(sessionId: string, shotIndex: number, shutterAt?: string): ShotClipMetadata | null {
    const sessionMap = this.sessionClips.get(sessionId);
    if (!sessionMap) return null;
    const shotState = sessionMap.get(shotIndex);
    if (!shotState) return null;

    shotState.shutterAt = shutterAt || new Date().toISOString();
    shotState.recordingActive = false; // Stop accepting frames into the clip at T-0
    if (shotState.metadata) {
      shotState.metadata.shutterAt = shotState.shutterAt;
    }
    return shotState.metadata || null;
  }

  /**
   * Stops recording and finalizes the shot clip after still photo is persisted.
   */
  public async stopShotClip(
    sessionId: string,
    shotIndex: number,
    capturedPhotoPersistedAt?: string,
    options?: { fallbackImageBuffer?: Buffer }
  ): Promise<ShotClipMetadata> {
    const sessionMap = this.sessionClips.get(sessionId);
    if (!sessionMap) {
      throw new Error(`[ShotClipRecorderService] Session ${sessionId} not found.`);
    }

    const shotState = sessionMap.get(shotIndex);
    if (!shotState) {
      throw new Error(`[ShotClipRecorderService] Shot ${shotIndex} for session ${sessionId} not found.`);
    }

    shotState.completedAt = capturedPhotoPersistedAt || new Date().toISOString();
    shotState.status = 'finalizing';

    const clipsDir = path.join(this.storageRootDir, 'sessions', sessionId, 'clips');
    fs.mkdirSync(clipsDir, { recursive: true });
    const outputPath = path.join(clipsDir, `shot_${String(shotIndex + 1).padStart(2, '0')}.mp4`);

    try {
      // If we have very few frames (e.g. fast capture or simulator fallback), generate minimal frames from still image or replicate
      if (shotState.frames.length === 0 && options?.fallbackImageBuffer) {
        for (let k = 0; k < 15; k++) {
          shotState.frames.push({
            data: options.fallbackImageBuffer,
            timestamp: Date.now() + k * 66,
            width: 1920,
            height: 1080,
          });
        }
      } else if (shotState.frames.length === 1) {
        // Replicate single frame across 15 frames for valid MP4
        const single = shotState.frames[0];
        for (let k = 1; k < 15; k++) {
          shotState.frames.push({
            data: single.data,
            timestamp: single.timestamp + k * 66,
            width: single.width,
            height: single.height,
          });
        }
      }

      if (shotState.frames.length === 0) {
        shotState.status = 'failed';
        shotState.error = 'NO_FRAMES_CAPTURED';
        const meta: ShotClipMetadata = {
          id: `clip_${sessionId}_${shotIndex + 1}`,
          sessionId,
          shotIndex,
          localPath: outputPath,
          status: 'failed',
          startedAt: shotState.startedAt,
          shutterAt: shotState.shutterAt,
          completedAt: shotState.completedAt,
          provider: shotState.provider,
          error: 'NO_FRAMES_CAPTURED',
        };
        shotState.metadata = meta;
        return meta;
      }

      // Encode frames via FFmpeg
      const encodeResult = await this.encoder.encodeFramesToMp4({
        inputFrames: shotState.frames,
        outputPath,
        targetFps: this.config.targetFps,
      });

      // Clear in-memory frame buffer immediately to free RAM
      shotState.frames = [];

      shotState.status = 'ready';
      const meta: ShotClipMetadata = {
        id: `clip_${sessionId}_${shotIndex + 1}`,
        sessionId,
        shotIndex,
        localPath: outputPath,
        status: 'ready',
        startedAt: shotState.startedAt,
        shutterAt: shotState.shutterAt,
        completedAt: shotState.completedAt,
        durationMs: encodeResult.durationMs,
        fileSize: encodeResult.fileSize,
        width: encodeResult.width,
        height: encodeResult.height,
        fps: encodeResult.fps,
        codec: encodeResult.codec,
        provider: shotState.provider,
      };

      shotState.metadata = meta;
      return meta;
    } catch (err) {
      shotState.status = 'failed';
      shotState.error = err instanceof Error ? err.message : 'ENCODING_FAILED';
      shotState.frames = [];

      const meta: ShotClipMetadata = {
        id: `clip_${sessionId}_${shotIndex + 1}`,
        sessionId,
        shotIndex,
        localPath: outputPath,
        status: 'failed',
        startedAt: shotState.startedAt,
        shutterAt: shotState.shutterAt,
        completedAt: shotState.completedAt,
        provider: shotState.provider,
        error: shotState.error,
      };
      shotState.metadata = meta;
      return meta;
    }
  }

  /**
   * Marks a shot clip as failed when still capture fails.
   */
  public failShotClip(sessionId: string, shotIndex: number, error: string): ShotClipMetadata | null {
    const sessionMap = this.sessionClips.get(sessionId);
    if (!sessionMap) return null;
    const shotState = sessionMap.get(shotIndex);
    if (!shotState) return null;

    shotState.status = 'failed';
    shotState.error = error;
    shotState.frames = [];

    if (shotState.metadata) {
      shotState.metadata.status = 'failed';
      shotState.metadata.error = error;
    }
    return shotState.metadata || null;
  }

  /**
   * Gets all clips for a session ordered by shotIndex.
   */
  public getClips(sessionId: string): ShotClipMetadata[] {
    const sessionMap = this.sessionClips.get(sessionId);
    if (!sessionMap) return [];
    return Array.from(sessionMap.values())
      .map((s) => s.metadata || {
        id: `clip_${sessionId}_${s.shotIndex + 1}`,
        sessionId,
        shotIndex: s.shotIndex,
        localPath: path.join(this.storageRootDir, 'sessions', sessionId, 'clips', `shot_${String(s.shotIndex + 1).padStart(2, '0')}.mp4`),
        status: s.status,
        startedAt: s.startedAt,
        shutterAt: s.shutterAt,
        completedAt: s.completedAt,
        provider: s.provider,
      })
      .sort((a, b) => a.shotIndex - b.shotIndex);
  }

  /**
   * Cleans up in-memory state on session abort.
   */
  public abortSession(sessionId: string) {
    const sessionMap = this.sessionClips.get(sessionId);
    if (sessionMap) {
      for (const s of sessionMap.values()) {
        s.frames = [];
        if (s.status === 'recording' || s.status === 'finalizing') {
          s.status = 'aborted';
        }
      }
    }
    if (this.activeSessionId === sessionId) {
      this.activeSessionId = null;
    }
  }
}

export const shotClipRecorderService = new ShotClipRecorderService();
