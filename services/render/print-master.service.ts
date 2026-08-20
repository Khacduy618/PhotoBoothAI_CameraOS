/**
 * print-master.service.ts
 *
 * Dedicated Print Layout Service for MomentAI CameraOS.
 *
 * Responsibilities:
 *  1. Accepts a composed logical product image (from renderFrameComposition)
 *  2. For STRIP_2 / STRIP_4: duplicates the single 5x15 strip (2x) side-by-side onto a physical 10x15 master sheet (1800x2700 / 300 DPI).
 *  3. For PREMIUM_POSTCARD / SHEET_4 / SHEET_6: outputs the 10x15 master directly.
 *  4. Produces exactly ONE print master image per requested physical sheet.
 */

import { isStripProduct, type CanonicalProduct } from "@/services/frame/resolveTargetProduct";
import { loadImage } from "./frame-compositor.service";

export interface BuildPrintMasterOptions {
  logicalProductImage: HTMLCanvasElement | string; // Canvas or Data URL
  targetProduct: CanonicalProduct | string;
  masterWidth?: number;  // Default: 1800 (for 10x15 300 DPI)
  masterHeight?: number; // Default: 2700 (for 10x15 300 DPI)
  isLandscape?: boolean;
  targetCanvas?: HTMLCanvasElement;
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
    masterWidth = 1800,
    masterHeight = 2700,
    isLandscape = false,
    targetCanvas,
  } = options;

  const canvas = targetCanvas || document.createElement("canvas");
  const targetW = isLandscape ? masterHeight : masterWidth;
  const targetH = isLandscape ? masterWidth : masterHeight;
  canvas.width = targetW;
  canvas.height = targetH;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("[buildPrintMaster] Failed to acquire 2D canvas context");
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // White paper base
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, targetW, targetH);

  let sourceImg: HTMLCanvasElement | HTMLImageElement;
  if (typeof logicalProductImage === "string") {
    sourceImg = await loadImage(logicalProductImage);
  } else {
    sourceImg = logicalProductImage;
  }

  const isStrip = isStripProduct(targetProduct as CanonicalProduct);

  if (isStrip) {
    // Physical 10x15 sheet holds TWO identical 5x15 strips side-by-side.
    // Left strip: x = 0..halfWidth, Right strip: x = halfWidth..width
    const halfWidth = targetW / 2;

    // Draw Strip 1 (Left)
    ctx.drawImage(sourceImg, 0, 0, halfWidth, targetH);

    // Draw Strip 2 (Right)
    ctx.drawImage(sourceImg, halfWidth, 0, halfWidth, targetH);

    // Subtle cut guide line in the exact middle (1px mark at top/bottom edges)
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(halfWidth, 0);
    ctx.lineTo(halfWidth, 20);
    ctx.moveTo(halfWidth, targetH - 20);
    ctx.lineTo(halfWidth, targetH);
    ctx.stroke();
  } else {
    // Single 10x15 master sheet (covers full sheet)
    ctx.drawImage(sourceImg, 0, 0, targetW, targetH);
  }

  return {
    canvas,
    width: targetW,
    height: targetH,
    toDataURL(format = "image/png", quality = 1.0) {
      return canvas.toDataURL(format, quality);
    },
    toBlob(format = "image/png", quality = 1.0) {
      return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error("[buildPrintMaster] Failed to generate canvas blob"));
          },
          format,
          quality,
        );
      });
    },
  };
}
