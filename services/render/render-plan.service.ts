import type { OverlayItem } from "@/types/customization";
import type { RenderConfig, RenderSurface } from "@/types/render-config";
import { resolveLayoutGeometry } from "./layout-geometry.service";

export interface RenderPlanSize {
    width: number;
    height: number;
}

export interface RenderPlanRect extends RenderPlanSize {
    x: number;
    y: number;
}

export interface RenderPlanPhotoSlot extends RenderPlanRect {
    id: string;
    index: number;
    column: number;
    row: number;
    shape?: "rect" | "polygon" | "bezier";
            points?: readonly { x: number; y: number; inHandle?: { x: number; y: number }; outHandle?: { x: number; y: number }; cornerRadius?: number }[];
}

export interface ResolvedRenderPlan {
    surface: RenderSurface;
    scale: number;
    sheet: RenderPlanRect;
    frame: {
        rect: RenderPlanRect;
        borderColor: string;
        backgroundColor: string;
        patternUrl?: string;
    };
    grid: {
        rect: RenderPlanRect;
        rows: number;
        columns: number;
        gap: number;
        cells: readonly RenderPlanPhotoSlot[];
    };
    brandingArea?: RenderPlanRect;
    overlays: readonly OverlayItem[];
}

function scaleRect(
    rect: RenderPlanRect,
    scale: number,
): RenderPlanRect {
    return {
        x: rect.x * scale,
        y: rect.y * scale,
        width: rect.width * scale,
        height: rect.height * scale,
    };
}

export function resolveRenderPlan(
    renderConfig: RenderConfig,
    surface: RenderSurface = {
        width: renderConfig.outputWidth,
        height: renderConfig.outputHeight,
        pixelRatio: 1,
        type: "export",
    },
): ResolvedRenderPlan {
    const geometry = resolveLayoutGeometry(
        renderConfig.layout,
        renderConfig.frame,
    );
    const scale = surface.width / geometry.sheet.width;

    const sourceSlots = renderConfig.photoSlots ?? geometry.photoSlots;
    const slotScale = renderConfig.photoSlots ? surface.width / renderConfig.outputWidth : scale;
    const cells = sourceSlots.map((slot) => {
        const positionedSlot = slot as typeof slot & { column?: number; row?: number };
        const shapedSlot = slot as typeof slot & {
            shape?: "rect" | "polygon" | "bezier";
    points?: readonly { x: number; y: number; inHandle?: { x: number; y: number }; outHandle?: { x: number; y: number }; cornerRadius?: number }[];
        };
        return {
            ...scaleRect(slot, slotScale),
            id: slot.id,
            index: slot.index,
            shape: shapedSlot.shape,
            points: shapedSlot.points?.map((point) => ({
                x: point.x * slotScale,
                y: point.y * slotScale,
                inHandle: point.inHandle ? { x: point.inHandle.x * slotScale, y: point.inHandle.y * slotScale } : undefined,
                outHandle: point.outHandle ? { x: point.outHandle.x * slotScale, y: point.outHandle.y * slotScale } : undefined,
                cornerRadius: point.cornerRadius,
            })),
            column: positionedSlot.column ?? slot.index % renderConfig.layout.columns,
            row: positionedSlot.row ?? Math.floor(slot.index / renderConfig.layout.columns),
        };
    });

    const gridTop = cells.length > 0
        ? Math.min(...cells.map((cell) => cell.y))
        : 0;
    const gridLeft = cells.length > 0
        ? Math.min(...cells.map((cell) => cell.x))
        : 0;
    const gridRight = cells.length > 0
        ? Math.max(...cells.map((cell) => cell.x + cell.width))
        : surface.width;
    const gridBottom = cells.length > 0
        ? Math.max(...cells.map((cell) => cell.y + cell.height))
        : surface.height;

    const frameColor = renderConfig.frameColor || renderConfig.frame.borderColor;

    return Object.freeze({
        surface,
        scale,
        sheet: Object.freeze({
            x: 0,
            y: 0,
            width: surface.width,
            height: surface.height,
        }),
        frame: Object.freeze({
            rect: Object.freeze({
                x: 0,
                y: 0,
                width: surface.width,
                height: surface.height,
            }),
            borderColor: frameColor,
            backgroundColor: renderConfig.frame.id !== "none"
                ? frameColor
                : renderConfig.theme.backgroundColor,
            patternUrl: renderConfig.frame.patternUrl,
        }),
        grid: Object.freeze({
            rect: Object.freeze({
                x: gridLeft,
                y: gridTop,
                width: gridRight - gridLeft,
                height: gridBottom - gridTop,
            }),
            rows: renderConfig.layout.rows,
            columns: renderConfig.layout.columns,
            gap: geometry.gap * scale,
            cells: Object.freeze(cells),
        }),
        brandingArea: geometry.brandingArea
            ? Object.freeze(scaleRect(geometry.brandingArea, scale))
            : undefined,
        overlays: renderConfig.overlays,
    });
}
