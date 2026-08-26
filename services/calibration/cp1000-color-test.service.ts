/**
 * cp1000-color-test.service.ts
 *
 * Dedicated, fully-isolated Color Calibration Test Generator for Canon SELPHY CP1000.
 *
 * SPECIFICATION:
 *  - Takes ONE original Canon 6D photo (5472x3648 in RAM)
 *  - Generates an 1800 × 2700 px (2:3 ratio, 10x15 cm) test sheet
 *  - Renders 4 identical copies in a 2x2 grid, each with an exact RGB multiplier preset:
 *      1. ORIGINAL:   { r: 1.00, g: 1.00, b: 1.00 }
 *      2. WARMER:     { r: 1.06, g: 1.00, b: 0.94 }
 *      3. +MAGENTA:   { r: 1.05, g: 0.94, b: 1.03 }
 *      4. LESS BLUE:  { r: 1.00, g: 1.00, b: 0.90 }
 *  - Performs single-pass direct cover crop from raw original sensor pixels
 *  - Offscreen RGB clamp (0..255) with zero saturation/contrast/gamma alteration
 *  - Clean corner labels identifying each quadrant for post-print visual evaluation
 *  - Output: 1800x2700 JPEG (quality 1.0) / PNG
 *
 * NON-REGRESSION INVARIANT:
 *  - Completely isolated from production capture, compose, print, and cloud workflows.
 *  - Can be deleted or bypassed at any time without impacting any photobooth behavior.
 */

import { calculateSourceCropRect, loadImage } from '@/services/render/frame-compositor.service';

export interface ColorPreset {
  id: string;
  name: string;
  label: string;
  red: number;
  green: number;
  blue: number;
  description: string;
}

export const CP1000_COLOR_PRESETS: readonly ColorPreset[] = Object.freeze([
  {
    id: 'ORIGINAL',
    name: 'ORIGINAL',
    label: '1. ORIGINAL (1.00 / 1.00 / 1.00)',
    red: 1.00,
    green: 1.00,
    blue: 1.00,
    description: 'Ảnh gốc không chỉnh màu (Baseline chuẩn)',
  },
  {
    id: 'WARMER',
    name: 'WARMER',
    label: '2. WARMER (R+6% / G+0% / B-6%)',
    red: 1.06,
    green: 1.00,
    blue: 0.94,
    description: 'Ấm hơn: Tăng Red 6%, giảm Blue 6% (khắc phục ảnh in CP1000 bị lạnh/xanh)',
  },
  {
    id: 'PLUS_MAGENTA',
    name: '+MAGENTA',
    label: '3. +MAGENTA (R+5% / G-6% / B+3%)',
    red: 1.05,
    green: 0.94,
    blue: 1.03,
    description: 'Thêm Magenta: Giảm Green 6%, tăng Red/Blue (khắc phục ảnh in bị ngả xanh lá/Cyan)',
  },
  {
    id: 'LESS_BLUE',
    name: 'LESS BLUE',
    label: '4. LESS BLUE (R+0% / G+0% / B-10%)',
    red: 1.00,
    green: 1.00,
    blue: 0.90,
    description: 'Giảm Blue 10%: Kiểm tra thành phần Blue có đang quá mạnh trên giấy in CP1000',
  },
]);

export interface CP1000ColorTestOptions {
  sourceImage: HTMLImageElement | HTMLCanvasElement | Blob | string;
  frameOverlayUrl?: string;
  targetWidth?: number;
  targetHeight?: number;
  targetCanvas?: HTMLCanvasElement;
}

export interface CP1000ColorTestResult {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  toBlob(format?: string, quality?: number): Promise<Blob>;
  toDataURL(format?: string, quality?: number): string;
  download(fileName?: string): void;
}

