import type { DetectedSlot, RawComponent } from "./frame-import.types";

export interface CandidateFilterConfig {
    minAreaRatio: number;
    maxAreaRatio: number;
    minWidthRatio: number;
    minHeightRatio: number;
    minFillRatio: number;
    rejectEdgeTouching: boolean;
}

export const DEFAULT_FILTER_CONFIG: CandidateFilterConfig = Object.freeze({
    minAreaRatio: 0.02,
    maxAreaRatio: 0.95,
    minWidthRatio: 0.15,
    minHeightRatio: 0.08,
    minFillRatio: 0.45,
    rejectEdgeTouching: false,
});

export function filterSlotCandidates(
    components: readonly RawComponent[],
    imageWidth: number,
    imageHeight: number,
    config: CandidateFilterConfig = DEFAULT_FILTER_CONFIG,
): DetectedSlot[] {
    const imageArea = imageWidth * imageHeight;

    const candidates = components
        .map((component, index) => {
            const width = component.maxX - component.minX + 1;
            const height = component.maxY - component.minY + 1;
            const boxArea = width * height;
            const areaRatio = component.area / imageArea;
            const fillRatio = component.area / boxArea;

            return {
                id: `candidate-${index + 1}`,
                order: -1,
                pixelBounds: {
                    x: component.minX,
                    y: component.minY,
                    width,
                    height,
                },
                normalizedBounds: {
                    x: component.minX / imageWidth,
                    y: component.minY / imageHeight,
                    width: width / imageWidth,
                    height: height / imageHeight,
                },
                areaRatio,
                fillRatio,
                touchesCanvasEdge: component.touchesCanvasEdge,
            } satisfies DetectedSlot;
        })
        .filter((slot) => {
            const widthRatio = slot.pixelBounds.width / imageWidth;
            const heightRatio = slot.pixelBounds.height / imageHeight;

            if (config.rejectEdgeTouching && slot.touchesCanvasEdge) {
                return false;
            }

            return (
                slot.areaRatio >= config.minAreaRatio &&
                slot.areaRatio <= config.maxAreaRatio &&
                widthRatio >= config.minWidthRatio &&
                heightRatio >= config.minHeightRatio &&
                slot.fillRatio >= config.minFillRatio
            );
        });

    if (candidates.length <= 1) {
        return candidates;
    }

    // Filter out sticker noise cutouts whose area is less than 30% of the largest photo slot candidate
    const maxCandidateArea = Math.max(...candidates.map((c) => c.areaRatio));
    return candidates.filter((slot) => slot.areaRatio >= maxCandidateArea * 0.30);
}
