import type { BoothLayoutId } from "@/types/customization";

export type PhotoAssetKind = "original" | "processed";

export type PhotoDerivativeKind =
    | "preview"
    | "share"
    | "print"
    | "thumbnail"
    | "layout"
    | "customized";

export interface PhotoMetadata {
    id: string;
    sessionId: string;
    capturedAt: string;
    mimeType: string;
    byteSize: number;
    width?: number;
    height?: number;
    source: "webcam" | "capture-card" | "unknown";
}

export interface OriginalPhotoAsset {
    kind: "original";
    blob: Blob;
    objectUrl?: string;
    metadata: PhotoMetadata;
}

export interface ProcessedPhotoDerivative {
    kind: "processed";
    derivativeKind: PhotoDerivativeKind;
    blob: Blob;
    objectUrl?: string;
    createdAt: string;
    sourcePhotoId?: string;
    sourcePhotoIds?: readonly string[];
    layoutId?: BoothLayoutId;
    processingErrorCode?: string;
}

export interface BoothPhoto {
    id: string;
    sessionId: string;
    original: OriginalPhotoAsset;
    derivatives: readonly ProcessedPhotoDerivative[];
    metadata: PhotoMetadata;
}
