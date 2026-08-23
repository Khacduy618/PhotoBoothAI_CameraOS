/**
 * print-master.service.ts
 *
 * Dedicated Print Preparation & Layout Service for MomentAI CameraOS.
 * Target Hardware: Canon SELPHY CP1000 (Windows 10 x64, Postcard 100x148mm @ 300 DPI)
 *
 * Responsibilities:
 *  1. Accepts a composed logical product image (from renderFrameComposition / compositionEngine).
 *  2. For STRIP_2 / STRIP_4: duplicates the single 5x15 strip side-by-side onto a physical 10x15
 *     master sheet (1181x1748 / 300 DPI, left 590px, right 591px).
 *  3. For PREMIUM_POSTCARD / SHEET_4 / SHEET_6: outputs the 10x15 physical master directly
 *     (1181x1748 portrait, or 1748x1181 landscape) with aspect-preserving cover fit.
 *  4. Produces deterministic sRGB high-quality JPEG output (quality 0.95).
 */

import {
  CANON_CP1000_PROFILE,
  type PrinterProfile,
} from '@momentai/printer-contract';
import {
  isStripProduct,
  type CanonicalProduct,
} from '@/services/frame/resolveTargetProduct';
import {
  calculateSourceCropRect,
  loadImage,
} from './frame-compositor.service';

export interface BuildPrintMasterOptions {
  logicalProductImage: HTMLCanvasElement | HTMLImageElement | string; // Canvas, Image or Data URL
  targetProduct: CanonicalProduct | string;
  printerProfile?: PrinterProfile;
  isLandscape?: boolean;
  targetCanvas?: HTMLCanvasElement;
  sessionId?: string;
}

export interface PrintMasterResult {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  toDataURL(format?: string, quality?: number): string;
  toBlob(format?: string, quality?: number): Promise<Blob>;
}

export async function buildPrintMaster(
  options: BuildPrintMasterOptions,
): Promise<PrintMasterResult> {
  const {
    logicalProductImage,
    targetProduct,
    printerProfile = CANON_CP1000_PROFILE,
    isLandscape = false,
    targetCanvas,
    sessionId = 'unknown',
  } = options;

  const isStrip = isStripProduct(targetProduct as CanonicalProduct);

  const targetW = isStrip
    ? printerProfile.portrait.widthPx
    : isLandscape
    ? printerProfile.landscape.widthPx
    : printerProfile.portrait.widthPx;

  const targetH = isStrip
    ? printerProfile.portrait.heightPx
    : isLandscape
    ? printerProfile.landscape.heightPx
    : printerProfile.portrait.heightPx;

  if (typeof console !== 'undefined' && console.log) {
    console.log(
      `[PRINT_MASTER_BEGIN]\nsessionId=${sessionId}\nsource=${typeof logicalProductImage === 'string' ? 'data-url' : 'canvas'}\ntargetProduct=${targetProduct}\ntargetWidth=${targetW}\ntargetHeight=${targetH}`,
    );
  }

  const canvas = targetCanvas || document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('[buildPrintMaster] Failed to acquire 2D canvas context');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // White base paper
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, targetW, targetH);

  let sourceImg: HTMLCanvasElement | HTMLImageElement;
  if (typeof logicalProductImage === 'string') {
    sourceImg = await loadImage(logicalProductImage);
  } else {
    sourceImg = logicalProductImage;
  }

  const srcW =
    (sourceImg as HTMLImageElement).naturalWidth ||
    sourceImg.width ||
    1800;
  const srcH =
    (sourceImg as HTMLImageElement).naturalHeight ||
    sourceImg.height ||
    2700;

  if (isStrip) {
    // Physical 100x148mm sheet holds TWO identical 5x15 strips side-by-side.
    // 1181px total width: Left strip = 590px (0..590), Right strip = 591px (590..1181)
    const leftW = 590;
    const rightW = targetW - leftW; // 591 px

    // Left strip crop and render
    const cropLeft = calculateSourceCropRect(srcW, srcH, leftW, targetH, {
      horizontalAnchor: 'center',
      verticalAnchor: 'center',
      fit: 'cover',
    });

    ctx.drawImage(
      sourceImg,
      cropLeft.cropX,
      cropLeft.cropY,
      cropLeft.cropW,
      cropLeft.cropH,
      0,
      0,
      leftW,
      targetH,
    );

    // Right strip crop and render (identical source)
    const cropRight = calculateSourceCropRect(srcW, srcH, rightW, targetH, {
      horizontalAnchor: 'center',
      verticalAnchor: 'center',
      fit: 'cover',
    });

    ctx.drawImage(
      sourceImg,
      cropRight.cropX,
      cropRight.cropY,
      cropRight.cropW,
      cropRight.cropH,
      leftW,
      0,
      rightW,
      targetH,
    );
  } else {
    // Single full 10x15 master sheet (1181x1748 or 1748x1181)
    const crop = calculateSourceCropRect(srcW, srcH, targetW, targetH, {
      horizontalAnchor: 'center',
      verticalAnchor: 'center',
      fit: 'cover',
    });

    ctx.drawImage(
      sourceImg,
      crop.cropX,
      crop.cropY,
      crop.cropW,
      crop.cropH,
      0,
      0,
      targetW,
      targetH,
    );
  }

  const defaultMime = printerProfile.outputMimeType || 'image/jpeg';
  const defaultQuality = printerProfile.jpegQuality || 0.95;

  if (typeof console !== 'undefined' && console.log) {
    console.log(
      `[PRINT_MASTER_COMPLETE]\nsessionId=${sessionId}\nwidth=${targetW}\nheight=${targetH}\nmimeType=${defaultMime}\nquality=${defaultQuality}`,
    );
  }

  return {
    canvas,
    width: targetW,
    height: targetH,
    toDataURL(format = defaultMime, quality = defaultQuality) {
      return canvas.toDataURL(format, quality);
    },
    toBlob(format = defaultMime, quality = defaultQuality) {
      return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else
              reject(
                new Error(
                  '[buildPrintMaster] Failed to generate canvas blob for print master',
                ),
              );
          },
          format,
          quality,
        );
      });
    },
  };
}
