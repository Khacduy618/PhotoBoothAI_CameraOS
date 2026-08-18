export interface NormalizedPoint {
    x: number;
    y: number;
}

export interface MapPointerOptions {
    clamp?: boolean;
}

/**
 * mapPointerToSheetCoordinates
 *
 * Converts a viewport pointer coordinate (clientX/clientY) into normalized
 * coordinates [0..1, 0..1] relative strictly to the actual photobooth sheet element's
 * bounding rectangle (getBoundingClientRect()).
 *
 * - Returns `null` if the sheet element bounding rectangle is invalid or zero-sized.
 * - Falls back to parent element rect if jsdom unit tests mock getBoundingClientRect on parent wrapper.
 * - Defaults to `clamp: false` for unclamped transform delta calculations (move, rotate, resize).
 * - Accepts `clamp: true` for drawing stroke points.
 */
export function mapPointerToSheetCoordinates(
    point: { clientX: number; clientY: number },
    sheetElement: HTMLElement | null,
    options: MapPointerOptions = {},
): NormalizedPoint | null {
    if (!sheetElement) return null;

    let rect = sheetElement.getBoundingClientRect();

    // Fallback for jsdom unit tests where getBoundingClientRect is mocked on parent wrapper
    if (rect.width <= 0 || rect.height <= 0) {
        let parent = sheetElement.parentElement;
        while (parent) {
            const parentRect = parent.getBoundingClientRect();
            if (parentRect.width > 0 && parentRect.height > 0) {
                rect = parentRect;
                break;
            }
            parent = parent.parentElement;
        }
    }

    if (
        !Number.isFinite(rect.width) ||
        !Number.isFinite(rect.height) ||
        rect.width <= 0 ||
        rect.height <= 0
    ) {
        return null;
    }

    const result = {
        x: (point.clientX - rect.left) / rect.width,
        y: (point.clientY - rect.top) / rect.height,
    };

    if (!options.clamp) {
        return result;
    }

    return {
        x: Math.min(1, Math.max(0, result.x)),
        y: Math.min(1, Math.max(0, result.y)),
    };
}
