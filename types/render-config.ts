import type { ThemeConfig, StyleConfig, FrameConfig, CapturedPhoto, BoothSelection } from "@/types/theme";
import type { BoothLayoutConfig, OverlayItem, DrawingStroke } from "@/types/customization";

export interface RenderFontSpec {
    family: string;
    fallback: string[];
    weight: number | string;
    style: "normal" | "italic";
}

export interface RenderTextShadow {
    color: string;
    blur: number;
    offsetX: number;
    offsetY: number;
}

export interface RenderSurface {
    width: number;
    height: number;
    pixelRatio: number;
    backgroundColor?: string;
    type: "preview" | "export" | "print";
}

export interface AssetManifest {
    backgroundUrl?: string;
    frameUrl?: string;
    stickerUrls: string[];
    capturedPhotoBlobs: Blob[];
    fontDescriptors: string[];
}

export interface CreateRenderConfigInput {
    selection: BoothSelection;
    capturedPhotos?: CapturedPhoto[];
    drawingStrokes?: readonly DrawingStroke[];
}

export interface RenderConfig {
    /** Resolved layout geometry */
    layout: BoothLayoutConfig;
    /** Resolved theme (colors, text style) */
    theme: ThemeConfig;
    /** Resolved frame config with final color applied */
    frame: FrameConfig;
    /** Override frame border color after frame package selection */
    frameColor?: string;
    /** Resolved style/filter */
    style: StyleConfig;
    /** Ordered overlay items to composite above photos */
    overlays: readonly OverlayItem[];
    /** Asset manifest for preloading */
    assetManifest: AssetManifest;
    /** Target output pixel width (legacy fallback) */
    outputWidth: number;
    /** Target output pixel height (legacy fallback) */
    outputHeight: number;
}
