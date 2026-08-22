import type { CaptureContext } from '@momentai/camera-contract';
import type { GuestSessionEvent } from '@momentai/session-engine';
import type { BinaryImage, OutputType } from '@momentai/storage-contract';

export interface WindowMiniGuestApi {
  session: {
    getReadiness(): Promise<unknown>;
    create(eventId?: string): Promise<unknown>;
    get(sessionId: string): Promise<unknown>;
    dispatch(event: GuestSessionEvent): Promise<unknown>;
    listCaptureFormats(): Promise<unknown>;
    selectFormat(sessionId: string, formatId: string): Promise<unknown>;
    addPhoto(sessionId: string, photo: unknown): Promise<unknown>;
    listTemplates(eventId: string, captureFormatId: string): Promise<unknown>;
    selectTemplate(sessionId: string, templateId: string): Promise<unknown>;
    saveCustomization(sessionId: string, customization: unknown): Promise<unknown>;
    compose(sessionId: string): Promise<unknown>;
    requestPrint(sessionId: string, copies: number): Promise<unknown>;
    complete(sessionId: string): Promise<unknown>;
  };
  camera: {
    status(): Promise<unknown>;
    capture(context: CaptureContext): Promise<unknown>;
  };
  storage: {
    health(): Promise<unknown>;
    createSession(sessionId: string): Promise<unknown>;
    saveOriginal(sessionId: string, shotIndex: number, photo: BinaryImage): Promise<unknown>;
    saveOutput(sessionId: string, type: OutputType, file: BinaryImage): Promise<unknown>;
  };
  printer: {
    status(printerId: string): Promise<unknown>;
  };
  media: {
    startShotClip(sessionId: string, shotIndex: number, countdownStartedAt?: string): Promise<unknown>;
    pushDeviceFrame(sessionId: string, shotIndex: number, bufferData: Uint8Array | Buffer, width?: number, height?: number): Promise<unknown>;
    markShutter(sessionId: string, shotIndex: number, shutterAt?: string): Promise<unknown>;
    stopShotClip(sessionId: string, shotIndex: number, persistedAt?: string, options?: { fallbackDataUrl?: string }): Promise<unknown>;
    failShotClip(sessionId: string, shotIndex: number, error: string): Promise<unknown>;
    getClips(sessionId: string): Promise<unknown>;
    composeVideo(sessionId: string, frame: unknown, options?: unknown): Promise<unknown>;
    getPackage(sessionId: string, origin?: string): Promise<unknown>;
    getPublicToken(sessionId: string): Promise<unknown>;
  };
}

export function createGuestApiPlaceholder(): WindowMiniGuestApi {
  const unavailable = async () => ({ ok: false, error: 'GUEST_IPC_NOT_BOUND' });
  return {
    session: {
      getReadiness: unavailable,
      create: unavailable,
      get: unavailable,
      dispatch: unavailable,
      listCaptureFormats: unavailable,
      selectFormat: unavailable,
      addPhoto: unavailable,
      listTemplates: unavailable,
      selectTemplate: unavailable,
      saveCustomization: unavailable,
      compose: unavailable,
      requestPrint: unavailable,
      complete: unavailable,
    },
    camera: { status: unavailable, capture: unavailable },
    storage: { health: unavailable, createSession: unavailable, saveOriginal: unavailable, saveOutput: unavailable },
    printer: { status: unavailable },
    media: {
      startShotClip: unavailable,
      pushDeviceFrame: unavailable,
      markShutter: unavailable,
      stopShotClip: unavailable,
      failShotClip: unavailable,
      getClips: unavailable,
      composeVideo: unavailable,
      getPackage: unavailable,
      getPublicToken: unavailable,
    },
  };
}
