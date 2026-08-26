/**
 * cp1000-color-profile.ts
 *
 * Single Authoritative Source of Truth for Canon SELPHY CP1000 Color Correction.
 * Calibrated profile: M2 (Magenta compensation / green reduction for dye-sublimation paper).
 */

export interface ColorCorrectionProfile {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
}

/**
 * Calibrated M2 Profile for Canon SELPHY CP1000:
 *  - Red:   1.03 (+3%)
 *  - Green: 0.96 (-4%)
 *  - Blue:  1.01 (+1%)
 */
export const CP1000_PRINT_PROFILE: Readonly<ColorCorrectionProfile> = Object.freeze({
  red: 1.03,
  green: 0.96,
  blue: 1.01,
});

/**
 * Global Kill-switch / Toggle for CP1000 Color Correction in Production.
 * Set to `false` to immediately revert print output to uncorrected master colors.
 */
export const CP1000_COLOR_CORRECTION_ENABLED: boolean = true;

/**
 * Helper to clamp values to 0..255
 */
export function clamp255(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

/**
 * Applies the calibrated CP1000 M2 RGB profile directly to a Canvas 2D Context.
 * Operates purely on the destination canvas pixels with zero saturation, contrast,
 * brightness, gamma, or sharpness distortion.
 */
export function applyCP1000M2Profile(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  profile: ColorCorrectionProfile = CP1000_PRINT_PROFILE,
): void {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const { red, green, blue } = profile;

  for (let i = 0; i < data.length; i += 4) {
    data[i] = clamp255(data[i] * red);
    data[i + 1] = clamp255(data[i + 1] * green);
    data[i + 2] = clamp255(data[i + 2] * blue);
  }

  ctx.putImageData(imageData, 0, 0);
}
