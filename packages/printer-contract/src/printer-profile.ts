/**
 * printer-profile.ts
 *
 * Authoritative Printer Profiles for MomentAI CameraOS.
 */

export interface PrinterRasterDimensions {
  widthPx: number;
  heightPx: number;
}

export interface InsetsPx {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface PrinterProfile {
  id: string;
  name: string;
  mediaId: string;
  widthMm: number;
  heightMm: number;
  dpi: number;
  portrait: PrinterRasterDimensions;
  landscape: PrinterRasterDimensions;
  safeAreaInsetsPx: InsetsPx;
  bleedCompensation: InsetsPx;
  colorSpace: 'sRGB';
  outputMimeType: 'image/jpeg';
  jpegQuality: number;
}

/**
 * Canon SELPHY CP1000 Postcard Profile:
 * Physical media: 100 mm × 148 mm
 * Printer resolution: 300 × 300 DPI
 * 
 * Derivations:
 * 100 / 25.4 * 300 ≈ 1181 px
 * 148 / 25.4 * 300 ≈ 1748 px
 */
export const CANON_CP1000_PROFILE: Readonly<PrinterProfile> = Object.freeze({
  id: 'CANON_SELPHY_CP1000',
  name: 'Canon SELPHY CP1000',
  mediaId: 'POSTCARD',
  widthMm: 100,
  heightMm: 148,
  dpi: 450,
  portrait: {
    widthPx: 1800,
    heightPx: 2700,
  },
  landscape: {
    widthPx: 2700,
    heightPx: 1800,
  },
  safeAreaInsetsPx: {
    top: 80, // ~4.5mm at 450 DPI
    bottom: 45, // ~2.5mm at 450 DPI
    left: 54, // ~3.0mm at 450 DPI
    right: 54, // ~3.0mm at 450 DPI
  },
  bleedCompensation: {
    top: 80,
    bottom: 45,
    left: 54,
    right: 54,
  },
  colorSpace: 'sRGB',
  outputMimeType: 'image/jpeg',
  jpegQuality: 0.98,
});

export const PRINTER_PROFILES: Record<string, PrinterProfile> = {
  CANON_SELPHY_CP1000: CANON_CP1000_PROFILE,
};

export function getPrinterProfile(profileId = 'CANON_SELPHY_CP1000'): PrinterProfile {
  return PRINTER_PROFILES[profileId] || CANON_CP1000_PROFILE;
}
