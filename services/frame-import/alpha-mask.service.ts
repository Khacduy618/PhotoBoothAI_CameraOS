export function isCanvaWhiteSlotPixel(
    r: number,
    g: number,
    b: number,
    a: number,
    alphaThreshold = 220,
): boolean {
    if (a <= alphaThreshold) {
        return true;
    }

    const maxRGB = Math.max(r, g, b);
    const minRGB = Math.min(r, g, b);
    const avgRGB = (r + g + b) / 3;
    const saturation = maxRGB - minRGB;

    // Canva placeholder slots can be pure white, off-white, or light tint fills.
    // Keep saturation <= 20 so colored frame decorations (like pink #F5D2E6 saturation=35) are preserved.
    const isWhiteCanvasSlot = minRGB >= 230 && saturation <= 15;
    const isOffWhiteCanvasSlot = minRGB >= 210 && saturation <= 18;
    const isLightTintPlaceholder = minRGB >= 195 && saturation <= 20;

    return isWhiteCanvasSlot || isOffWhiteCanvasSlot || isLightTintPlaceholder;
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
