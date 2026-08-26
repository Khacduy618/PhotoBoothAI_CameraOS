/**
 * types.ts
 *
 * Authoritative type definitions for the MomentAI CameraOS video media pipeline.
 * Covers:
 *  - Per-shot countdown video clips
 *  - Live view frame buffering
 *  - Frame video composition
 *  - Durable media job queue & SessionMediaPackage
 */

import type { FrameTemplate } from '@/components/momentai-guest-flow/types';

export type ShotClipStatus =
  | 'idle'
  | 'recording'
  | 'finalizing'
  | 'ready'
  | 'failed'
  | 'aborted';

export interface ShotClipMetadata {
  id: string;
  sessionId: string;
  shotIndex: number;
  localPath: string;
  status: ShotClipStatus;
  startedAt?: string;
  shutterAt?: string;
  completedAt?: string;
  durationMs?: number;
  fileSize?: number;
  width?: number;
  height?: number;
  fps?: number;
  codec?: string;
  provider: 'canon' | 'device' | 'simulator';
  error?: string;
}

export interface LiveViewFrame {
  data: Buffer;
  timestamp: number;
  width?: number;
  height?: number;
  seq?: number;
}

export interface ShotClipTimingConfig {
  targetFps: number;
  finalDurationMs: number;
  maxQueueFrames: number;
}

export const DEFAULT_SHOT_CLIP_TIMING_CONFIG: ShotClipTimingConfig = {
  targetFps: 15,
  finalDurationMs: 4000,
  maxQueueFrames: 300, // ~20s at 15fps max per clip
};

export interface VideoEncoderOptions {
  inputFrames: LiveViewFrame[] | string;
  outputPath: string;
  targetFps?: number;
  width?: number;
  height?: number;
}

export interface FrameVideoCompositionOptions {
  sessionId: string;
  frame: FrameTemplate;
  clips: (ShotClipMetadata | null)[];
  overlayUrl?: string;
  drawDataUrl?: string;
  outputPath: string;
  durationMs?: number;
  targetWidth?: number;
  targetHeight?: number;
}

export interface SessionMediaPackage {
  sessionId: string;
  publicToken: string;
  shareUrl: string;
  finalImage: {
    path?: string;
    dataUrl?: string;
    size?: number;
    width?: number;
    height?: number;
  } | null;
  finalVideo: {
    path?: string;
    dataUrl?: string;
    size?: number;
    duration?: number;
    width?: number;
    height?: number;
    codec?: string;
  } | null;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  createdAt: string;
  updatedAt: string;
}

export type MediaJobType =
  | 'FRAME_VIDEO_COMPOSE'
  | 'UPLOAD_FINAL_IMAGE'
  | 'UPLOAD_FINAL_VIDEO'
  | 'FINALIZE_SHARE_PAGE';

export type MediaJobStatus =
  | 'QUEUED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED';

export interface MediaJob {
  id: string;
  sessionId: string;
  jobType: MediaJobType;
  status: MediaJobStatus;
  payload: Record<string, unknown>;
  attemptCount: number;
  lastError?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  updatedAt: string;
}
