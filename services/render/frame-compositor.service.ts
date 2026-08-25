/**
 * frame-compositor.service.ts
 *
 * Single authoritative image composition engine for PhotoBoothAI.
 *
 * Provides:
 *  1. normalizeSlotToPixels() - explicit pixel normalization from 0..1, 0..100, or px
 *  2. calculateSourceCropRect() - pure source-rect cropping (CENTER-horizontal, BOTTOM-vertical, COVER)
 *  3. renderFrameComposition() - single unified canvas renderer for both large preview and final render
 *
 * INVARIANTS:
 *  - destination width  === slotWidthPx exactly
 *  - destination height === slotHeightPx exactly
 *  - aspect ratio of source photo preserved
 *  - every slot fully covered — no white gap
 *  - photo crop fully inside source image bounds
 *  - photo[n] maps to slot[n]
 *  - original frame PNG overlay drawn on top (Layer 10)
 *  - stateless & AbortSignal-compatible (consumer handles local stale protection)
 */

import { HOI_AN_SAMPLE_PHOTOS } from "@/components/momentai-guest-flow/data/hoianSamplePhotos";
import type { FrameTemplate, PhotoItem } from "@/components/momentai-guest-flow/types";

export interface NormalizedSlotPixels {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SourceCropRect {
  cropX: number;
  cropY: number;
  cropW: number;
  cropH: number;
}

export interface SourceCropPolicy {
  horizontalAnchor?: "center" | "left" | "right";
  verticalAnchor?: "bottom" | "center" | "top";
  fit?: "cover" | "contain";
}

/**
 * normalizeSlotToPixels
 *
 * Converts a slot geometry into explicit canvas pixel coordinates.
 * Disambiguates between:
 *  - 0..1 range (normalized unit interval)
 *  - 0..100 range (percentage)
 *  - >100 range (pixel coordinates)
 */
export function normalizeSlotToPixels(
  slot: { x: number; y: number; width: number; height: number },
  frameWidth: number,
  frameHeight: number,
): NormalizedSlotPixels {
  const fw = frameWidth > 0 ? frameWidth : 1800;
  const fh = frameHeight > 0 ? frameHeight : 2700;

  let xPx: number;
  let yPx: number;
  let wPx: number;
  let hPx: number;

  const isUnitInterval =
    slot.width <= 1.0001 &&
    slot.height <= 1.0001 &&
    slot.x <= 1.0001 &&
    slot.y <= 1.0001;

  const isPercent =
    !isUnitInterval &&
    slot.width <= 100.0001 &&
    slot.height <= 100.0001 &&
    slot.x <= 100.0001 &&
    slot.y <= 100.0001;

  if (isUnitInterval) {
    xPx = slot.x * fw;
    yPx = slot.y * fh;
    wPx = slot.width * fw;
    hPx = slot.height * fh;
  } else if (isPercent) {
    xPx = (slot.x / 100) * fw;
    yPx = (slot.y / 100) * fh;
    wPx = (slot.width / 100) * fw;
    hPx = (slot.height / 100) * fh;
  } else {
    xPx = slot.x;
    yPx = slot.y;
    wPx = slot.width;
    hPx = slot.height;
  }

  return {
    x: Math.round(xPx * 100) / 100,
    y: Math.round(yPx * 100) / 100,
    width: Math.round(wPx * 100) / 100,
    height: Math.round(hPx * 100) / 100,
  };
}

/**
 * calculateSourceCropRect
 *
 * Pure math helper calculating the exact source region of an image to sample
 * for a target destination slot.
 *
 * Default Policy:
 *  HORIZONTAL ANCHOR = CENTER (symmetric left/right crop)
 *  VERTICAL ANCHOR   = BOTTOM (bottom of photo aligns with bottom of slot; excess cropped from top)
 *  FIT MODE          = COVER  (slot fully covered, zero aspect distortion)
 */
export function calculateSourceCropRect(
  sourceW: number,
  sourceH: number,
  slotW: number,
  slotH: number,
  policy: SourceCropPolicy = {},
): SourceCropRect {
  const srcW = sourceW > 0 ? sourceW : 1920;
  const srcH = sourceH > 0 ? sourceH : 1080;
  const dstW = slotW > 0 ? slotW : 1;
  const dstH = slotH > 0 ? slotH : 1;

  const hAnchor = policy.horizontalAnchor ?? "center";
  const vAnchor = policy.verticalAnchor ?? "bottom";

  const sourceAspect = srcW / srcH;
  const slotAspect = dstW / dstH;

  let cropX: number;
  let cropY: number;
  let cropW: number;
  let cropH: number;

  if (sourceAspect > slotAspect) {
    cropH = srcH;
    cropW = srcH * slotAspect;
    if (hAnchor === "left") {
      cropX = 0;
    } else if (hAnchor === "right") {
      cropX = srcW - cropW;
    } else {
      cropX = (srcW - cropW) / 2;
    }
    cropY = 0;
  } else {
    cropW = srcW;
    cropH = srcW / slotAspect;
    cropX = 0;
    if (vAnchor === "top") {
      cropY = 0;
    } else if (vAnchor === "center") {
      cropY = (srcH - cropH) / 2;
    } else {
      cropY = srcH - cropH;
    }
  }

  cropX = Math.max(0, Math.min(cropX, srcW - 1));
  cropY = Math.max(0, Math.min(cropY, srcH - 1));
  cropW = Math.max(1, Math.min(cropW, srcW - cropX));
  cropH = Math.max(1, Math.min(cropH, srcH - cropY));

  return {
    cropX: Math.round(cropX * 100) / 100,
    cropY: Math.round(cropY * 100) / 100,
    cropW: Math.round(cropW * 100) / 100,
    cropH: Math.round(cropH * 100) / 100,
  };
}

export interface RenderFrameCompositionOptions {
  frame: FrameTemplate;
  photos: readonly (PhotoItem | null)[];
  overlayUrl?: string;
  targetCanvas?: HTMLCanvasElement;
  cropPolicy?: "cover-bottom-center";
  allowSampleFallback?: boolean;
  signal?: AbortSignal;
}

export interface RenderFrameCompositionResult {
  canvas: HTMLCanvasElement;
  outputWidth: number;
  outputHeight: number;
  slotCrops: Array<{
    slotIndex: number;
    slotPx: NormalizedSlotPixels;
    crop: SourceCropRect;
    photoId: string | null;
  }>;
  toDataURL(format?: string, quality?: number): string;
  toBlob(format?: string, quality?: number): Promise<Blob>;
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error("Failed to load image: " + src.substring(0, 100)));
    img.src = src;
  });
}

