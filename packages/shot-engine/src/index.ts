export type CaptureFormatId = 'format_1shot' | 'format_2shot' | 'format_4shot' | 'format_6shot';

export interface CaptureFormat {
  id: CaptureFormatId;
  shotCount: 1 | 2 | 4 | 6;
  slotCount: 1 | 2 | 4 | 6;
  layoutType: 'single' | 'vertical_2' | 'vertical_4' | '2col_3row';
  label: string;
}

export const CAPTURE_FORMATS: readonly CaptureFormat[] = [
  { id: 'format_1shot', shotCount: 1, slotCount: 1, layoutType: 'single', label: '1 Shot' },
  { id: 'format_2shot', shotCount: 2, slotCount: 2, layoutType: 'vertical_2', label: '2 Shots' },
  { id: 'format_4shot', shotCount: 4, slotCount: 4, layoutType: 'vertical_4', label: '4 Shots' },
  { id: 'format_6shot', shotCount: 6, slotCount: 6, layoutType: '2col_3row', label: '6 Shots' },
];

export function getCaptureFormat(id: CaptureFormatId): CaptureFormat {
  const format = CAPTURE_FORMATS.find((item) => item.id === id);
  if (!format) throw new Error(`Unsupported capture format: ${id}`);
  return format;
}

export function getSlotIndexForShot(shotIndex: number): number {
  return shotIndex;
}

export interface CaptureLoopPhoto {
  photoId: string;
  shotIndex: number;
  originalPath: string;
  capturedAt: string;
}

export interface CaptureLoopContext {
  sessionId: string;
  format: CaptureFormat;
}

export interface CaptureLoopCamera {
  capture(context: { sessionId: string; shotIndex: number; formatId: CaptureFormatId }): Promise<{ ok: true; value: { bytes: Uint8Array; mimeType: string; width?: number; height?: number } } | { ok: false; error: Error }>;
}

export interface CaptureLoopStorage {
  saveOriginal(sessionId: string, shotIndex: number, photo: { bytes: Uint8Array; mimeType: string; width?: number; height?: number }): Promise<{ ok: true; value: { id: string; relativePath: string; createdAt: string } } | { ok: false; error: Error }>;
}

export class CaptureLoopManager {
  private running = false;

  constructor(private readonly camera: CaptureLoopCamera, private readonly storage: CaptureLoopStorage) {}

  isRunning(): boolean {
    return this.running;
  }

  async captureAll(context: CaptureLoopContext): Promise<{ ok: true; value: CaptureLoopPhoto[] } | { ok: false; error: Error; partialPhotos: CaptureLoopPhoto[] }> {
    if (this.running) return { ok: false, error: new Error('Capture loop is already running.'), partialPhotos: [] };
    this.running = true;
    const photos: CaptureLoopPhoto[] = [];

    try {
      for (let shotIndex = 1; shotIndex <= context.format.shotCount; shotIndex += 1) {
        const captured = await this.camera.capture({ sessionId: context.sessionId, shotIndex, formatId: context.format.id });
        if (!captured.ok) return { ok: false, error: captured.error, partialPhotos: photos };
        if (captured.value.bytes.byteLength <= 0) return { ok: false, error: new Error('Captured image is empty.'), partialPhotos: photos };

        const stored = await this.storage.saveOriginal(context.sessionId, shotIndex, captured.value);
        if (!stored.ok) return { ok: false, error: stored.error, partialPhotos: photos };

        photos.push({
          photoId: stored.value.id,
          shotIndex,
          originalPath: stored.value.relativePath,
          capturedAt: stored.value.createdAt,
        });
      }

      return { ok: true, value: photos };
    } finally {
      this.running = false;
    }
  }
}
