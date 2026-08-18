export interface LayoutGeometry {
    id: string;
    columns: number;
    rows: number;
    cellAspectRatio: number;
    gapPercent: number;
    paddingPercent: number;
    /** Extra vertical space ratio at bottom for branding zone (0..1) */
    brandingZoneRatio: number;
    sheetAspectRatio: number;
    outputWidth: number;
    outputHeight: number;
}

export const LAYOUT_CONFIGS: Record<string, Omit<LayoutGeometry, "sheetAspectRatio" | "outputWidth" | "outputHeight">> = {
    "single-portrait-1200x1800": { id: "single-portrait-1200x1800", columns: 1, rows: 1, cellAspectRatio: 2 / 3, gapPercent: 0, paddingPercent: 0, brandingZoneRatio: 0 },
    "single-landscape-1800x1200": { id: "single-landscape-1800x1200", columns: 1, rows: 1, cellAspectRatio: 3 / 2, gapPercent: 0, paddingPercent: 0, brandingZoneRatio: 0 },
    "two-portrait-1x2": { id: "two-portrait-1x2", columns: 1, rows: 2, cellAspectRatio: 2 / 3, gapPercent: 0, paddingPercent: 0, brandingZoneRatio: 0 },
    "two-landscape-1x2": { id: "two-landscape-1x2", columns: 1, rows: 2, cellAspectRatio: 3 / 2, gapPercent: 0, paddingPercent: 0, brandingZoneRatio: 0 },
    "four-portrait-2x2": { id: "four-portrait-2x2", columns: 2, rows: 2, cellAspectRatio: 2 / 3, gapPercent: 0, paddingPercent: 0, brandingZoneRatio: 0 },
    "four-landscape-2x2": { id: "four-landscape-2x2", columns: 2, rows: 2, cellAspectRatio: 3 / 2, gapPercent: 0, paddingPercent: 0, brandingZoneRatio: 0 },
    "four-portrait-1x4": { id: "four-portrait-1x4", columns: 1, rows: 4, cellAspectRatio: 2 / 3, gapPercent: 0, paddingPercent: 0, brandingZoneRatio: 0 },
    "four-landscape-1x4": { id: "four-landscape-1x4", columns: 1, rows: 4, cellAspectRatio: 3 / 2, gapPercent: 0, paddingPercent: 0, brandingZoneRatio: 0 },
    "six-portrait-2x3": { id: "six-portrait-2x3", columns: 2, rows: 3, cellAspectRatio: 2 / 3, gapPercent: 0, paddingPercent: 0, brandingZoneRatio: 0 },
    "six-landscape-2x3": { id: "six-landscape-2x3", columns: 2, rows: 3, cellAspectRatio: 3 / 2, gapPercent: 0, paddingPercent: 0, brandingZoneRatio: 0 },
    "eight-portrait-2x4": { id: "eight-portrait-2x4", columns: 2, rows: 4, cellAspectRatio: 2 / 3, gapPercent: 0, paddingPercent: 0, brandingZoneRatio: 0 },
    "eight-landscape-2x4": { id: "eight-landscape-2x4", columns: 2, rows: 4, cellAspectRatio: 3 / 2, gapPercent: 0, paddingPercent: 0, brandingZoneRatio: 0 },
    "two-landscape-2x1": { id: "two-landscape-1x2", columns: 1, rows: 2, cellAspectRatio: 3 / 2, gapPercent: 0, paddingPercent: 0, brandingZoneRatio: 0 },
    "six-landscape-3x2": { id: "six-landscape-2x3", columns: 2, rows: 3, cellAspectRatio: 3 / 2, gapPercent: 0, paddingPercent: 0, brandingZoneRatio: 0 },
    "eight-landscape-4x2": { id: "eight-landscape-2x4", columns: 2, rows: 4, cellAspectRatio: 3 / 2, gapPercent: 0, paddingPercent: 0, brandingZoneRatio: 0 },
    "single-4x6-landscape": { id: "single-landscape-1800x1200", columns: 1, rows: 1, cellAspectRatio: 3 / 2, gapPercent: 0, paddingPercent: 0, brandingZoneRatio: 0 },
    "stacked-2-4x6-portrait": { id: "two-portrait-1x2", columns: 1, rows: 2, cellAspectRatio: 2 / 3, gapPercent: 0, paddingPercent: 0, brandingZoneRatio: 0 },
    "grid-2x2-4x6-portrait": { id: "four-portrait-2x2", columns: 2, rows: 2, cellAspectRatio: 2 / 3, gapPercent: 0, paddingPercent: 0, brandingZoneRatio: 0 },
    "stacked-4-4x6-portrait": { id: "four-portrait-1x4", columns: 1, rows: 4, cellAspectRatio: 2 / 3, gapPercent: 0, paddingPercent: 0, brandingZoneRatio: 0 },
    "grid-2x3-4x6-portrait": { id: "six-portrait-2x3", columns: 2, rows: 3, cellAspectRatio: 2 / 3, gapPercent: 0, paddingPercent: 0, brandingZoneRatio: 0 },
    "grid-2x4-4x6-portrait": { id: "eight-portrait-2x4", columns: 2, rows: 4, cellAspectRatio: 2 / 3, gapPercent: 0, paddingPercent: 0, brandingZoneRatio: 0 },
    "2x2": { id: "four-portrait-2x2", columns: 2, rows: 2, cellAspectRatio: 2 / 3, gapPercent: 0, paddingPercent: 0, brandingZoneRatio: 0 },
    "1x4-vertical": { id: "four-portrait-1x4", columns: 1, rows: 4, cellAspectRatio: 2 / 3, gapPercent: 0, paddingPercent: 0, brandingZoneRatio: 0 },
    "2x3": { id: "six-portrait-2x3", columns: 2, rows: 3, cellAspectRatio: 2 / 3, gapPercent: 0, paddingPercent: 0, brandingZoneRatio: 0 },
};

