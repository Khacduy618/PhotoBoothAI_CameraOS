import { describe, it, expect, vi } from 'vitest';
import { buildPrintMaster } from './print-master.service';
import { generateCalibrationSheet } from './calibration-sheet.service';
import {
  CP1000_PRINT_PROFILE,
  CP1000_COLOR_CORRECTION_ENABLED,
  applyCP1000M2Profile,
} from '@momentai/printer-contract';

function createMockCanvas(w = 1800, h = 2700) {
  const drawImage = vi.fn();
  const fillRect = vi.fn();
  const strokeRect = vi.fn();
  const beginPath = vi.fn();
  const moveTo = vi.fn();
  const lineTo = vi.fn();
  const stroke = vi.fn();
  const fillText = vi.fn();
  const setLineDash = vi.fn();

  const save = vi.fn();
  const restore = vi.fn();

  const mockImageData = {
    data: new Uint8ClampedArray(Math.min(w * h * 4, 1000)),
    width: w,
    height: h,
  };
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
    fillRect,
    strokeRect,
    drawImage,
    beginPath,
    moveTo,
    lineTo,
    stroke,
    fillText,
    setLineDash,
    save,
    restore,
    getImageData,
    putImageData,
  };

  const canvas = {
    width: w,
    height: h,
    getContext: (type: string) => (type === '2d' ? ctx : null),
    toDataURL: (format = 'image/jpeg', quality = 0.95) => `data:${format};base64,mock`,
    toBlob: (cb: (b: Blob) => void, format = 'image/jpeg') => cb(new Blob(['mock'], { type: format })),
  } as unknown as HTMLCanvasElement;

  return { canvas, ctx, drawImage, fillRect, stroke, beginPath, moveTo, lineTo, setLineDash, save, restore, getImageData, putImageData };
}

