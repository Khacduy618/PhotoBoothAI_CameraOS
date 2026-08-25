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
  dpi: 600,
  portrait: {
    widthPx: 2362,
    heightPx: 3496,
  },
  landscape: {
    widthPx: 3496,
    heightPx: 2362,
  },
  safeAreaInsetsPx: {
    top: 142, // 6mm at 600 DPI (6 / 25.4 * 600 ≈ 142px, shifted down by +1mm)
    bottom: 47, // 2mm at 600 DPI (2 / 25.4 * 600 ≈ 47px, shifted down by -1mm)
    left: 71, // 3mm at 600 DPI
    right: 71, // 3mm at 600 DPI
  },
  bleedCompensation: {
    top: 142,
    bottom: 47,
    left: 71,
    right: 71,
  },
  colorSpace: 'sRGB',
  outputMimeType: 'image/jpeg',
  jpegQuality: 0.95,
});

export const PRINTER_PROFILES: Record<string, PrinterProfile> = {
  CANON_SELPHY_CP1000: CANON_CP1000_PROFILE,
};

export function getPrinterProfile(profileId = 'CANON_SELPHY_CP1000'): PrinterProfile {
  return PRINTER_PROFILES[profileId] || CANON_CP1000_PROFILE;
}
