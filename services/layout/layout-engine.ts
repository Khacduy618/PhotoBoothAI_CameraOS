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
    "single-4x6-landscape": {
        id: "single-4x6-landscape",
        columns: 1,
        rows: 1,
        cellAspectRatio: 3 / 2,
        gapPercent: 0,
        paddingPercent: 0,
        brandingZoneRatio: 0,
    },
    "stacked-2-4x6-portrait": {
        id: "stacked-2-4x6-portrait",
        columns: 1,
        rows: 2,
        cellAspectRatio: 4 / 3,
        gapPercent: 2.5,
        paddingPercent: 4,
        brandingZoneRatio: 0,
    },
    "grid-2x2-4x6-portrait": {
        id: "grid-2x2-4x6-portrait",
        columns: 2,
        rows: 2,
        cellAspectRatio: 1,
        gapPercent: 2.5,
        paddingPercent: 4,
        brandingZoneRatio: 0,
    },
    "stacked-4-4x6-portrait": {
        id: "stacked-4-4x6-portrait",
        columns: 1,
        rows: 4,
        cellAspectRatio: 2.2,
        gapPercent: 0,
        paddingPercent: 0,
        brandingZoneRatio: 0,
    },
    "grid-2x3-4x6-portrait": {
        id: "grid-2x3-4x6-portrait",
        columns: 2,
        rows: 3,
        cellAspectRatio: 0.75,
        gapPercent: 0,
        paddingPercent: 0,
        brandingZoneRatio: 0,
    },
    "grid-2x4-4x6-portrait": {
        id: "grid-2x4-4x6-portrait",
        columns: 2,
        rows: 4,
        cellAspectRatio: 0.75,
        gapPercent: 0,
        paddingPercent: 0,
        brandingZoneRatio: 0,
    },
    "2x2": {
        id: "grid-2x2-4x6-portrait",
        columns: 2,
        rows: 2,
        cellAspectRatio: 1,
        gapPercent: 2.5,
        paddingPercent: 4,
        brandingZoneRatio: 0,
    },
    "1x4-vertical": {
        id: "stacked-4-4x6-portrait",
        columns: 1,
        rows: 4,
        cellAspectRatio: 2.2,
        gapPercent: 0,
        paddingPercent: 0,
        brandingZoneRatio: 0,
    },
    "2x3": {
        id: "grid-2x3-4x6-portrait",
        columns: 2,
        rows: 3,
        cellAspectRatio: 0.75,
        gapPercent: 2.5,
        paddingPercent: 3.5,
        brandingZoneRatio: 0,
    },
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
    
    const isLandscape = config.id === "single-4x6-landscape";
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

export function getPhotoCellRects(layoutId: string, outputWidth: number, outputHeight: number): PhotoCellRect[] {
    const geometry = getLayoutGeometry(layoutId);
    const safePadding = 60;
    const gap = 60;
    const cellWidth = (outputWidth - safePadding * 2 - gap * (geometry.columns - 1)) / geometry.columns;
    const gridHeight = outputHeight * (1 - geometry.brandingZoneRatio) - safePadding * 2;
    const cellHeight = (gridHeight - gap * (geometry.rows - 1)) / geometry.rows;

    const count = geometry.columns * geometry.rows;
    const rects: PhotoCellRect[] = [];

    for (let index = 0; index < count; index += 1) {
        const column = index % geometry.columns;
        const row = Math.floor(index / geometry.columns);
        const x = Math.round(safePadding + column * (cellWidth + gap));
        const y = Math.round(safePadding + row * (cellHeight + gap));
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
