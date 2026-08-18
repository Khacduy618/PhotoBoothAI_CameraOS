import type { BoothLayoutFamily } from "@/types/customization";
import type { FrameConfig, PhotoAspectRatio } from "@/types/theme";

export type ImportedFrameShotCount = 1 | 2 | 4 | 6 | 8;
export type FrameImportMaskSource = "alpha" | "companion-mask" | "white-fill";
export type FrameImportStatus = "auto-approved" | "needs-review" | "rejected";

export interface PixelBounds {
    x: number;
    y: number;
    width: number;
    height: number;
}

export type NormalizedBounds = PixelBounds;

export interface RawComponent {
    area: number;
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    touchesCanvasEdge: boolean;
}

export interface DetectedSlot {
    id: string;
    order: number;
    pixelBounds: PixelBounds;
    normalizedBounds: NormalizedBounds;
    areaRatio: number;
    fillRatio: number;
    touchesCanvasEdge: boolean;
    shape?: "rect" | "polygon" | "bezier";
    points?: readonly FramePoint[];
}

export type FrameImportWarning =
    | "NO_ALPHA_CHANNEL"
    | "NO_TRANSPARENT_SLOT_FOUND"
    | "BACKGROUND_TOUCHES_EDGE"
    | "UNSUPPORTED_SLOT_COUNT"
    | "INCONSISTENT_SLOT_SIZE"
    | "IRREGULAR_LAYOUT"
    | "LOW_FILL_RATIO"
    | "MASK_DIMENSION_MISMATCH"
    | "LOW_CONFIDENCE";

export interface AnalyzeFrameInput {
    fileName: string;
    rgba: Uint8ClampedArray;
    width: number;
    height: number;
    companionMask?: Uint8Array;
    importId?: string;
}

export interface FrameImportResult {
    importId: string;
    sourceFileName: string;
    image: {
        width: number;
        height: number;
        mimeType: "image/png";
        hasAlpha: boolean;
    };
    maskSource: FrameImportMaskSource;
    analysis: {
        transparentPixelRatio: number;
        rawComponentCount: number;
        candidateCount: number;
        detectedShotCount: ImportedFrameShotCount | null;
        confidence: number;
        warnings: FrameImportWarning[];
    };
    slots: readonly DetectedSlot[];
    status: FrameImportStatus;
}

export interface FramePoint {
    x: number;
    y: number;
    inHandle?: { x: number; y: number };
    outHandle?: { x: number; y: number };
    cornerRadius?: number;
}

export interface FrameDefinitionSlot {
    id: string;
    index: number;
    x: number;
    y: number;
    width: number;
    height: number;
    photoViewportOrientation?: "portrait" | "landscape";
    shape?: "rect" | "polygon" | "bezier";
    points?: readonly FramePoint[];
}

export type FrameTargetProduct = "STRIP_2" | "STRIP_4" | "SHEET_4" | "SHEET_6" | "PREMIUM_POSTCARD";
export type FrameOutputPaper = "5x15" | "10x15";

export interface FrameDefinition {
    id: string;
    name: string;
    description?: string;
    kind: "png-overlay";
    source: "canva" | "operator-upload";
    assetUrl?: string;
    assets?: {
        overlay?: string;
        background?: string;
    };
    thumbnailUrl?: string;
    shotCount: ImportedFrameShotCount;
    targetProduct?: FrameTargetProduct;
    outputPaper?: FrameOutputPaper;
    orientation?: "portrait" | "landscape";
    photoViewportOrientation?: "portrait" | "landscape";
    photoAspectRatio?: PhotoAspectRatio;
    photoFit?: "contain" | "cover";
    allowDraw?: boolean;
    eventId?: string;
    layoutFamily?: BoothLayoutFamily;
    outputWidth: number;
    outputHeight: number;
    slots: readonly FrameDefinitionSlot[];
    status?: "published" | "private";
    createdAt?: string;
    updatedAt?: string;
}

export interface FrameDefinitionAdapterInput {
    definition: FrameDefinition;
}

export type RuntimeFrameConfig = FrameConfig;
