/**
 * cp1000-color-test.service.ts
 *
 * Dedicated, fully-isolated Color Calibration V2 Generator for Canon SELPHY CP1000.
 *
 * SPECIFICATION (CALIBRATION V2):
 *  - Focus: Fine-tuned Magenta correction / Green reduction testing.
 *  - Takes ONE original Canon 6D photo (5472x3648 in RAM).
 *  - Generates an 1800 × 2700 px (2:3 ratio, 10x15 cm) test sheet.
 *  - Renders 4 identical copies in a 2x2 grid from the SAME original image:
 *      ┌─────────────────────────────┐
 *      │ ORIGINAL     │ M1           │
 *      ├──────────────┼──────────────┤
 *      │ M2           │ M3           │
 *      └─────────────────────────────┘
 *  - Exact Preset Config:
 *      • ORIGINAL: { red: 1.00, green: 1.00, blue: 1.00 } -> R1.00 G1.00 B1.00
 *      • M1:       { red: 1.02, green: 0.98, blue: 1.00 } -> R1.02 G0.98 B1.00
 *      • M2:       { red: 1.03, green: 0.96, blue: 1.01 } -> R1.03 G0.96 B1.01
 *      • M3:       { red: 1.04, green: 0.94, blue: 1.02 } -> R1.04 G0.94 B1.02
 *  - Performs single-pass direct cover crop from raw original sensor pixels.
 *  - Offscreen RGB clamp (0..255) with ZERO saturation, contrast, brightness, gamma, or sharpness alterations.
 *  - Clean multi-line safe-area labels for post-print visual evaluation without covering faces.
 *  - Output: CP1000-magenta-calibration-v2.jpg (quality = 1.0) / CP1000-magenta-calibration-v2.png.
 *
 * NON-REGRESSION INVARIANT:
 *  - Completely isolated from production capture, compose, print, and cloud workflows.
 *  - Can be deleted or bypassed at any time without impacting any photobooth behavior.
 */

import { calculateSourceCropRect, loadImage } from '@/services/render/frame-compositor.service';

export interface ColorPreset {
  id: string;
  name: string;
  formula: string;
  red: number;
  green: number;
  blue: number;
  description: string;
}

export const CP1000_MAGENTA_TEST_PROFILES = Object.freeze({
  original: {
    id: 'ORIGINAL',
    name: 'ORIGINAL',
    formula: 'R1.00 G1.00 B1.00',
    red: 1.00,
    green: 1.00,
    blue: 1.00,
    description: 'Ảnh gốc không chỉnh màu (Baseline chuẩn)',
  },
  m1: {
    id: 'M1',
    name: 'M1',
    formula: 'R1.02 G0.98 B1.00',
    red: 1.02,
    green: 0.98,
    blue: 1.00,
    description: 'Magenta nhẹ: Tăng Red 2%, Giảm Green 2%',
  },
  m2: {
    id: 'M2',
    name: 'M2',
    formula: 'R1.03 G0.96 B1.01',
    red: 1.03,
    green: 0.96,
    blue: 1.01,
    description: 'Magenta trung bình: Tăng Red 3%, Giảm Green 4%, Tăng Blue 1%',
  },
  m3: {
    id: 'M3',
    name: 'M3',
    formula: 'R1.04 G0.94 B1.02',
    red: 1.04,
    green: 0.94,
    blue: 1.02,
    description: 'Magenta mạnh hơn: Tăng Red 4%, Giảm Green 6%, Tăng Blue 2%',
  },
});

export const CP1000_COLOR_PRESETS: readonly ColorPreset[] = Object.freeze([
  CP1000_MAGENTA_TEST_PROFILES.original,
  CP1000_MAGENTA_TEST_PROFILES.m1,
  CP1000_MAGENTA_TEST_PROFILES.m2,
  CP1000_MAGENTA_TEST_PROFILES.m3,
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
  download(fileName?: string, format?: string): void;
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

  // Base canvas paper background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, targetWidth, targetHeight);

  // 2x2 Grid Layout for 10x15 cm sheet (1800x2700 px)
  const halfW = Math.round(targetWidth / 2); // 900 px
  const halfH = Math.round(targetHeight / 2); // 1350 px

  const slotDefs = [
    { preset: CP1000_COLOR_PRESETS[0], x: 0, y: 0, w: halfW, h: halfH },         // Top-Left: ORIGINAL
    { preset: CP1000_COLOR_PRESETS[1], x: halfW, y: 0, w: halfW, h: halfH },     // Top-Right: M1
    { preset: CP1000_COLOR_PRESETS[2], x: 0, y: halfH, w: halfW, h: halfH },     // Bottom-Left: M2
    { preset: CP1000_COLOR_PRESETS[3], x: halfW, y: halfH, w: halfW, h: halfH }, // Bottom-Right: M3
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

      // 3. Apply isolated RGB multiplier if not 1.00 (Zero contrast/saturation alteration)
      const isModified = preset.red !== 1.0 || preset.green !== 1.0 || preset.blue !== 1.0;
      if (isModified) {
        const imgData = slotCtx.getImageData(0, 0, halfW, halfH);
        const data = imgData.data;
        const { red: rMul, green: gMul, blue: bMul } = preset;

        for (let p = 0; p < data.length; p += 4) {
          // Pure RGB multiplier clamped to 0..255
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

    // 5. Draw clean non-intrusive calibration label badge in safe area (away from outer edges)
    ctx.save();
    const badgePaddingX = 24;
    const badgePaddingY = 14;
    const safeMarginX = 36; // Inset from edge to prevent borderless overscan cropping
    const safeMarginY = 36;
    const titleSize = 28;
    const formulaSize = 20;

    // Measure text dimensions
    ctx.font = `bold ${titleSize}px "SF Mono", "Fira Code", monospace, sans-serif`;
    const titleWidth = ctx.measureText(preset.name).width;

    ctx.font = `500 ${formulaSize}px "SF Mono", "Fira Code", monospace, sans-serif`;
    const formulaWidth = ctx.measureText(preset.formula).width;

    const contentWidth = Math.max(titleWidth, formulaWidth);
    const badgeW = contentWidth + badgePaddingX * 2;
    const badgeH = titleSize + formulaSize + badgePaddingY * 2 + 6;

    const badgeX = slot.x + safeMarginX;
    const badgeY = slot.y + slot.h - badgeH - safeMarginY;

    // Dark semi-transparent pill background
    ctx.fillStyle = 'rgba(17, 17, 17, 0.90)';
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 12);
    ctx.fill();

    // Subtle border
    ctx.strokeStyle = preset.id === 'ORIGINAL' ? '#F6C453' : 'rgba(255, 255, 255, 0.40)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Line 1: Preset Name (Bold)
    ctx.font = `bold ${titleSize}px "SF Mono", "Fira Code", monospace, sans-serif`;
    ctx.fillStyle = preset.id === 'ORIGINAL' ? '#F6C453' : '#FFFFFF';
    ctx.textBaseline = 'top';
    ctx.fillText(preset.name, badgeX + badgePaddingX, badgeY + badgePaddingY);

    // Line 2: Exact Formula (Monospace)
    ctx.font = `500 ${formulaSize}px "SF Mono", "Fira Code", monospace, sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillText(preset.formula, badgeX + badgePaddingX, badgeY + badgePaddingY + titleSize + 6);

    ctx.restore();
  }

  // 6. Draw subtle dividing lines between quadrants
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.80)';
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
    download(fileName = 'CP1000-magenta-calibration-v2.jpg', format = 'image/jpeg') {
      const dataUrl = canvas.toDataURL(format, 1.0);
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    },
  };
}
