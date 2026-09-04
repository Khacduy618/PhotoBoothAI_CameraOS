/**
 * resolveTargetProduct — Canonical product taxonomy resolver.
 *
 * Priority:
 *  1. Persisted targetProduct (always wins if present)
 *  2. Canvas aspect ratio + shotCount (authoritative, not slot geometry)
 *  3. Layout.type (legacy migration only)
 *
 * NEVER uses: slot width/height, slot positions, hasSecondColumn, crop mode.
 *
 * Business rules:
 *  shotCount=1  -> PREMIUM_POSTCARD
 *  shotCount=2  -> STRIP_2
 *  shotCount=6  -> SHEET_6
 *  shotCount=4  -> canvas ratio: >=2.5 -> STRIP_4, <2.5 -> SHEET_4
 *
 * Canvas evidence:
 *  4strip = 3000x9000 -> ratio=3.0 -> STRIP_4
 *  4sheet = 6000x9000 -> ratio=1.5 -> SHEET_4
 */

export type CanonicalProduct =
  | 'PREMIUM_POSTCARD'
  | 'STRIP_2'
  | 'STRIP_4'
  | 'SHEET_4'
  | 'SHEET_6';

export interface ResolvableFrame {
  targetProduct?: string;
  shotCount?: number;
  outputWidth?: number;
  outputHeight?: number;
  layout?: { type?: string };
  outputPaper?: string;
}

export function resolveTargetProduct(frame: ResolvableFrame): CanonicalProduct | null {
  // Priority 1: persisted targetProduct always wins
  if (frame.targetProduct && isCanonicalProduct(frame.targetProduct)) {
    return frame.targetProduct as CanonicalProduct;
  }

  const count = frame.shotCount;

  // Priority 2: unambiguous shot counts
  if (count === 1) return 'PREMIUM_POSTCARD';
  if (count === 2) return 'STRIP_2';
  if (count === 6) return 'SHEET_6';

  // Priority 2b: 4-shot -- resolve via canvas aspect ratio (authoritative)
  if (count === 4) {
    if (frame.outputPaper === '5x15') return 'STRIP_4';
    if (frame.outputPaper === '10x15') return 'SHEET_4';

    // Priority 3: layout.type (if layout is explicit 1x4, it's a strip regardless of canvas)
    if (frame.layout?.type === '1x4') return 'STRIP_4';
    if (frame.layout?.type === '2x2') return 'SHEET_4';

    const w = frame.outputWidth;
    const h = frame.outputHeight;
    if (w && h && w > 0) {
      // Strip 5x15: ratio~3.0. Sheet 10x15: ratio~1.5. Threshold 1.8 separates 10x15 (1.5) from photostrips (>=1.8)
      return (h / w) >= 1.8 ? 'STRIP_4' : 'SHEET_4';
    }
  }

  return null;
}

export function isStripProduct(product: CanonicalProduct | null | undefined): boolean {
  return product === 'STRIP_2' || product === 'STRIP_4';
}

export function canonicalLayoutType(
  product: CanonicalProduct | null | undefined,
): '1x1' | '1x2' | '1x4' | '2x2' | '2x3' {
  switch (product) {
    case 'PREMIUM_POSTCARD': return '1x1';
    case 'STRIP_2':          return '1x2';
    case 'STRIP_4':          return '1x4';
    case 'SHEET_4':          return '2x2';
    case 'SHEET_6':          return '2x3';
    default:                 return '1x1';
  }
}

export function canonicalPreferredPaper(
  product: CanonicalProduct | null | undefined,
): '4x6' | '2x6-double' {
  return isStripProduct(product) ? '2x6-double' : '4x6';
}

export function canonicalRenderMode(
  product: CanonicalProduct | null | undefined,
): 'standard' | 'double-strip' {
  return isStripProduct(product) ? 'double-strip' : 'standard';
}