/**
 * renderFrameComposition
 *
 * THE single authoritative image composition function for PhotoBoothAI.
 */
export async function renderFrameComposition(
  options: RenderFrameCompositionOptions,
): Promise<RenderFrameCompositionResult> {
  const {
    frame,
    photos,
    overlayUrl = frame.assets?.overlay || (frame as any).assetUrl,
    targetCanvas,
    allowSampleFallback = true,
    signal,
  } = options;

  if (signal?.aborted) {
    throw new DOMException("Composition aborted", "AbortError");
  }

  const isLandscape = frame.orientation === "landscape" || (frame.outputWidth && frame.outputHeight ? frame.outputWidth > frame.outputHeight : false);
  const isStrip = (frame as { targetProduct?: string }).targetProduct === "STRIP_2" || (frame as { targetProduct?: string }).targetProduct === "STRIP_4" || (frame as { preferredPaper?: string }).preferredPaper === "2x6-double";

  let outputWidth = frame.outputWidth || (isStrip ? 3648 : isLandscape ? 10944 : 7392);
  let outputHeight = frame.outputHeight || (isStrip ? 10944 : isLandscape ? 7392 : 10944);

  // If imported image has low resolution (< 1200px width or < 2400px height), upscale render canvas
  // to 1:1 Canon 6D sensor mapping resolution (3648x10944 for Strip, 7392x10944 for Sheet)
  if (outputWidth < 1200 || outputHeight < 2400) {
    const ratio = outputWidth / outputHeight;
    if (isStrip || ratio <= 0.45) {
      outputHeight = 10944;
      outputWidth = Math.round(outputHeight * ratio) || 3648;
    } else if (isLandscape) {
      outputWidth = 10944;
      outputHeight = Math.round(outputWidth / ratio) || 7392;
    } else {
      outputHeight = 10944;
      outputWidth = Math.round(outputHeight * ratio) || 7392;
    }
  }

  const slots = frame.slots || [];

  const canvas = targetCanvas || document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("[renderFrameComposition] Failed to acquire 2D canvas context");
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // 1. Background fill
  const bg = frame.assets?.background;
  ctx.fillStyle = bg && bg !== "transparent" && bg !== "#FDFCFB" ? bg : "#ffffff";
  ctx.fillRect(0, 0, outputWidth, outputHeight);

  const slotCrops = [];
  const isProduction =
    typeof process !== "undefined" && process.env.NODE_ENV === "production";
  const allowFallback = allowSampleFallback && !isProduction;

  // 2. Render each slot with pure source-rect cropping
  for (let i = 0; i < slots.length; i++) {
    if (signal?.aborted) {
      throw new DOMException("Composition aborted", "AbortError");
    }

    const slot = slots[i];
    const slotPx = normalizeSlotToPixels(slot, outputWidth, outputHeight);
    const assignedPhoto = photos[i] ?? null;

    const isProduction =
      typeof process !== "undefined" && process.env.NODE_ENV === "production";
    const allowFallback = allowSampleFallback && !isProduction;

    let imgUrl = assignedPhoto?.dataUrl || null;
    if (!imgUrl) {
      if (allowFallback) {
        imgUrl = HOI_AN_SAMPLE_PHOTOS[i % HOI_AN_SAMPLE_PHOTOS.length];
      } else {
        if (isProduction) {
          throw new Error(`[renderFrameComposition] Missing required photo for slot #${i + 1}`);
        }
        ctx.fillStyle = "#e2e8f0";
        ctx.fillRect(slotPx.x, slotPx.y, slotPx.width, slotPx.height);
        slotCrops.push({
          slotIndex: i + 1,
          slotPx,
          crop: { cropX: 0, cropY: 0, cropW: 0, cropH: 0 },
          photoId: null,
        });
        continue;
      }
    }

    try {
      const img = await loadImage(imgUrl);
      if (signal?.aborted) {
        throw new DOMException("Composition aborted", "AbortError");
      }

      const imgNaturalW = assignedPhoto?.width || img.naturalWidth || img.width || 1920;
      const imgNaturalH = assignedPhoto?.height || img.naturalHeight || img.height || 1080;

      const crop = calculateSourceCropRect(imgNaturalW, imgNaturalH, slotPx.width, slotPx.height, {
        horizontalAnchor: "center",
        verticalAnchor: "bottom",
        fit: "cover",
      });

      // Per-slot hard clip
      ctx.save();
      ctx.beginPath();
      ctx.rect(slotPx.x, slotPx.y, slotPx.width, slotPx.height);
      ctx.clip();

      // Studio PhotoBooth Warm & High-Contrast Color Enhancement:
      // +18% Saturation, +8% Contrast, subtle +4% golden-amber warmth, vibrant skin tone
      if (ctx.filter !== undefined) {
        ctx.filter = "contrast(1.08) saturate(1.18) sepia(0.04)";
      }

      ctx.drawImage(
        img,
        crop.cropX,
        crop.cropY,
        crop.cropW,
        crop.cropH,
        slotPx.x,
        slotPx.y,
        slotPx.width,
        slotPx.height,
      );

      ctx.restore();

      slotCrops.push({
        slotIndex: i + 1,
        slotPx,
        crop,
        photoId: assignedPhoto?.id || "sample-" + (i + 1),
      });
    } catch (err) {
      if (signal?.aborted) throw err;
      if (isProduction) throw err;
      ctx.fillStyle = "#cbd5e1";
      ctx.fillRect(slotPx.x, slotPx.y, slotPx.width, slotPx.height);
    }
  }

  if (signal?.aborted) {
    throw new DOMException("Composition aborted", "AbortError");
  }

  // 3. Draw original PNG overlay on top (Layer 10)
  if (overlayUrl) {
    try {
      const overlayImg = await loadImage(overlayUrl);
      if (signal?.aborted) {
        throw new DOMException("Composition aborted", "AbortError");
      }
      ctx.drawImage(overlayImg, 0, 0, outputWidth, outputHeight);
    } catch (err) {
      console.warn("[renderFrameComposition] Failed to load overlay PNG:", err);
    }
  }

  return {
    canvas,
    outputWidth,
    outputHeight,
    slotCrops,
    toDataURL: (format = "image/jpeg", quality = 0.92) => canvas.toDataURL(format, quality),
    toBlob: (format = "image/jpeg", quality = 0.95) =>
      new Promise((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Failed to create blob from composition canvas"));
          },
          format,
          quality,
        );
      }),
  };
}
