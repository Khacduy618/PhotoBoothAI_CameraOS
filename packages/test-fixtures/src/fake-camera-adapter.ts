import type { CameraAdapter, CameraStatus, CaptureContext, CapturedPhoto } from '@momentai/camera-contract';
import type { Result } from '@momentai/shared-types';

export class FakeCameraAdapter implements CameraAdapter {
  private liveViewRunning = false;

  async initialize(): Promise<Result<void>> {
    return { ok: true, value: undefined };
  }

  async getStatus(): Promise<CameraStatus> {
    return {
      provider: 'fake',
      status: 'ready',
      model: 'Fake Camera Adapter',
      liveViewRunning: this.liveViewRunning,
    };
  }

  async startLiveView(): Promise<Result<void>> {
    this.liveViewRunning = true;
    return { ok: true, value: undefined };
  }

  async stopLiveView(): Promise<Result<void>> {
    this.liveViewRunning = false;
    return { ok: true, value: undefined };
  }

  async capture(context: CaptureContext): Promise<Result<CapturedPhoto>> {
    const capturedAt = new Date().toISOString();
    return {
      ok: true,
      value: {
        photoId: `fake_${context.sessionId}_${context.shotIndex}`,
        shotIndex: context.shotIndex,
        capturedAt,
        original: {
          id: `fake_original_${context.shotIndex}`,
          sessionId: context.sessionId,
          relativePath: `sessions/fake/${context.sessionId}/originals/${String(context.shotIndex).padStart(2, '0')}.jpg`,
          mimeType: 'image/jpeg',
          width: 1800,
          height: 2700,
          bytes: 0,
          createdAt: capturedAt,
        },
      },
    };
  }

  async dispose(): Promise<Result<void>> {
    this.liveViewRunning = false;
    return { ok: true, value: undefined };
  }
}
