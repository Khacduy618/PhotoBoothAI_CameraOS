export function isCanvaWhiteSlotPixel(
    r: number,
    g: number,
    b: number,
    a: number,
    alphaThreshold = 16,
): boolean {
    if (a <= alphaThreshold) {
        return true;
    }

    const maxRGB = Math.max(r, g, b);
    const minRGB = Math.min(r, g, b);
    const saturation = maxRGB - minRGB;

    // Canva often exports empty photo slots as opaque white/off-white rectangles.
    // Keep this intentionally strict: only near-neutral bright pixels are treated
    // as removable slot fill so colored/patterned frame backgrounds are preserved.
    const isWhiteCanvasSlot = minRGB >= 244 && saturation <= 10;
    const isOffWhiteCanvasSlot = minRGB >= 235 && saturation <= 8;

    return isWhiteCanvasSlot || isOffWhiteCanvasSlot;
}

export function isCanvaPlaceholderPixel(
    r: number,
    g: number,
    b: number,
    a: number,
    alphaThreshold = 16,
): boolean {
    return isCanvaWhiteSlotPixel(r, g, b, a, alphaThreshold);
}

export function buildAlphaMask(
    rgba: Uint8ClampedArray,
    width: number,
    height: number,
    alphaThreshold = 16,
): Uint8Array {
    if (rgba.length !== width * height * 4) {
        throw new Error("RGBA buffer size does not match image dimensions.");
    }

    const mask = new Uint8Array(width * height);

    for (let pixelIndex = 0; pixelIndex < width * height; pixelIndex += 1) {
        const offset = pixelIndex * 4;
        const r = rgba[offset];
        const g = rgba[offset + 1];
        const b = rgba[offset + 2];
        const a = rgba[offset + 3];

        mask[pixelIndex] = isCanvaPlaceholderPixel(r, g, b, a, alphaThreshold) ? 1 : 0;
    }

    return mask;
}

export function buildCompanionMask(
    mask: Uint8Array,
    width: number,
    height: number,
): Uint8Array {
    if (mask.length !== width * height) {
        throw new Error("Companion mask size does not match image dimensions.");
    }

    const normalized = new Uint8Array(mask.length);
    for (let index = 0; index < mask.length; index += 1) {
        normalized[index] = mask[index] > 0 ? 1 : 0;
    }

    return normalized;
}
