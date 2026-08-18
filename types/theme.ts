import type {
    BoothCountdownSeconds,
    BoothLayoutFamily,
    BoothLayoutId,
    BoothOutputCustomization,
} from "@/types/customization";

export interface ThemeConfig {
    id: string;
    name: string;
    description: string;
    backgroundColor: string;
    textColor: string;
    accentColor: string;
}

export interface FramePoint {
    x: number;
    y: number;
    inHandle?: { x: number; y: number };
    outHandle?: { x: number; y: number };
    cornerRadius?: number;
}

export interface FrameSlot {
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

export type PhotoFitMode = "contain" | "cover";
export type PhotoAspectRatio = "2:3" | "3:2" | "4:3" | "1:1";

export interface FrameConfig {
    id: string;
    name: string;
    description: string;
    borderColor: string;
    borderWidth: number;
    kind?: "none" | "solid" | "template" | "png-overlay";
    patternUrl?: string;
    assetUrl?: string;
    source?: "bundled" | "canva" | "operator-upload";
    shotCount?: number;
    /** Legacy-compatible photo viewport orientation; not fixed frame orientation. */
    orientation?: "portrait" | "landscape";
    photoViewportOrientation?: "portrait" | "landscape";
    photoAspectRatio?: PhotoAspectRatio;
    photoFit?: PhotoFitMode;
    layoutFamily?: BoothLayoutFamily;
    outputWidth?: number;
    outputHeight?: number;
    slots?: readonly FrameSlot[];
    createdAt?: string;
    updatedAt?: string;
}

export interface StickerConfig {
    id: string;
    name: string;
    description: string;
    emoji: string;
}

export interface TextLabelPresetConfig {
    id: string;
    text: string;
    description: string;
}

export interface StyleConfig {
    id: string;
    name: string;
    description: string;
    mode: "none" | "grayscale" | "warm" | "cool" | "contrast";
}

export interface BoothSelection {
    themeId: string;
    frameId: string;
    styleId: string;
    layoutId: BoothLayoutId;
    countdownSeconds: BoothCountdownSeconds;
    customization: BoothOutputCustomization;
    frameColor?: string;
    stickerId?: string;
    textLabel?: string;
}

export interface CapturedPhoto {
    id: string;
    sessionId: string;
    originalBlob: Blob;
    originalUrl: string;
    outputUrl: string;
    usedFallback: boolean;
    mediaUrl?: string;
    storageKey?: string;
    width?: number;
    height?: number;
    expiresAt?: string;
}
