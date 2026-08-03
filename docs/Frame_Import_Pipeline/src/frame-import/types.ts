export type ShotCount = 1 | 2 | 4 | 6;

export type PixelBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type NormalizedBounds = PixelBounds;

export type RawComponent = {
  area: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  touchesCanvasEdge: boolean;
};

export type DetectedSlot = {
  id: string;
  order: number;
  pixelBounds: PixelBounds;
  normalizedBounds: NormalizedBounds;
  areaRatio: number;
  fillRatio: number;
  touchesCanvasEdge: boolean;
};

export type FrameWarning =
  | "NO_ALPHA_CHANNEL"
  | "NO_TRANSPARENT_SLOT_FOUND"
  | "BACKGROUND_TOUCHES_EDGE"
  | "UNSUPPORTED_SLOT_COUNT"
  | "INCONSISTENT_SLOT_SIZE"
  | "IRREGULAR_LAYOUT"
  | "LOW_FILL_RATIO"
  | "MASK_DIMENSION_MISMATCH"
  | "LOW_CONFIDENCE";

export type FrameImportResult = {
  importId: string;
  sourceFileName: string;
  image: {
    width: number;
    height: number;
    mimeType: "image/png";
    hasAlpha: boolean;
  };
  maskSource: "alpha" | "companion-mask";
  analysis: {
    transparentPixelRatio: number;
    rawComponentCount: number;
    candidateCount: number;
    detectedShotCount: ShotCount | null;
    confidence: number;
    warnings: FrameWarning[];
  };
  slots: DetectedSlot[];
  status: "auto-approved" | "needs-review" | "rejected";
};
