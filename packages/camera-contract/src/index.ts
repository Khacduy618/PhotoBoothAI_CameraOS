import type { PersistedMediaRef, Result } from '@momentai/shared-types';

export type CameraProvider = 'fake' | 'device' | 'canon_edsdk';
export type CameraConnectionStatus = 'unknown' | 'initializing' | 'ready' | 'busy' | 'offline' | 'error';

export interface CameraStatus {
  provider: CameraProvider;
  status: CameraConnectionStatus;
  model?: string;
  batteryLevel?: number;
  liveViewRunning: boolean;
  message?: string;
}

export interface CaptureContext {
  sessionId: string;
  shotIndex: number;
  formatId: string;
}

export interface CapturedPhoto {
  photoId: string;
  shotIndex: number;
  original: PersistedMediaRef;
  capturedAt: string;
}

export interface CameraAdapter {
  initialize(): Promise<Result<void>>;
  getStatus(): Promise<CameraStatus>;
  startLiveView(): Promise<Result<void>>;
  stopLiveView(): Promise<Result<void>>;
  capture(context: CaptureContext): Promise<Result<CapturedPhoto>>;
  dispose(): Promise<Result<void>>;
}
