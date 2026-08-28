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
  const vAnchor = policy.verticalAnchor ?? "center";

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
    } else if (vAnchor === "bottom") {
      cropY = srcH - cropH;
    } else {
      cropY = (srcH - cropH) / 2;
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
  /**
   * Target stream mode:
   *  - 'digital' (default): applies studio digital enhancement `contrast(1.08) saturate(1.18) sepia(0.04)` for Large Preview, QR, and Cloud.
   *  - 'print': for CP1000 physical printing; skips digital filter and applies calibrated M2 RGB multipliers strictly to the photo slots before frame/overlay composition.
   */
  streamMode?: 'digital' | 'print';
  colorProfile?: { readonly red: number; readonly green: number; readonly blue: number };
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
    streamMode = 'digital',
    colorProfile,
  } = options;

  if (signal?.aborted) {
    throw new DOMException("Composition aborted", "AbortError");
  }

  const isStrip =
    (frame as { targetProduct?: string }).targetProduct === "STRIP_2" ||
    (frame as { targetProduct?: string }).targetProduct === "STRIP_4" ||
    (frame as { preferredPaper?: string }).preferredPaper === "2x6-double" ||
    frame.layout?.type === "1x2" ||
    frame.layout?.type === "1x4" ||
    (frame.slots && frame.slots.length === 2) ||
    (frame.slots && frame.slots.length === 4 && (!frame.outputWidth || !frame.outputHeight || frame.outputHeight >= frame.outputWidth * 1.8));

  const isLandscape = !isStrip && (frame.orientation === "landscape" || (frame.outputWidth && frame.outputHeight ? frame.outputWidth > frame.outputHeight : false));

  // Authoritative photobooth canvas resolution for Canon CP1000 (10x15 cm @ 450 DPI):
  //  - Portrait (Sheet 4, Sheet 6, Premium Postcard): 1800 x 2700 px (2:3 ratio)
  //  - Landscape: 2700 x 1800 px (3:2 ratio)
  //  - Strip (Single 5x15 cm strip): 900 x 2700 px (1:3 ratio)
  const defaultW = isStrip ? 900 : isLandscape ? 2700 : 1800;
  const defaultH = isStrip ? 2700 : isLandscape ? 1800 : 2700;

  const rawWidth = frame.outputWidth || defaultW;
  const outputHeight = frame.outputHeight || defaultH;
  const outputWidth = isStrip && rawWidth >= outputHeight * 0.45 ? Math.round(outputHeight / 3) : rawWidth;

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
    console.log(`[renderFrameComposition] Slot #${i + 1} imgUrl length: ${imgUrl?.length || 0}, prefix: ${imgUrl?.slice(0, 40) || 'NULL'}`);
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

      const imgNaturalW = img.naturalWidth || img.width || assignedPhoto?.width || 5472;
      const imgNaturalH = img.naturalHeight || img.height || assignedPhoto?.height || 3648;

      const crop = calculateSourceCropRect(imgNaturalW, imgNaturalH, slotPx.width, slotPx.height, {
        horizontalAnchor: "center",
        verticalAnchor: "center",
        fit: "cover",
      });

      // Per-slot hard clip
      ctx.save();
      ctx.beginPath();
      ctx.rect(slotPx.x, slotPx.y, slotPx.width, slotPx.height);
      ctx.clip();

      if (streamMode === 'print') {
        // CP1000 PRINT STREAM:
        //  1. Zero digital filters (NO contrast, saturate, or sepia)
        //  2. Direct 1-pass crop & downscale from Canon 6D original
        //  3. Apply calibrated M2 RGB multipliers strictly to slot photo pixels
        ctx.filter = 'none';

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

        if (colorProfile && (colorProfile.red !== 1.0 || colorProfile.green !== 1.0 || colorProfile.blue !== 1.0)) {
          const slotImgData = ctx.getImageData(slotPx.x, slotPx.y, slotPx.width, slotPx.height);
          const d = slotImgData.data;
          const { red: rMul, green: gMul, blue: bMul } = colorProfile;

          for (let p = 0; p < d.length; p += 4) {
            d[p] = Math.min(255, Math.max(0, Math.round(d[p] * rMul)));
            d[p + 1] = Math.min(255, Math.max(0, Math.round(d[p + 1] * gMul)));
            d[p + 2] = Math.min(255, Math.max(0, Math.round(d[p + 2] * bMul)));
          }

          ctx.putImageData(slotImgData, slotPx.x, slotPx.y);
        }
      } else {
        // DIGITAL STREAM (Large Preview, QR, Cloud, Digital Master):
        // Studio PhotoBooth Warm & High-Contrast Color Enhancement:
        // +18% Saturation, +8% Contrast, subtle +4% golden-amber warmth, vibrant skin tone
        if (ctx.filter !== undefined) {
          ctx.filter = 'contrast(1.08) saturate(1.18) sepia(0.04)';
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
      }

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

  if (streamMode === 'print' && typeof console !== 'undefined' && console.log) {
    console.log(
      `[PRINT_COMPOSITOR_AUDIT]\nstreamMode=PRINT\nphotoFilter=NONE\nm2CorrectionApplied=${Boolean(colorProfile)}\nm2Formula=R${colorProfile?.red || 1.0} G${colorProfile?.green || 1.0} B${colorProfile?.blue || 1.0}\nframeOverlayCorrection=NONE\noutputSize=${outputWidth}x${outputHeight}`,
    );
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
