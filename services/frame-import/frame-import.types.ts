import type { BoothLayoutFamily } from "@/types/customization";
import type { FrameConfig } from "@/types/theme";

export type ImportedFrameShotCount = 1 | 2 | 4 | 6 | 8;
export type FrameImportMaskSource = "alpha" | "companion-mask";
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

export interface FrameDefinitionSlot {
    id: string;
    index: number;
    x: number;
    y: number;
    width: number;
    height: number;
    photoViewportOrientation?: "portrait" | "landscape";
}

export interface FrameDefinition {
    id: string;
    name: string;
    description?: string;
    kind: "png-overlay";
    source: "canva" | "operator-upload";
    assetUrl?: string;
    thumbnailUrl?: string;
    borderColor?: string;
    borderWidth?: number;
    shotCount: ImportedFrameShotCount;
    photoViewportOrientation?: "portrait" | "landscape";
    layoutFamily?: BoothLayoutFamily;
    outputWidth: number;
    outputHeight: number;
    slots: readonly FrameDefinitionSlot[];
    status?: "published" | "private";
}

export interface FrameDefinitionAdapterInput {
    definition: FrameDefinition;
}

export type RuntimeFrameConfig = FrameConfig;
