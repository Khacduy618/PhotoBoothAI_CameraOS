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

export interface BuildMaskResult {
    mask: Uint8Array;
    maskSource: "alpha" | "white-fill";
}

export function buildAlphaMask(
    rgba: Uint8ClampedArray,
    width: number,
    height: number,
    alphaThreshold = 128,
): BuildMaskResult {
    if (rgba.length !== width * height * 4) {
        throw new Error("RGBA buffer size does not match image dimensions.");
    }

    const mask = new Uint8Array(width * height);
    let transparentCount = 0;

    for (let pixelIndex = 0; pixelIndex < width * height; pixelIndex += 1) {
        const offset = pixelIndex * 4;
        const a = rgba[offset + 3];

        if (a < alphaThreshold) {
            mask[pixelIndex] = 1;
            transparentCount += 1;
        }
    }

    // Mode A: True alpha transparent cutouts exist in source PNG
    if (transparentCount > 100) {
        // Check if outer canvas boundary has transparent background pixels (typical for Canva transparent exports)
        let borderHasTransparent = false;
        for (let x = 0; x < width; x += 1) {
            if (mask[x] === 1 || mask[(height - 1) * width + x] === 1) {
                borderHasTransparent = true;
                break;
            }
        }
        if (!borderHasTransparent) {
            for (let y = 0; y < height; y += 1) {
                if (mask[y * width] === 1 || mask[y * width + (width - 1)] === 1) {
                    borderHasTransparent = true;
                    break;
                }
            }
        }

        // If outer border has transparent background, flood-fill from edges to separate outer background from inner slots
        if (borderHasTransparent) {
            const innerSlotsMask = new Uint8Array(mask);
            const visited = new Uint8Array(width * height);
            const queue: number[] = [];

            for (let x = 0; x < width; x += 1) {
                if (innerSlotsMask[x] === 1) queue.push(x);
                const bottomIndex = (height - 1) * width + x;
                if (innerSlotsMask[bottomIndex] === 1) queue.push(bottomIndex);
            }
            for (let y = 0; y < height; y += 1) {
                const leftIndex = y * width;
                if (innerSlotsMask[leftIndex] === 1) queue.push(leftIndex);
                const rightIndex = y * width + (width - 1);
                if (innerSlotsMask[rightIndex] === 1) queue.push(rightIndex);
            }

            let head = 0;
            while (head < queue.length) {
                const idx = queue[head];
                head += 1;
                if (visited[idx] === 1) continue;
                visited[idx] = 1;
                innerSlotsMask[idx] = 0; // Clear outer transparent background

                const x = idx % width;
                const y = Math.floor(idx / width);

                if (x > 0) {
                    const left = idx - 1;
                    if (innerSlotsMask[left] === 1 && visited[left] === 0) queue.push(left);
                }
                if (x < width - 1) {
                    const right = idx + 1;
                    if (innerSlotsMask[right] === 1 && visited[right] === 0) queue.push(right);
                }
                if (y > 0) {
                    const top = idx - width;
                    if (innerSlotsMask[top] === 1 && visited[top] === 0) queue.push(top);
                }
                if (y < height - 1) {
                    const bottom = idx + width;
                    if (innerSlotsMask[bottom] === 1 && visited[bottom] === 0) queue.push(bottom);
                }
            }

            let remainingTransparentCount = 0;
            for (let i = 0; i < width * height; i += 1) {
                if (innerSlotsMask[i] === 1) remainingTransparentCount += 1;
            }

            if (remainingTransparentCount > 100) {
                return { mask: innerSlotsMask, maskSource: "alpha" };
            }
        }

        return { mask, maskSource: "alpha" };
    }

    // Mode B: Opaque PNG (e.g. Canva export without transparent background option)
    // Fall back to detecting white/off-white placeholder boxes
    const whiteMask = new Uint8Array(width * height);
    for (let pixelIndex = 0; pixelIndex < width * height; pixelIndex += 1) {
        const offset = pixelIndex * 4;
        const r = rgba[offset];
        const g = rgba[offset + 1];
        const b = rgba[offset + 2];
        const a = rgba[offset + 3];

        if (isCanvaWhiteSlotPixel(r, g, b, a)) {
            whiteMask[pixelIndex] = 1;
        }
    }

    // Flood-fill from outer image boundaries to clear outer white paper margins
    const visited = new Uint8Array(width * height);
    const queue: number[] = [];

    for (let x = 0; x < width; x += 1) {
        if (whiteMask[x] === 1) queue.push(x);
        const bottomIndex = (height - 1) * width + x;
        if (whiteMask[bottomIndex] === 1) queue.push(bottomIndex);
    }
    for (let y = 0; y < height; y += 1) {
        const leftIndex = y * width;
        if (whiteMask[leftIndex] === 1) queue.push(leftIndex);
        const rightIndex = y * width + (width - 1);
        if (whiteMask[rightIndex] === 1) queue.push(rightIndex);
    }

    let head = 0;
    while (head < queue.length) {
        const idx = queue[head];
        head += 1;
        if (visited[idx] === 1) continue;
        visited[idx] = 1;
        whiteMask[idx] = 0;

        const x = idx % width;
        const y = Math.floor(idx / width);

        if (x > 0) {
            const left = idx - 1;
            if (whiteMask[left] === 1 && visited[left] === 0) queue.push(left);
        }
        if (x < width - 1) {
            const right = idx + 1;
            if (whiteMask[right] === 1 && visited[right] === 0) queue.push(right);
        }
        if (y > 0) {
            const top = idx - width;
            if (whiteMask[top] === 1 && visited[top] === 0) queue.push(top);
        }
        if (y < height - 1) {
            const bottom = idx + width;
            if (whiteMask[bottom] === 1 && visited[bottom] === 0) queue.push(bottom);
        }
    }

    return { mask: whiteMask, maskSource: "white-fill" };
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
