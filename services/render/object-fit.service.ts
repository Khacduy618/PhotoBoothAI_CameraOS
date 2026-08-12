import type { PhotoFitMode } from "@/types/theme";

export interface ObjectFitRectInput {
    imageWidth: number;
    imageHeight: number;
    targetX: number;
    targetY: number;
    targetWidth: number;
    targetHeight: number;
    fit: PhotoFitMode;
}

export interface ObjectFitRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export function calculateObjectFitRect({
    imageWidth,
    imageHeight,
    targetX,
    targetY,
    targetWidth,
    targetHeight,
    fit,
}: ObjectFitRectInput): ObjectFitRect {
    if (
        imageWidth <= 0 ||
        imageHeight <= 0 ||
        targetWidth <= 0 ||
        targetHeight <= 0
    ) {
        return {
            x: targetX,
            y: targetY,
            width: targetWidth,
            height: targetHeight,
        };
    }

    const imageAspect = imageWidth / imageHeight;
    const targetAspect = targetWidth / targetHeight;
    let width = targetWidth;
    let height = targetHeight;

    if (fit === "contain") {
        if (imageAspect > targetAspect) {
            height = targetWidth / imageAspect;
        } else {
            width = targetHeight * imageAspect;
        }
    } else if (imageAspect > targetAspect) {
        width = targetHeight * imageAspect;
    } else {
        height = targetWidth / imageAspect;
    }

    return {
        x: targetX + (targetWidth - width) / 2,
        y: targetY + (targetHeight - height) / 2,
        width,
        height,
    };
}