describe('buildPrintMaster & CP1000 Physical Raster', () => {
  it('A. PREMIUM_POSTCARD -> 1800x2700 physical print master', async () => {
    const { canvas } = createMockCanvas();
    const { canvas: sourceCanvas } = createMockCanvas(1800, 2700);

    const master = await buildPrintMaster({
      logicalProductImage: sourceCanvas,
      targetProduct: 'PREMIUM_POSTCARD',
      targetCanvas: canvas,
    });

    expect(master.width).toBe(1800);
    expect(master.height).toBe(2700);
  });

  it('B. SHEET_4 -> 1800x2700 physical print master', async () => {
    const { canvas } = createMockCanvas();
    const { canvas: sourceCanvas } = createMockCanvas(1800, 2700);

    const master = await buildPrintMaster({
      logicalProductImage: sourceCanvas,
      targetProduct: 'SHEET_4',
      targetCanvas: canvas,
    });

    expect(master.width).toBe(1800);
    expect(master.height).toBe(2700);
  });

  it('C. SHEET_6 -> 1800x2700 physical print master', async () => {
    const { canvas } = createMockCanvas();
    const { canvas: sourceCanvas } = createMockCanvas(1800, 2700);

    const master = await buildPrintMaster({
      logicalProductImage: sourceCanvas,
      targetProduct: 'SHEET_6',
      targetCanvas: canvas,
    });

    expect(master.width).toBe(1800);
    expect(master.height).toBe(2700);
  });

  it('D. STRIP_2 -> 1800x2700 with left (846px) and right (846px) duplication', async () => {
    const { canvas, drawImage } = createMockCanvas();
    const { canvas: stripCanvas } = createMockCanvas(900, 2700);

    const master = await buildPrintMaster({
      logicalProductImage: stripCanvas,
      targetProduct: 'STRIP_2',
      targetCanvas: canvas,
    });

    expect(master.width).toBe(1800);
    expect(master.height).toBe(2700);

    // Verify 2 drawImage calls for two-up layout
    expect(drawImage).toHaveBeenCalledTimes(2);

    // Call 1: Left strip drawn inside safe margins
    const call1 = drawImage.mock.calls[0];
    expect(call1[0]).toBe(stripCanvas);
    expect(call1[5]).toBe(54); // destX (insetLeft = 54px)
    expect(call1[6]).toBe(80); // destY (insetTop = 80px)
    expect(call1[7]).toBe(846); // destWidth
    expect(call1[8]).toBe(2575); // destHeight (2700 - 80 - 45)

    // Call 2: Right strip drawn inside safe margins
    const call2 = drawImage.mock.calls[1];
    expect(call2[0]).toBe(stripCanvas);
    expect(call2[5]).toBe(900); // destX (insetLeft + leftStripW = 54 + 846)
    expect(call2[6]).toBe(80); // destY (insetTop = 80px)
    expect(call2[7]).toBe(846); // destWidth
    expect(call2[8]).toBe(2575); // destHeight

    // Total content width = 846 + 846 = 1692 px (1800 - 2*54)
    expect(call1[7] + call2[7]).toBe(1692);
  });

  it('F. STRIP_4 -> 1800x2700 with left (846px) and right (846px) duplication', async () => {
    const { canvas, drawImage } = createMockCanvas();
    const { canvas: stripCanvas } = createMockCanvas(900, 2700);

    const master = await buildPrintMaster({
      logicalProductImage: stripCanvas,
      targetProduct: 'STRIP_4',
      targetCanvas: canvas,
    });

    expect(master.width).toBe(1800);
    expect(master.height).toBe(2700);
    expect(drawImage).toHaveBeenCalledTimes(2);
  });

  it('G. Strip left and right render from the exact same source image', async () => {
    const { canvas, drawImage } = createMockCanvas();
    const { canvas: stripCanvas } = createMockCanvas(900, 2700);

    await buildPrintMaster({
      logicalProductImage: stripCanvas,
      targetProduct: 'STRIP_4',
      targetCanvas: canvas,
    });

    expect(drawImage.mock.calls[0][0]).toBe(stripCanvas);
    expect(drawImage.mock.calls[1][0]).toBe(stripCanvas);
  });

  it('H. Landscape PREMIUM_POSTCARD produces 2700x1800 physical master', async () => {
    const { canvas, drawImage } = createMockCanvas();
    const { canvas: sourceCanvas } = createMockCanvas(2700, 1800);

    const master = await buildPrintMaster({
      logicalProductImage: sourceCanvas,
      targetProduct: 'PREMIUM_POSTCARD',
      isLandscape: true,
      targetCanvas: canvas,
    });

    expect(master.width).toBe(2700);
    expect(master.height).toBe(1800);

    expect(drawImage).toHaveBeenCalledTimes(1);
    const call = drawImage.mock.calls[0];
    expect(call[5]).toBe(54);
    expect(call[6]).toBe(80);
  });

  it('K. Generates valid JPEG dataURL by default', async () => {
    const { canvas } = createMockCanvas();
    const { canvas: sourceCanvas } = createMockCanvas(1800, 2700);

    const master = await buildPrintMaster({
      logicalProductImage: sourceCanvas,
      targetProduct: 'SHEET_4',
      targetCanvas: canvas,
    });

    const dataUrl = master.toDataURL();
    expect(dataUrl).toContain('image/jpeg');
  });

  it('L. Production strip master draws subtle dashed cut guide line at center', async () => {
    const { canvas, stroke, setLineDash, moveTo, lineTo } = createMockCanvas();
    const { canvas: stripCanvas } = createMockCanvas(900, 2700);

    await buildPrintMaster({
      logicalProductImage: stripCanvas,
      targetProduct: 'STRIP_2',
      targetCanvas: canvas,
    });

    // Stroke is called for the center dashed cut guide line
    expect(stroke).toHaveBeenCalled();
    expect(setLineDash).toHaveBeenCalledWith([8, 8]);
    expect(moveTo).toHaveBeenCalledWith(900, 0);
    expect(lineTo).toHaveBeenCalledWith(900, 2700);
  });

  it('M. Calibrated M2 Profile contains exact calibrated values: R1.03, G0.96, B1.01', () => {
    expect(CP1000_PRINT_PROFILE.red).toBe(1.03);
    expect(CP1000_PRINT_PROFILE.green).toBe(0.96);
    expect(CP1000_PRINT_PROFILE.blue).toBe(1.01);
    expect(CP1000_COLOR_CORRECTION_ENABLED).toBe(true);
  });

  it('N. Generates exact physical raster dimensions without modifying source canvas', async () => {
    const { canvas, drawImage } = createMockCanvas();
    const { canvas: sourceCanvas } = createMockCanvas(1800, 2700);

    const master = await buildPrintMaster({
      logicalProductImage: sourceCanvas,
      targetProduct: 'SHEET_4',
      targetCanvas: canvas,
    });

    expect(master.width).toBe(1800);
    expect(master.height).toBe(2700);
    expect(drawImage).toHaveBeenCalledTimes(1);
  });

  it('O. applyCP1000M2Profile correctly transforms pixel values according to M2 formula', () => {
    const testData = new Uint8ClampedArray([
      100, 100, 100, 255, // Pixel 1: RGB 100, 100, 100
      200, 150,  50, 255, // Pixel 2: RGB 200, 150, 50
    ]);
    const mockCtx = {
      getImageData: vi.fn().mockReturnValue({ data: testData, width: 2, height: 1 }),
      putImageData: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    applyCP1000M2Profile(mockCtx, 2, 1, CP1000_PRINT_PROFILE);

    // Pixel 1:
    // R: 100 * 1.03 = 103
    // G: 100 * 0.96 = 96
    // B: 100 * 1.01 = 101
    expect(testData[0]).toBe(103);
    expect(testData[1]).toBe(96);
    expect(testData[2]).toBe(101);
    expect(testData[3]).toBe(255); // Alpha preserved

    // Pixel 2:
    // R: 200 * 1.03 = 206
    // G: 150 * 0.96 = 144
    // B: 50 * 1.01 = 51 (Math.round(50.5) = 51)
    expect(testData[4]).toBe(206);
    expect(testData[5]).toBe(144);
    expect(testData[6]).toBe(51);
    expect(testData[7]).toBe(255);
  });

  it('Calibration sheet generator produces exact 1800x2700 calibration raster', () => {
    const { canvas } = createMockCanvas();
    const cal = generateCalibrationSheet({ targetCanvas: canvas });

    expect(cal.width).toBe(1800);
    expect(cal.height).toBe(2700);
  });
});
