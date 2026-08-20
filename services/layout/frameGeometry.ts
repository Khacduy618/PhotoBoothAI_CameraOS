export interface SlotInput {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FocalPoint {
  x: number; // 0..1 (default 0.5)
  y: number; // 0..1 (default 0.5)
}

export interface PhotoLayerGeometryInput {
  canvasWidth: number;
  canvasHeight: number;
  slot: SlotInput;
  imageWidth: number;
  imageHeight: number;
  fitMode?: 'cover' | 'contain' | 'fill';
  focalPoint?: FocalPoint;
  debugScale?: number;
}

export interface PhotoLayerGeometryOutput {
  slotX: number;
  slotY: number;
  slotWidth: number;
  slotHeight: number;
  slotCenterX: number;
  slotCenterY: number;

  photoX: number;
  photoY: number;
  photoWidth: number;
  photoHeight: number;
  photoCenterX: number;
  photoCenterY: number;

  scale: number;

  // DOM Percentages (Global Canvas Relative)
  leftPct: number;
  topPct: number;
  widthPct: number;
  heightPct: number;

  // DOM Percentages (Slot Clip Relative)
  slotLeftPct: number;
  slotTopPct: number;
  slotWidthPct: number;
  slotHeightPct: number;

  localLeftPct: number;
  localTopPct: number;
  localWidthPct: number;
  localHeightPct: number;
}

export const normalizePercent = (val: number): number => (val <= 1 && val > 0 ? val * 100 : val);

/**
 * SourceCropRect — the region of the source photo to read from for one slot.
 *
 * Used with the 9-argument form of ctx.drawImage():
 *
 *   ctx.drawImage(img, cropX, cropY, cropW, cropH, slotX, slotY, slotW, slotH)
 *
 * This guarantees:
 *  - destination width  = slotW exactly
 *  - destination height = slotH exactly
 *  - aspect ratio preserved
 *  - slot fully covered (no white gaps)
 *  - no photo extends beyond its destination rect
 *  - horizontal anchor = CENTER
 *  - vertical anchor   = BOTTOM (excess cropped from the TOP)
 */
export interface SourceCropRect {
  cropX: number;
  cropY: number;
  cropW: number;
  cropH: number;
}

/**
 * calculateSourceCropRect
 *
 * Given a source image and a target slot, returns the source rectangle that
 * should be drawn into the slot using cover + center-horizontal + bottom-vertical anchoring.
 *
 * Policy:
 *  HORIZONTAL ANCHOR = CENTER (symmetric left/right crop)
 *  VERTICAL ANCHOR   = BOTTOM (bottom of photo aligns with bottom of slot; excess cropped from top)
 *  FIT MODE          = COVER  (slot fully filled, no empty space)
 *
 * @param sourceW  Natural width of the source image (pixels)
 * @param sourceH  Natural height of the source image (pixels)
 * @param slotW    Width of the destination slot (pixels, any coordinate space)
 * @param slotH    Height of the destination slot (pixels, any coordinate space)
 */
export function calculateSourceCropRect(
  sourceW: number,
  sourceH: number,
  slotW: number,
  slotH: number,
): SourceCropRect {
  const srcW = sourceW > 0 ? sourceW : 1920;
  const srcH = sourceH > 0 ? sourceH : 1080;
  const dstW = slotW > 0 ? slotW : 1;
  const dstH = slotH > 0 ? slotH : 1;

  const sourceAspect = srcW / srcH;
  const slotAspect   = dstW / dstH;

  let cropX: number;
  let cropY: number;
  let cropW: number;
  let cropH: number;

  if (sourceAspect > slotAspect) {
    // Source is WIDER than slot → crop left and right symmetrically
    cropH = srcH;
    cropW = srcH * slotAspect;
    cropX = (srcW - cropW) / 2; // center horizontal
    cropY = 0;
  } else {
    // Source is TALLER (or same aspect) → crop from the top (bottom anchor)
    cropW = srcW;
    cropH = srcW / slotAspect;
    cropX = 0;
    cropY = srcH - cropH; // bottom anchor: keep bottom, crop top
  }

  // Safety clamp — never exceed source bounds
  cropX = Math.max(0, Math.min(cropX, srcW - 1));
  cropY = Math.max(0, Math.min(cropY, srcH - 1));
  cropW = Math.min(cropW, srcW - cropX);
  cropH = Math.min(cropH, srcH - cropY);

  return { cropX, cropY, cropW, cropH };
}



export function calculatePhotoLayerGeometry(input: PhotoLayerGeometryInput): PhotoLayerGeometryOutput {
  const canvasW = input.canvasWidth > 0 ? input.canvasWidth : 1800;
  const canvasH = input.canvasHeight > 0 ? input.canvasHeight : 2700;

  const xPct = normalizePercent(input.slot.x);
  const yPct = normalizePercent(input.slot.y);
  const wPct = normalizePercent(input.slot.width);
  const hPct = normalizePercent(input.slot.height);

  const slotX = (xPct / 100) * canvasW;
  const slotY = (yPct / 100) * canvasH;
  const slotW = (wPct / 100) * canvasW;
  const slotH = (hPct / 100) * canvasH;

  const slotCenterX = slotX + slotW / 2;
  const slotCenterY = slotY + slotH / 2;

  const imageW = input.imageWidth > 0 ? input.imageWidth : 1920;
  const imageH = input.imageHeight > 0 ? input.imageHeight : 1080;

  const fitMode = input.fitMode ?? 'cover';
  const focalPoint = input.focalPoint ?? { x: 0.5, y: 0.5 };
  const fpX = Math.max(0, Math.min(1, focalPoint.x));
  const fpY = Math.max(0, Math.min(1, focalPoint.y));

  let baseScale = 1.0;
  if (fitMode === 'contain') {
    baseScale = Math.min(slotW / imageW, slotH / imageH);
  } else if (fitMode === 'fill') {
    baseScale = 1.0;
  } else {
    baseScale = Math.max(slotW / imageW, slotH / imageH);
  }

  const multiplier = typeof input.debugScale === 'number' && input.debugScale > 0 ? input.debugScale : 1.0;
  const scale = baseScale * multiplier;

  const photoW = fitMode === 'fill' ? slotW : imageW * scale;
  const photoH = fitMode === 'fill' ? slotH : imageH * scale;

  let photoX = slotX + (slotW - photoW) * fpX;
  let photoY = slotY + (slotH - photoH) * fpY;

  if (fitMode === 'cover') {
    if (photoW >= slotW) {
      photoX = Math.min(slotX, Math.max(slotX + slotW - photoW, photoX));
    }
    if (photoH >= slotH) {
      photoY = Math.min(slotY, Math.max(slotY + slotH - photoH, photoY));
    }
  }

  const photoCenterX = photoX + photoW / 2;
  const photoCenterY = photoY + photoH / 2;

  const leftPct = (photoX / canvasW) * 100;
  const topPct = (photoY / canvasH) * 100;
  const widthPct = (photoW / canvasW) * 100;
  const heightPct = (photoH / canvasH) * 100;

  const slotLeftPct = (slotX / canvasW) * 100;
  const slotTopPct = (slotY / canvasH) * 100;
  const slotWidthPct = (slotW / canvasW) * 100;
  const slotHeightPct = (slotH / canvasH) * 100;

  const localLeftPct = ((photoX - slotX) / slotW) * 100;
  const localTopPct = ((photoY - slotY) / slotH) * 100;
  const localWidthPct = (photoW / slotW) * 100;
  const localHeightPct = (photoH / slotH) * 100;

  return {
    slotX,
    slotY,
    slotWidth: slotW,
    slotHeight: slotH,
    slotCenterX,
    slotCenterY,

    photoX,
    photoY,
    photoWidth: photoW,
    photoHeight: photoH,
    photoCenterX,
    photoCenterY,

    scale,

    leftPct,
    topPct,
    widthPct,
    heightPct,

    slotLeftPct,
    slotTopPct,
    slotWidthPct,
    slotHeightPct,

    localLeftPct,
    localTopPct,
    localWidthPct,
    localHeightPct,
  };
}
