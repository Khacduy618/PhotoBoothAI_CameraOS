import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateProductionPipelineTest } from './production-print-pipeline-test.service';
import { CP1000_PRINT_PROFILE } from '@momentai/printer-contract';

describe('generateProductionPipelineTest', () => {
  const originalImage = globalThis.Image;

  beforeEach(() => {
    // Mock Image class to trigger onload in jsdom/Node test environment
    (globalThis as any).Image = class {
      naturalWidth = 5472;
      naturalHeight = 3648;
      width = 5472;
      height = 3648;
      crossOrigin = '';
      private _src = '';
      onload: (() => void) | null = null;
      onerror: ((e: any) => void) | null = null;
      set src(val: string) {
        this._src = val;
        setTimeout(() => this.onload?.(), 0);
      }
      get src() {
        return this._src;
      }
    };
  });

  afterEach(() => {
    globalThis.Image = originalImage;
  });

  it('A. Generates test print from exact production print pipeline at 1800x2700', async () => {
    // Mock 2D context
    const mockImageData = {
      data: new Uint8ClampedArray(1800 * 2700 * 4),
      width: 1800,
      height: 2700,
    };
    const ctx = {
      fillRect: vi.fn(),
      drawImage: vi.fn(),
      beginPath: vi.fn(),
      rect: vi.fn(),
      clip: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      getImageData: vi.fn().mockReturnValue(mockImageData),
      putImageData: vi.fn(),
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high',
      filter: 'none',
    };

    const mockCanvas = {
      width: 1800,
      height: 2700,
      getContext: vi.fn().mockReturnValue(ctx),
      toDataURL: vi.fn().mockReturnValue('data:image/jpeg;base64,mockProductionTest'),
      toBlob: vi.fn().mockImplementation((cb: (b: Blob) => void) => cb(new Blob(['mock'], { type: 'image/jpeg' }))),
    } as unknown as HTMLCanvasElement;

    const result = await generateProductionPipelineTest('data:image/jpeg;base64,samplePhotoData', {
      targetCanvas: mockCanvas,
    });

    expect(result.dataUrl).toContain('data:image/jpeg;base64');
    expect(CP1000_PRINT_PROFILE.red).toBe(1.03);
    expect(CP1000_PRINT_PROFILE.green).toBe(0.96);
    expect(CP1000_PRINT_PROFILE.blue).toBe(1.01);
  });
});
