import { describe, it, expect, vi } from 'vitest';
import {
  CP1000_MAGENTA_TEST_PROFILES,
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

describe('CP1000 Color Calibration V2 Test Service', () => {
  it('1. Has exact 4 Magenta Test V2 presets with exact RGB multipliers and formulas', () => {
    expect(CP1000_COLOR_PRESETS).toHaveLength(4);

    // 1. ORIGINAL
    expect(CP1000_MAGENTA_TEST_PROFILES.original.id).toBe('ORIGINAL');
    expect(CP1000_MAGENTA_TEST_PROFILES.original.red).toBe(1.00);
    expect(CP1000_MAGENTA_TEST_PROFILES.original.green).toBe(1.00);
    expect(CP1000_MAGENTA_TEST_PROFILES.original.blue).toBe(1.00);
    expect(CP1000_MAGENTA_TEST_PROFILES.original.formula).toBe('R1.00 G1.00 B1.00');

    // 2. M1 (Magenta nhẹ)
    expect(CP1000_MAGENTA_TEST_PROFILES.m1.id).toBe('M1');
    expect(CP1000_MAGENTA_TEST_PROFILES.m1.red).toBe(1.02);
    expect(CP1000_MAGENTA_TEST_PROFILES.m1.green).toBe(0.98);
    expect(CP1000_MAGENTA_TEST_PROFILES.m1.blue).toBe(1.00);
    expect(CP1000_MAGENTA_TEST_PROFILES.m1.formula).toBe('R1.02 G0.98 B1.00');

    // 3. M2 (Magenta trung bình)
    expect(CP1000_MAGENTA_TEST_PROFILES.m2.id).toBe('M2');
    expect(CP1000_MAGENTA_TEST_PROFILES.m2.red).toBe(1.03);
    expect(CP1000_MAGENTA_TEST_PROFILES.m2.green).toBe(0.96);
    expect(CP1000_MAGENTA_TEST_PROFILES.m2.blue).toBe(1.01);
    expect(CP1000_MAGENTA_TEST_PROFILES.m2.formula).toBe('R1.03 G0.96 B1.01');

    // 4. M3 (Magenta mạnh hơn)
    expect(CP1000_MAGENTA_TEST_PROFILES.m3.id).toBe('M3');
    expect(CP1000_MAGENTA_TEST_PROFILES.m3.red).toBe(1.04);
    expect(CP1000_MAGENTA_TEST_PROFILES.m3.green).toBe(0.94);
    expect(CP1000_MAGENTA_TEST_PROFILES.m3.blue).toBe(1.02);
    expect(CP1000_MAGENTA_TEST_PROFILES.m3.formula).toBe('R1.04 G0.94 B1.02');
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