export interface CanonicalSlot {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * normalizeSlotToUnit — Converts any slot coordinate (0..1, 0..100, or pixel) to canonical 0..1 normalized float.
 */
export function normalizeSlotToUnit(
  slot: { x: number; y: number; width: number; height: number },
  outputWidth = 1800,
  outputHeight = 2700,
): { x: number; y: number; width: number; height: number } {
  const fw = outputWidth > 0 ? outputWidth : 1800;
  const fh = outputHeight > 0 ? outputHeight : 2700;

  const isUnit =
    slot.x <= 1.0001 &&
    slot.y <= 1.0001 &&
    slot.width <= 1.0001 &&
    slot.height <= 1.0001;

  const isPercent =
    !isUnit &&
    slot.x <= 100.0001 &&
    slot.y <= 100.0001 &&
    slot.width <= 100.0001 &&
    slot.height <= 100.0001;

  let x: number;
  let y: number;
  let width: number;
  let height: number;

  if (isUnit) {
    x = slot.x;
    y = slot.y;
    width = slot.width;
    height = slot.height;
  } else if (isPercent) {
    x = slot.x / 100;
    y = slot.y / 100;
    width = slot.width / 100;
    height = slot.height / 100;
  } else {
    x = slot.x / fw;
    y = slot.y / fh;
    width = slot.width / fw;
    height = slot.height / fh;
  }

  return {
    x: Number(x.toFixed(6)),
    y: Number(y.toFixed(6)),
    width: Number(width.toFixed(6)),
    height: Number(height.toFixed(6)),
  };
}

/**
 * Mathematically precise slot opening bounds measured directly from real Canva PNG alpha channels:
 *
 * Canonical slot bounds represented in strict 0..1 normalized interval.
 */
export function getCanonicalSlots(
  product: CanonicalProduct | null | undefined,
  isLandscape = false,
): CanonicalSlot[] {
  switch (product) {
    case 'PREMIUM_POSTCARD':
      if (isLandscape) {
        return [{ id: 1, x: 0.0156, y: 0.0267, width: 0.9678, height: 0.8000 }];
      }
      return [{ id: 1, x: 0.0317, y: 0.0222, width: 0.9317, height: 0.7567 }];

    case 'STRIP_2':
      return [
        { id: 1, x: 0.0400, y: 0.0156, width: 0.9167, height: 0.4244 },
        { id: 2, x: 0.0433, y: 0.4567, width: 0.9133, height: 0.4244 },
      ];

    case 'STRIP_4':
      return [
        { id: 1, x: 0.0367, y: 0.0378, width: 0.9267, height: 0.1644 },
        { id: 2, x: 0.0367, y: 0.2300, width: 0.9267, height: 0.1644 },
        { id: 3, x: 0.0367, y: 0.4289, width: 0.9267, height: 0.1656 },
        { id: 4, x: 0.0367, y: 0.6300, width: 0.9267, height: 0.1656 },
      ];

    case 'SHEET_4':
      return [
        { id: 1, x: 0.0200, y: 0.0156, width: 0.4683, height: 0.4100 },
        { id: 2, x: 0.5100, y: 0.0156, width: 0.4667, height: 0.4100 },
        { id: 3, x: 0.0183, y: 0.4489, width: 0.4683, height: 0.4100 },
        { id: 4, x: 0.5117, y: 0.4478, width: 0.4683, height: 0.4100 },
      ];

    case 'SHEET_6':
      return [
        { id: 1, x: 0.0250, y: 0.1500, width: 0.4583, height: 0.1800 },
        { id: 2, x: 0.5117, y: 0.1500, width: 0.4600, height: 0.1800 },
        { id: 3, x: 0.0250, y: 0.3533, width: 0.4600, height: 0.1811 },
        { id: 4, x: 0.5117, y: 0.3544, width: 0.4600, height: 0.1800 },
        { id: 5, x: 0.0233, y: 0.5544, width: 0.4600, height: 0.1800 },
        { id: 6, x: 0.5167, y: 0.5533, width: 0.4600, height: 0.1811 },
      ];

    default:
      return [{ id: 1, x: 0.05, y: 0.05, width: 0.90, height: 0.90 }];
  }
}

function isCanonicalProduct(value: string): value is CanonicalProduct {
  return (
    value === 'PREMIUM_POSTCARD' ||
    value === 'STRIP_2' ||
    value === 'STRIP_4' ||
    value === 'SHEET_4' ||
    value === 'SHEET_6'
  );
}

