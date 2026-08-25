import { describe, it, expect, vi } from 'vitest';
import { buildPrintMaster } from './print-master.service';
import { generateCalibrationSheet } from './calibration-sheet.service';

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
  };

  const canvas = {
    width: w,
    height: h,
    getContext: (type: string) => (type === '2d' ? ctx : null),
    toDataURL: (format = 'image/jpeg', quality = 0.95) => `data:${format};base64,mock`,
    toBlob: (cb: (b: Blob) => void, format = 'image/jpeg') => cb(new Blob(['mock'], { type: format })),
  } as unknown as HTMLCanvasElement;

  return { canvas, ctx, drawImage, fillRect, stroke, beginPath, moveTo, lineTo, setLineDash, save, restore };
}

describe('buildPrintMaster & CP1000 Physical Raster', () => {
  it('A. PREMIUM_POSTCARD -> 2362x3496 physical print master', async () => {
    const { canvas } = createMockCanvas();
    const { canvas: sourceCanvas } = createMockCanvas(1800, 2700);

    const master = await buildPrintMaster({
      logicalProductImage: sourceCanvas,
      targetProduct: 'PREMIUM_POSTCARD',
      targetCanvas: canvas,
    });

    expect(master.width).toBe(2362);
    expect(master.height).toBe(3496);
  });

  it('B. SHEET_4 -> 2362x3496 physical print master', async () => {
    const { canvas } = createMockCanvas();
    const { canvas: sourceCanvas } = createMockCanvas(1800, 2700);

    const master = await buildPrintMaster({
      logicalProductImage: sourceCanvas,
      targetProduct: 'SHEET_4',
      targetCanvas: canvas,
    });

    expect(master.width).toBe(2362);
    expect(master.height).toBe(3496);
  });

  it('C. SHEET_6 -> 2362x3496 physical print master', async () => {
    const { canvas } = createMockCanvas();
    const { canvas: sourceCanvas } = createMockCanvas(1800, 2700);

    const master = await buildPrintMaster({
      logicalProductImage: sourceCanvas,
      targetProduct: 'SHEET_6',
      targetCanvas: canvas,
    });

    expect(master.width).toBe(2362);
    expect(master.height).toBe(3496);
  });

  it('D. STRIP_2 -> 2362x3496 with left (1110px) and right (1110px) duplication', async () => {
    const { canvas, drawImage } = createMockCanvas();
    const { canvas: stripCanvas } = createMockCanvas(900, 2700);

    const master = await buildPrintMaster({
      logicalProductImage: stripCanvas,
      targetProduct: 'STRIP_2',
      targetCanvas: canvas,
    });

    expect(master.width).toBe(2362);
    expect(master.height).toBe(3496);

    // Verify 2 drawImage calls for two-up layout
    expect(drawImage).toHaveBeenCalledTimes(2);

    // Call 1: Left strip drawn inside safe margins (Left: 71px, Top: 118px)
    const call1 = drawImage.mock.calls[0];
    expect(call1[0]).toBe(stripCanvas);
    expect(call1[5]).toBe(71); // destX (insetLeft = 3mm = 71px)
    expect(call1[6]).toBe(118); // destY (insetTop = 5mm = 118px)
    expect(call1[7]).toBe(1110); // destWidth
    expect(call1[8]).toBe(3307); // destHeight (3496 - 118 - 71)

    // Call 2: Right strip drawn inside safe margins (Right: 71px)
    const call2 = drawImage.mock.calls[1];
    expect(call2[0]).toBe(stripCanvas);
    expect(call2[5]).toBe(1181); // destX (insetLeft + leftStripW = 71 + 1110)
    expect(call2[6]).toBe(118); // destY (insetTop = 5mm = 118px)
    expect(call2[7]).toBe(1110); // destWidth
    expect(call2[8]).toBe(3307); // destHeight

    // Total content width = 1110 + 1110 = 2220 px (2362 - 2*71)
    expect(call1[7] + call2[7]).toBe(2220);
  });

  it('F. STRIP_4 -> 2362x3496 with left (1110px) and right (1110px) duplication', async () => {
    const { canvas, drawImage } = createMockCanvas();
    const { canvas: stripCanvas } = createMockCanvas(900, 2700);

    const master = await buildPrintMaster({
      logicalProductImage: stripCanvas,
      targetProduct: 'STRIP_4',
      targetCanvas: canvas,
    });

    expect(master.width).toBe(2362);
    expect(master.height).toBe(3496);
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

  it('H. Landscape PREMIUM_POSTCARD produces 3496x2362 physical master', async () => {
    const { canvas, drawImage } = createMockCanvas();
    const { canvas: sourceCanvas } = createMockCanvas(2700, 1800);

    const master = await buildPrintMaster({
      logicalProductImage: sourceCanvas,
      targetProduct: 'PREMIUM_POSTCARD',
      isLandscape: true,
      targetCanvas: canvas,
    });

    expect(master.width).toBe(3496);
    expect(master.height).toBe(2362);

    expect(drawImage).toHaveBeenCalledTimes(1);
    const call = drawImage.mock.calls[0];
    expect(call[5]).toBe(71);
    expect(call[6]).toBe(118);
    expect(call[7]).toBe(3354);
    expect(call[8]).toBe(2173);
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
    expect(moveTo).toHaveBeenCalledWith(1181, 0);
    expect(lineTo).toHaveBeenCalledWith(1181, 3496);
  });

  it('Calibration sheet generator produces exact 2362x3496 calibration raster', () => {
    const { canvas } = createMockCanvas();
    const cal = generateCalibrationSheet({ targetCanvas: canvas });

    expect(cal.width).toBe(2362);
    expect(cal.height).toBe(3496);
  });
});
