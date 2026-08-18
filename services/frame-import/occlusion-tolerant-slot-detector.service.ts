import type { DetectedSlot, RawComponent } from "./frame-import.types";

const ASPECT_RATIOS = [
    { label: "3:2", value: 3 / 2 },
    { label: "2:3", value: 2 / 3 },
    { label: "3:4", value: 3 / 4 },
    { label: "1:1", value: 1 },
] as const;

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function toSlot(
    id: string,
    order: number,
    bounds: { x: number; y: number; width: number; height: number },
    imageWidth: number,
    imageHeight: number,
    area: number,
    fillRatio: number,
    touchesCanvasEdge: boolean,
): DetectedSlot {
    return {
        id,
        order,
        pixelBounds: {
            x: Math.round(bounds.x * imageWidth),
            y: Math.round(bounds.y * imageHeight),
            width: Math.round(bounds.width * imageWidth),
            height: Math.round(bounds.height * imageHeight),
        },
        normalizedBounds: {
            x: Number(bounds.x.toFixed(4)),
            y: Number(bounds.y.toFixed(4)),
            width: Number(bounds.width.toFixed(4)),
            height: Number(bounds.height.toFixed(4)),
        },
        areaRatio: area / (imageWidth * imageHeight),
        fillRatio,
        touchesCanvasEdge,
    };
}

function expandToNearestPhotoAspect(
    bounds: { x: number; y: number; width: number; height: number },
): { x: number; y: number; width: number; height: number } {
    const currentAspect = bounds.width / bounds.height;
    const nearest = ASPECT_RATIOS.reduce((best, candidate) => {
        const bestDelta = Math.abs(Math.log(currentAspect / best.value));
        const nextDelta = Math.abs(Math.log(currentAspect / candidate.value));
        return nextDelta < bestDelta ? candidate : best;
    });

    let width = bounds.width;
    let height = bounds.height;
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;

    if (currentAspect < nearest.value) {
        width = height * nearest.value;
    } else {
        height = width / nearest.value;
    }

    width = Math.min(width, 0.92);
    height = Math.min(height, 0.92);

    return {
        x: clamp(centerX - width / 2, 0, 1 - width),
        y: clamp(centerY - height / 2, 0, 1 - height),
        width,
        height,
    };
}

function overlaps(a: DetectedSlot, b: DetectedSlot): boolean {
    const ax2 = a.normalizedBounds.x + a.normalizedBounds.width;
    const ay2 = a.normalizedBounds.y + a.normalizedBounds.height;
    const bx2 = b.normalizedBounds.x + b.normalizedBounds.width;
    const by2 = b.normalizedBounds.y + b.normalizedBounds.height;
    return a.normalizedBounds.x < bx2 && ax2 > b.normalizedBounds.x && a.normalizedBounds.y < by2 && ay2 > b.normalizedBounds.y;
}

function buildMergedOccludedCandidate(
    components: readonly RawComponent[],
    imageWidth: number,
    imageHeight: number,
): DetectedSlot[] {
    const mergeable = components.filter((component) => !component.touchesCanvasEdge);
    if (mergeable.length < 2 || mergeable.length > 8) return [];

    const minX = Math.min(...mergeable.map((component) => component.minX));
    const minY = Math.min(...mergeable.map((component) => component.minY));
    const maxX = Math.max(...mergeable.map((component) => component.maxX));
    const maxY = Math.max(...mergeable.map((component) => component.maxY));
    const area = mergeable.reduce((sum, component) => sum + component.area, 0);
    const widthRatio = (maxX - minX + 1) / imageWidth;
    const heightRatio = (maxY - minY + 1) / imageHeight;
    const boxArea = (maxX - minX + 1) * (maxY - minY + 1);
    const fillRatio = area / boxArea;

    if (widthRatio < 0.18 || heightRatio < 0.18 || widthRatio > 0.82 || heightRatio > 0.82 || fillRatio < 0.22 || fillRatio > 0.78) {
        return [];
    }

    const expanded = expandToNearestPhotoAspect({
        x: minX / imageWidth,
        y: minY / imageHeight,
        width: widthRatio,
        height: heightRatio,
    });

    return [toSlot("occluded-merged-candidate-1", -1, expanded, imageWidth, imageHeight, area, fillRatio, false)];
}

export function buildOcclusionTolerantSlotCandidates(
    components: readonly RawComponent[],
    imageWidth: number,
    imageHeight: number,
): DetectedSlot[] {
    const imageArea = imageWidth * imageHeight;
    const mergedCandidates = buildMergedOccludedCandidate(components, imageWidth, imageHeight);
    const candidates = components.flatMap((component, index) => {
        const width = component.maxX - component.minX + 1;
        const height = component.maxY - component.minY + 1;
        const boxArea = width * height;
        const areaRatio = component.area / imageArea;
        const fillRatio = component.area / boxArea;
        const widthRatio = width / imageWidth;
        const heightRatio = height / imageHeight;

        if (component.touchesCanvasEdge || areaRatio < 0.008 || areaRatio > 0.5 || widthRatio < 0.08 || heightRatio < 0.06 || fillRatio < 0.28) {
            return [];
        }

        const originalBounds = {
            x: component.minX / imageWidth,
            y: component.minY / imageHeight,
            width: widthRatio,
            height: heightRatio,
        };
        const expanded = expandToNearestPhotoAspect(originalBounds);
        return [toSlot(`occluded-candidate-${index + 1}`, -1, expanded, imageWidth, imageHeight, component.area, Math.min(fillRatio, 0.89), component.touchesCanvasEdge)];
    });

    return [...mergedCandidates, ...candidates]
        .sort((a, b) => (b.normalizedBounds.width * b.normalizedBounds.height) - (a.normalizedBounds.width * a.normalizedBounds.height))
        .filter((candidate, index, list) => list.findIndex((other, otherIndex) => otherIndex < index && overlaps(other, candidate)) === -1);
}
