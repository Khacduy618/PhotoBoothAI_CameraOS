import { describe, it, expect, vi } from 'vitest';
import {
  CP1000_COLOR_PRESETS,
  createCP1000ColorTest,
} from './cp1000-color-test.service';

function createMockCanvas(w = 1800, h = 2700) {
  const drawImage = vi.fn();
  const fillRect = vi.fn();
  const strokeRect = vi.fn();
  const beginPath = vi.fn();
  const moveTo = vi.fn();
  const lineTo = vi.fn();
  const stroke = vi.fn();
  const fill = vi.fn();
  const fillText = vi.fn();
  const roundRect = vi.fn();
  const save = vi.fn();
  const restore = vi.fn();
  const clearRect = vi.fn();

  const mockImageData = {
    data: new Uint8ClampedArray(900 * 1350 * 4),
    width: 900,
    height: 1350,
  };
  // Fill sample pixels (r: 100, g: 100, b: 100, a: 255)
  for (let i = 0; i < mockImageData.data.length; i += 4) {
    mockImageData.data[i] = 100;
    mockImageData.data[i + 1] = 100;
    mockImageData.data[i + 2] = 100;
    mockImageData.data[i + 3] = 255;
  }

  const getImageData = vi.fn().mockReturnValue(mockImageData);
  const putImageData = vi.fn();

  const ctx = {
    fillStyle: '#ffffff',
    strokeStyle: '#000000',
    lineWidth: 1,
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high',
    font: '',
    textAlign: '',
    textBaseline: '',
    measureText: vi.fn().mockReturnValue({ width: 200 }),
    fillRect,
    strokeRect,
    drawImage,
    beginPath,
    moveTo,
    lineTo,
    stroke,
    fill,
    fillText,
    roundRect,
    save,
    restore,
    clearRect,
    getImageData,
    putImageData,
  };

  const canvas = {
    width: w,
    height: h,
    getContext: () => ctx,
    toDataURL: (format = 'image/jpeg', quality = 1.0) => `data:${format};base64,mockCalibrationResult`,
    toBlob: (cb: (b: Blob) => void, format = 'image/jpeg') => cb(new Blob(['mockCalibrationResult'], { type: format })),
  } as unknown as HTMLCanvasElement;

  return { canvas, ctx, drawImage, getImageData, putImageData };
}

describe('CP1000 Color Calibration Test Service', () => {
  it('1. Has exact 4 specified presets with exact RGB multipliers', () => {
    expect(CP1000_COLOR_PRESETS).toHaveLength(4);

    // 1. ORIGINAL
    expect(CP1000_COLOR_PRESETS[0].id).toBe('ORIGINAL');
    expect(CP1000_COLOR_PRESETS[0].red).toBe(1.00);
    expect(CP1000_COLOR_PRESETS[0].green).toBe(1.00);
    expect(CP1000_COLOR_PRESETS[0].blue).toBe(1.00);

    // 2. WARMER
    expect(CP1000_COLOR_PRESETS[1].id).toBe('WARMER');
    expect(CP1000_COLOR_PRESETS[1].red).toBe(1.06);
    expect(CP1000_COLOR_PRESETS[1].green).toBe(1.00);
    expect(CP1000_COLOR_PRESETS[1].blue).toBe(0.94);

    // 3. +MAGENTA
    expect(CP1000_COLOR_PRESETS[2].id).toBe('PLUS_MAGENTA');
    expect(CP1000_COLOR_PRESETS[2].red).toBe(1.05);
    expect(CP1000_COLOR_PRESETS[2].green).toBe(0.94);
    expect(CP1000_COLOR_PRESETS[2].blue).toBe(1.03);

    // 4. LESS BLUE
    expect(CP1000_COLOR_PRESETS[3].id).toBe('LESS_BLUE');
    expect(CP1000_COLOR_PRESETS[3].red).toBe(1.00);
    expect(CP1000_COLOR_PRESETS[3].green).toBe(1.00);
    expect(CP1000_COLOR_PRESETS[3].blue).toBe(0.90);
  });

  it('2. Generates exact 1800x2700 calibration sheet with 4 quadrants', async () => {
    const { canvas } = createMockCanvas(1800, 2700);
    const { canvas: mockSource } = createMockCanvas(5472, 3648);

    const result = await createCP1000ColorTest({
      sourceImage: mockSource,
      targetCanvas: canvas,
      targetWidth: 1800,
      targetHeight: 2700,
    });

    expect(result.width).toBe(1800);
    expect(result.height).toBe(2700);

    const dataUrl = result.toDataURL();
    expect(dataUrl).toContain('image/jpeg');

    const blob = await result.toBlob();
    expect(blob).toBeInstanceOf(Blob);
  });
});
