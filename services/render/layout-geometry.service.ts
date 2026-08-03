import type { BoothLayoutConfig } from "@/types/customization";
import type { FrameConfig } from "@/types/theme";
import { getLayoutGeometry } from "@/services/layout/layout-engine";
import { LOGICAL_SHEET_DEFAULT, type LogicalSheet } from "./logical-coordinate.service";

export interface PhotoSlotGeometry {
    id: string;
    index: number;
    column: number;
    row: number;
    x: number;
    y: number;
    width: number;
    height: number;
    borderRadius: number;
    objectFit: "cover";
    objectPositionX: number;
    objectPositionY: number;
}

export interface ResolvedLayoutGeometry {
    sheet: LogicalSheet;
    photoSlots: readonly PhotoSlotGeometry[];
    frameBounds: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    brandingArea?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    gap: number;
}

export function resolveLayoutGeometry(
    layout: BoothLayoutConfig,
    frame: FrameConfig,
    sheet?: LogicalSheet
): Readonly<ResolvedLayoutGeometry> {
    const geometry = getLayoutGeometry(layout.id);
    const logicalSheet = sheet ?? {
        width: LOGICAL_SHEET_DEFAULT.width,
        height: Math.round(LOGICAL_SHEET_DEFAULT.width * (layout.outputHeight / layout.outputWidth)),
    };
    const outputPadding = 60;
    const scale = logicalSheet.width / layout.outputWidth;
    const safePadding = Math.round(outputPadding * scale);
    const gap = Math.round(60 * scale);
    
    const availableWidth = logicalSheet.width - safePadding * 2;
    const availableHeight = logicalSheet.height * (1 - geometry.brandingZoneRatio) - safePadding * 2;
    const maxCellWidth = (availableWidth - gap * (layout.columns - 1)) / layout.columns;
    const maxCellHeight = (availableHeight - gap * (layout.rows - 1)) / layout.rows;
    const aspectCellHeight = maxCellWidth / geometry.cellAspectRatio;
    const cellHeight = Math.min(maxCellHeight, aspectCellHeight);
    const cellWidth = cellHeight * geometry.cellAspectRatio;
    const gridWidth = cellWidth * layout.columns + gap * (layout.columns - 1);
    const gridHeight = cellHeight * layout.rows + gap * (layout.rows - 1);
    const startX = safePadding + Math.max(0, (availableWidth - gridWidth) / 2);
    const startY = safePadding + Math.max(0, (availableHeight - gridHeight) / 2);
    
    const photoSlots: PhotoSlotGeometry[] = [];
    const totalCount = layout.columns * layout.rows;
    
    for (let index = 0; index < totalCount; index++) {
        const column = index % layout.columns;
        const row = Math.floor(index / layout.columns);
        const x = Math.round(startX + column * (cellWidth + gap));
        const y = Math.round(startY + row * (cellHeight + gap));
        
        photoSlots.push({
            id: `slot-${index}`,
            index,
            column,
            row,
            x,
            y,
            width: Math.round(cellWidth),
            height: Math.round(cellHeight),
            borderRadius: 0,
            objectFit: "cover",
            objectPositionX: 0.5,
            objectPositionY: 0.5,
        });
    }

    const brandingArea = geometry.brandingZoneRatio > 0 ? {
        x: 0,
        y: gridHeight,
        width: logicalSheet.width,
        height: logicalSheet.height - gridHeight,
    } : undefined;

    const result: ResolvedLayoutGeometry = {
        sheet: logicalSheet,
        photoSlots,
        frameBounds: {
            x: 0,
            y: 0,
            width: logicalSheet.width,
            height: logicalSheet.height,
        },
        brandingArea,
        gap,
    };

    return Object.freeze(result);
}
