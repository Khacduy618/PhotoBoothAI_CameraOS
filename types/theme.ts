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
}
