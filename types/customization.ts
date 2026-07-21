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

// ─── Legacy Customization types (preserved for backwards compatibility) ─────

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
    overlays?: readonly OverlayItem[];
}

// ─── Phase 2: Unified OverlayItem System ─────────────────────────────────────

/**
 * Logical overlay design space.
 * It must remain unchanged across layouts and output resolutions.
 */
export const OVERLAY_REFERENCE_SIZE = {
    width: 1000,
    height: 1500,
} as const;

export type OverlayType = "sticker" | "text" | "drawing";

export interface OverlayBase {
    id: string;
    x: number;             // Normalized horizontal center position [0, 1]
    y: number;             // Normalized vertical center position [0, 1]
    baseWidth: number;     // Baseline width at scale = 1 in reference units
    baseHeight: number;    // Baseline height at scale = 1 in reference units
    scale: number;         // Scale multiplier [0.3, 4]
    rotationRadians: number; // Rotation in radians [0, 2π]
    rotationDegrees?: number; // Legacy compatibility helper [0, 360]
    zIndex: number;        // Z-Index layer ordering
    opacity: number;       // Opacity value [0, 1]
}

export interface StickerOverlay extends OverlayBase {
    type: "sticker";
    content: string;       // Sticker configuration ID
    flipX?: boolean;
    flipY?: boolean;
}

export interface TextOverlay extends OverlayBase {
    type: "text";
    content: string;       // Custom text string or preset string
    color?: string;
    fontFamily?: string;
    fontWeight?: string | number;
    fontSize?: number;      // Logical font size
    align?: "left" | "center" | "right";
    letterSpacing?: number;
    outlineColor?: string;
    outlineWidth?: number;
    shadowPreset?: "none" | "soft" | "hard" | "neon";
}

export interface DrawingOverlay extends OverlayBase {
    type: "drawing";
    points?: readonly DrawingStrokePoint[];
    color?: string;
    brushType?: "pen" | "marker" | "neon";
    strokeWidth?: number;
}

export type OverlayItem = StickerOverlay | TextOverlay | DrawingOverlay;

export type AddOverlayOptions = Partial<Omit<StickerOverlay, "id" | "type" | "content">> &
    Partial<Omit<TextOverlay, "id" | "type" | "content">> &
    Partial<Omit<DrawingOverlay, "id" | "type">>;

export type OverlayPatch = Partial<Omit<StickerOverlay, "id" | "type">> &
    Partial<Omit<TextOverlay, "id" | "type">> &
    Partial<Omit<DrawingOverlay, "id" | "type">>;

export function getRotatedHalfExtents(
    baseWidth: number,
    baseHeight: number,
    scale: number,
    rotationRadians: number
) {
    const normW = (baseWidth * scale) / OVERLAY_REFERENCE_SIZE.width;
    const normH = (baseHeight * scale) / OVERLAY_REFERENCE_SIZE.height;

    const halfW = normW / 2;
    const halfH = normH / 2;

    const cos = Math.abs(Math.cos(rotationRadians));
    const sin = Math.abs(Math.sin(rotationRadians));

    return {
        halfExtentX: halfW * cos + halfH * sin,
        halfExtentY: halfW * sin + halfH * cos,
    };
}

export function clampAxis(value: number, halfExtent: number): number {
    if (halfExtent >= 0.5) {
        return 0.5;
    }
    return Math.max(halfExtent, Math.min(1 - halfExtent, value));
}

export function clampOverlayPosition(
    x: number,
    y: number,
    baseWidth: number,
    baseHeight: number,
    scale: number,
    rotationRadians: number
) {
    const { halfExtentX, halfExtentY } = getRotatedHalfExtents(
        baseWidth,
        baseHeight,
        scale,
        rotationRadians
    );

    return {
        x: clampAxis(x, halfExtentX),
        y: clampAxis(y, halfExtentY),
    };
}

let textMeasureCanvas: HTMLCanvasElement | null = null;

export function measureTextOverlay(
    content: string,
    fontFamily: string,
    fontSize: number,
    letterSpacing: number,
    outlineWidth: number
): { width: number; height: number } {
    const paddingX = outlineWidth * 2 + letterSpacing * Math.max(0, (content.length - 1));
    const paddingY = outlineWidth * 2;

    if (typeof document === "undefined") {
        const estimatedWidth = Math.max(40, content.length * (fontSize * 0.6) + paddingX);
        return { width: estimatedWidth, height: Math.max(20, fontSize * 1.2 + paddingY) };
    }
    if (!textMeasureCanvas) {
        textMeasureCanvas = document.createElement("canvas");
    }
    const ctx = textMeasureCanvas.getContext("2d");
    if (!ctx) {
        const estimatedWidth = Math.max(40, content.length * (fontSize * 0.6) + paddingX);
        return { width: estimatedWidth, height: Math.max(20, fontSize * 1.2 + paddingY) };
    }

    ctx.font = `bold ${fontSize}px ${fontFamily || "sans-serif"}`;
    const metrics = ctx.measureText(content || "");
    const textWidth = metrics.width || (content.length * fontSize * 0.6);
    
    // Use actualBoundingBoxAscent/Descent if available, else fallback
    const measuredHeight = (metrics.actualBoundingBoxAscent || 0) + (metrics.actualBoundingBoxDescent || 0);
    const textHeight = measuredHeight > 0 ? measuredHeight : fontSize * 1.2;

    return {
        width: Math.max(40, textWidth + paddingX),
        height: Math.max(20, textHeight + paddingY),
    };
}
