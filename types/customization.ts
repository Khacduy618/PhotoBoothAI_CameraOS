export type BoothLayoutId = "2x2" | "1x4-vertical" | "2x3";

export interface BoothLayoutConfig {
    id: BoothLayoutId;
    name: string;
    description: string;
    columns: number;
    rows: number;
    shotCount: number;
    outputWidth: number;
    outputHeight: number;
    orientation: "square" | "portrait" | "landscape";
}

export type BoothCountdownSeconds = 3 | 6 | 8 | 10;

export interface DrawingStrokePoint {
    x: number;
    y: number;
}

export interface DrawingStroke {
    id: string;
    color: string;
    width: number;
    points: readonly DrawingStrokePoint[];
}

export interface TextLabelCustomization {
    id: string;
    text: string;
    x: number;
    y: number;
    color: string;
    fontSize: number;
    rotationDegrees: number;
}

export interface StickerCustomization {
    id: string;
    stickerId: string;
    x: number;
    y: number;
    scale: number;
    rotationDegrees: number;
}

export interface BoothOutputCustomization {
    stickerItems: readonly StickerCustomization[];
    textLabels: readonly TextLabelCustomization[];
    drawingStrokes: readonly DrawingStroke[];
}
