import type {
    BoothCountdownSeconds,
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

export interface FrameConfig {
    id: string;
    name: string;
    description: string;
    borderColor: string;
    borderWidth: number;
    kind?: "none" | "solid" | "template" | "png-overlay";
    patternUrl?: string;
    assetUrl?: string;
    source?: "bundled" | "canva";
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
}
