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
    kind?: "none" | "solid" | "template";
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
}