export async function createCP1000ColorTest(
  options: CP1000ColorTestOptions,
): Promise<CP1000ColorTestResult> {
  const {
    sourceImage,
    frameOverlayUrl,
    targetWidth = 1800,
    targetHeight = 2700,
    targetCanvas,
  } = options;

  let loadedImg: HTMLImageElement | HTMLCanvasElement;
  if (typeof sourceImage === 'string') {
    loadedImg = await loadImage(sourceImage);
  } else if (sourceImage instanceof Blob) {
    const blobUrl = URL.createObjectURL(sourceImage);
    try {
      loadedImg = await loadImage(blobUrl);
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
  } else {
    loadedImg = sourceImage;
  }

  const srcW = (loadedImg as HTMLImageElement).naturalWidth || loadedImg.width || 5472;
  const srcH = (loadedImg as HTMLImageElement).naturalHeight || loadedImg.height || 3648;

  const canvas = targetCanvas || document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('[createCP1000ColorTest] Failed to acquire 2D canvas context');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // White base paper
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, targetWidth, targetHeight);

  // 2x2 Grid Layout for 10x15 cm sheet (1800x2700 px)
  const halfW = Math.round(targetWidth / 2); // 900 px
  const halfH = Math.round(targetHeight / 2); // 1350 px

  const slotDefs = [
    { preset: CP1000_COLOR_PRESETS[0], x: 0, y: 0, w: halfW, h: halfH },
    { preset: CP1000_COLOR_PRESETS[1], x: halfW, y: 0, w: halfW, h: halfH },
    { preset: CP1000_COLOR_PRESETS[2], x: 0, y: halfH, w: halfW, h: halfH },
    { preset: CP1000_COLOR_PRESETS[3], x: halfW, y: halfH, w: halfW, h: halfH },
  ];

  // Calculate exact cover-crop coordinates directly on original 5472x3648 sensor pixels
  const crop = calculateSourceCropRect(srcW, srcH, halfW, halfH, {
    horizontalAnchor: 'center',
    verticalAnchor: 'center',
    fit: 'cover',
  });

  // Offscreen canvas for isolated slot pixel processing
  const slotCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (slotCanvas) {
    slotCanvas.width = halfW;
    slotCanvas.height = halfH;
  }
  const slotCtx = slotCanvas?.getContext('2d', { willReadFrequently: true }) || null;

  if (slotCtx) {
    slotCtx.imageSmoothingEnabled = true;
    slotCtx.imageSmoothingQuality = 'high';
  }

  for (let i = 0; i < slotDefs.length; i++) {
    const slot = slotDefs[i];
    const { preset } = slot;

    if (slotCtx && slotCanvas) {
      // 1. Clear offscreen canvas
      slotCtx.clearRect(0, 0, halfW, halfH);

      // 2. Single-pass high-quality draw directly from original 5472x3648 image
      slotCtx.drawImage(
        loadedImg,
        crop.cropX,
        crop.cropY,
        crop.cropW,
        crop.cropH,
        0,
        0,
        halfW,
        halfH,
      );

      // 3. Apply isolated RGB multiplier if not 1.00
      const isModified = preset.red !== 1.0 || preset.green !== 1.0 || preset.blue !== 1.0;
      if (isModified) {
        const imgData = slotCtx.getImageData(0, 0, halfW, halfH);
        const data = imgData.data;
        const { red: rMul, green: gMul, blue: bMul } = preset;

        for (let p = 0; p < data.length; p += 4) {
          // Pure RGB multiplier clamped to 0..255 (Zero contrast/saturation alteration)
          data[p] = Math.min(255, Math.max(0, Math.round(data[p] * rMul)));
          data[p + 1] = Math.min(255, Math.max(0, Math.round(data[p + 1] * gMul)));
          data[p + 2] = Math.min(255, Math.max(0, Math.round(data[p + 2] * bMul)));
        }

        slotCtx.putImageData(imgData, 0, 0);
      }

      // 4. Draw slot to main master canvas
      ctx.drawImage(slotCanvas, slot.x, slot.y);
    } else {
      ctx.drawImage(
        loadedImg,
        crop.cropX,
        crop.cropY,
        crop.cropW,
        crop.cropH,
        slot.x,
        slot.y,
        slot.w,
        slot.h,
      );
    }

    // 5. Draw clean non-intrusive calibration label badge
    ctx.save();
    const badgePaddingX = 24;
    const badgePaddingY = 12;
    const badgeMargin = 28;
    const fontSize = 28;

    ctx.font = `bold ${fontSize}px "SF Mono", "Fira Code", monospace, sans-serif`;
    const labelText = preset.name;
    const formulaText =
      preset.id === 'ORIGINAL'
        ? 'RGB 100%'
        : preset.id === 'WARMER'
        ? 'R+6% B-6%'
        : preset.id === 'PLUS_MAGENTA'
        ? 'R+5% G-6% B+3%'
        : 'B-10%';

    const fullBadgeText = `${labelText} [${formulaText}]`;
    const textMetrics = ctx.measureText(fullBadgeText);
    const badgeW = textMetrics.width + badgePaddingX * 2;
    const badgeH = fontSize + badgePaddingY * 2;

    const badgeX = slot.x + badgeMargin;
    const badgeY = slot.y + slot.h - badgeH - badgeMargin;

    // Dark semi-transparent pill background
    ctx.fillStyle = 'rgba(17, 17, 17, 0.88)';
    ctx.beginPath();
    const radius = 10;
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, radius);
    ctx.fill();

    // Subtle border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // High-contrast gold & white text
    ctx.fillStyle = preset.id === 'ORIGINAL' ? '#F6C453' : '#FFFFFF';
    ctx.textBaseline = 'middle';
    ctx.fillText(fullBadgeText, badgeX + badgePaddingX, badgeY + badgeH / 2 + 1);
    ctx.restore();
  }

  // 6. Draw subtle dividing lines between quadrants
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.lineWidth = 3;
  // Center vertical line
  ctx.beginPath();
  ctx.moveTo(halfW, 0);
  ctx.lineTo(halfW, targetHeight);
  ctx.stroke();
  // Center horizontal line
  ctx.beginPath();
  ctx.moveTo(0, halfH);
  ctx.lineTo(targetWidth, halfH);
  ctx.stroke();
  ctx.restore();

  // 7. Draw optional PNG frame overlay if provided
  if (frameOverlayUrl) {
    try {
      const overlayImg = await loadImage(frameOverlayUrl);
      ctx.drawImage(overlayImg, 0, 0, targetWidth, targetHeight);
    } catch (err) {
      console.warn('[createCP1000ColorTest] Optional frame overlay failed to load:', err);
    }
  }

  return {
    canvas,
    width: targetWidth,
    height: targetHeight,
    toBlob(format = 'image/jpeg', quality = 1.0) {
      return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('[createCP1000ColorTest] Failed to export blob'));
          },
          format,
          quality,
        );
      });
    },
    toDataURL(format = 'image/jpeg', quality = 1.0) {
      return canvas.toDataURL(format, quality);
    },
    download(fileName = 'CP1000-color-calibration-test.jpg') {
      const dataUrl = canvas.toDataURL('image/jpeg', 1.0);
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    },
  };
}