/**
 * Dynamically computes layout geometry dimensions and aspect ratios.
 *
 * Formula:
 *   cellWidth  = (outputWidth − gap × (columns + 1)) / columns
 *   cellHeight = cellWidth / cellAspectRatio
 *   gridHeight = rows × cellHeight + gap × (rows + 1)
 *   outputHeight = gridHeight / (1 − brandingZoneRatio)
 */
export function getLayoutGeometry(layoutId: string): LayoutGeometry {
    const config = LAYOUT_CONFIGS[layoutId] || LAYOUT_CONFIGS["2x2"];
    
    const isLandscape = config.id.includes("landscape") || config.id.includes("1800x1200");
    const outputWidth = isLandscape ? 1800 : 1200;
    const outputHeight = isLandscape ? 1200 : 1800;
    const sheetAspectRatio = outputWidth / outputHeight;
    
    return {
        ...config,
        sheetAspectRatio,
        outputWidth,
        outputHeight,
    };
}

export interface PhotoCellRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

const DEFAULT_SLOT_PADDING = Object.freeze({
    top: 20,
    right: 20,
    bottom: 100,
    left: 20,
});

export function getPhotoCellRects(layoutId: string, outputWidth: number, outputHeight: number): PhotoCellRect[] {
    const geometry = getLayoutGeometry(layoutId);
    const gap = 20;
    const availableWidth = outputWidth - DEFAULT_SLOT_PADDING.left - DEFAULT_SLOT_PADDING.right;
    const availableHeight = outputHeight - DEFAULT_SLOT_PADDING.top - DEFAULT_SLOT_PADDING.bottom;
    const maxCellWidth = (availableWidth - gap * (geometry.columns - 1)) / geometry.columns;
    const maxCellHeight = (availableHeight - gap * (geometry.rows - 1)) / geometry.rows;
    const aspectCellHeight = maxCellWidth / geometry.cellAspectRatio;
    const cellHeight = Math.min(maxCellHeight, aspectCellHeight);
    const cellWidth = cellHeight * geometry.cellAspectRatio;
    const gridWidth = cellWidth * geometry.columns + gap * (geometry.columns - 1);
    const gridHeight = cellHeight * geometry.rows + gap * (geometry.rows - 1);
    const startX = DEFAULT_SLOT_PADDING.left + Math.max(0, (availableWidth - gridWidth) / 2);
    const startY = DEFAULT_SLOT_PADDING.top + Math.max(0, (availableHeight - gridHeight) / 2);

    const count = geometry.columns * geometry.rows;
    const rects: PhotoCellRect[] = [];

    for (let index = 0; index < count; index += 1) {
        const column = index % geometry.columns;
        const row = Math.floor(index / geometry.columns);
        const x = Math.round(startX + column * (cellWidth + gap));
        const y = Math.round(startY + row * (cellHeight + gap));
        const width = Math.round(cellWidth);
        const height = Math.round(cellHeight);
        rects.push({ x, y, width, height });
    }

    return rects;
}

export interface CropParameters {
    sourceX: number;
    sourceY: number;
    sourceWidth: number;
    sourceHeight: number;
    scale: number;
}

/**
 * Calculates cover crop parameters for canvas and visualizers.
 */
export function calculateCoverCrop(
    imageWidth: number,
    imageHeight: number,
    targetWidth: number,
    targetHeight: number,
): CropParameters {
    const scale = Math.max(
        targetWidth / imageWidth,
        targetHeight / imageHeight,
    );
    const scaledWidth = imageWidth * scale;
    const scaledHeight = imageHeight * scale;
    const sourceX = Math.max(0, (scaledWidth - targetWidth) / 2 / scale);
    const sourceY = Math.max(0, (scaledHeight - targetHeight) / 2 / scale);
    const sourceWidth = Math.min(imageWidth, targetWidth / scale);
    const sourceHeight = Math.min(imageHeight, targetHeight / scale);

    return {
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        scale,
    };
}
