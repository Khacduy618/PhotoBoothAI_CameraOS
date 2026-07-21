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
    "2x2": {
        id: "2x2",
        columns: 2,
        rows: 2,
        cellAspectRatio: 0.75, // Portrait 3:4 cells matching the user's 2x2 template reference
        gapPercent: 2.5,
        paddingPercent: 2.5,
        brandingZoneRatio: 0.08, // 8% bottom branding area
    },
    "1x4-vertical": {
        id: "1x4-vertical",
        columns: 1,
        rows: 4,
        cellAspectRatio: 4 / 3, // Landscape 4:3 cells matching camera native format for vertical strip
        gapPercent: 2.5,
        paddingPercent: 2.5,
        brandingZoneRatio: 0.06,
    },
    "2x3": {
        id: "2x3",
        columns: 2,
        rows: 3,
        cellAspectRatio: 0.75, // Portrait 3:4 cells for 6-shot grids
        gapPercent: 2.5,
        paddingPercent: 2.5,
        brandingZoneRatio: 0.06,
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
    
    // Determine target width
    const outputWidth = config.id === "1x4-vertical" ? 1200 : 1600;
    
    // Calculate gap size
    const gap = Math.round(outputWidth * (config.gapPercent / 100));
    
    // Calculate cell dimensions
    const cellWidth = (outputWidth - gap * (config.columns + 1)) / config.columns;
    const cellHeight = cellWidth / config.cellAspectRatio;
    
    // Grid area height (cells + gaps)
    const gridHeight = config.rows * cellHeight + gap * (config.rows + 1);
    
    // Add branding zone to derive total output height
    const outputHeight = Math.round(gridHeight / (1 - config.brandingZoneRatio));
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
    const gap = Math.round(Math.min(outputWidth, outputHeight) * 0.025);
    const cellWidth = (outputWidth - gap * (geometry.columns + 1)) / geometry.columns;
    const gridHeight = outputHeight * (1 - geometry.brandingZoneRatio);
    const cellHeight = (gridHeight - gap * (geometry.rows + 1)) / geometry.rows;

    const count = geometry.columns * geometry.rows;
    const rects: PhotoCellRect[] = [];

    for (let index = 0; index < count; index += 1) {
        const column = index % geometry.columns;
        const row = Math.floor(index / geometry.columns);
        const x = Math.round(gap + column * (cellWidth + gap));
        const y = Math.round(gap + row * (cellHeight + gap));
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
