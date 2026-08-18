export interface SlotInput {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PhotoLayerGeometryInput {
  canvasWidth: number;
  canvasHeight: number;
  slot: SlotInput;
  imageWidth: number;
  imageHeight: number;
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

  // DOM Percentages
  leftPct: number;
  topPct: number;
  widthPct: number;
  heightPct: number;
}

export const normalizePercent = (val: number): number => (val <= 1 && val > 0 ? val * 100 : val);

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

  // Base cover scale to ensure full coverage of slot area
  const baseScale = Math.max(slotW / imageW, slotH / imageH);

  // Optional debug scale multiplier to tune size independently from center lock
  const multiplier = typeof input.debugScale === 'number' && input.debugScale > 0 ? input.debugScale : 1.0;
  const scale = baseScale * multiplier;

  const photoW = imageW * scale;
  const photoH = imageH * scale;

  // Position photo center EXACTLY at slot center
  const photoX = slotCenterX - photoW / 2;
  const photoY = slotCenterY - photoH / 2;

  const photoCenterX = photoX + photoW / 2;
  const photoCenterY = photoY + photoH / 2;

  const leftPct = (photoX / canvasW) * 100;
  const topPct = (photoY / canvasH) * 100;
  const widthPct = (photoW / canvasW) * 100;
  const heightPct = (photoH / canvasH) * 100;

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
  };
}
