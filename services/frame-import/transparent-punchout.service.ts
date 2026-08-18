import { isCanvaWhiteSlotPixel } from "./alpha-mask.service";

interface PunchOutSlot {
    x: number;
    y: number;
    width: number;
    height: number;
    shape?: "rect" | "polygon" | "bezier";
    points?: readonly { x: number; y: number }[];
}

function cubicPoint(p0: { x: number; y: number }, c1: { x: number; y: number }, c2: { x: number; y: number }, p1: { x: number; y: number }, t: number): { x: number; y: number } {
    const inv = 1 - t;
    return {
        x: inv ** 3 * p0.x + 3 * inv ** 2 * t * c1.x + 3 * inv * t ** 2 * c2.x + t ** 3 * p1.x,
        y: inv ** 3 * p0.y + 3 * inv ** 2 * t * c1.y + 3 * inv * t ** 2 * c2.y + t ** 3 * p1.y,
    };
}

function flattenBezierPoints(points: readonly { x: number; y: number; inHandle?: { x: number; y: number }; outHandle?: { x: number; y: number }; cornerRadius?: number }[]): { x: number; y: number }[] {
    if (points.length < 3) return points.map((point) => ({ x: point.x, y: point.y }));
    if (points.some((point) => (point.cornerRadius ?? 0) > 0) && points.every((point) => !point.inHandle && !point.outHandle)) {
        const getInsetPoint = (from: { x: number; y: number }, to: { x: number; y: number }, radius: number) => {
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const length = Math.hypot(dx, dy) || 1;
            const distance = Math.min(radius, length / 2);
            return { x: from.x + (dx / length) * distance, y: from.y + (dy / length) * distance };
        };
        const flattened: { x: number; y: number }[] = [];
        for (let index = 0; index < points.length; index += 1) {
            const previous = points[(index - 1 + points.length) % points.length];
            const current = points[index];
            const next = points[(index + 1) % points.length];
            const radius = current.cornerRadius ?? 0;
            if (radius > 0) {
                const before = getInsetPoint(current, previous, radius);
                const after = getInsetPoint(current, next, radius);
                flattened.push(before);
                for (let step = 1; step <= 8; step += 1) {
                    const t = step / 8;
                    const inv = 1 - t;
                    flattened.push({
                        x: inv * inv * before.x + 2 * inv * t * current.x + t * t * after.x,
                        y: inv * inv * before.y + 2 * inv * t * current.y + t * t * after.y,
                    });
                }
            } else {
                flattened.push({ x: current.x, y: current.y });
            }
        }
        return flattened;
    }
    const flattened: { x: number; y: number }[] = [];
    for (let index = 0; index < points.length; index += 1) {
        const current = points[index];
        const next = points[(index + 1) % points.length];
        const c1 = current.outHandle ?? current;
        const c2 = next.inHandle ?? next;
        if (index === 0) flattened.push({ x: current.x, y: current.y });
        for (let step = 1; step <= 12; step += 1) {
            flattened.push(cubicPoint(current, c1, c2, next, step / 12));
        }
    }
    return flattened;
}

export function isPointInsideFrameSlotCutout(x: number, y: number, points: readonly { x: number; y: number }[]): boolean {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
        const xi = points[i].x;
        const yi = points[i].y;
        const xj = points[j].x;
        const yj = points[j].y;
        const intersects = ((yi > y) !== (yj > y)) &&
            (x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi);
        if (intersects) inside = !inside;
    }
    return inside;
}

export function shouldClearFrameSlotPixel({
    x,
    y,
    r,
    g,
    b,
    a,
    polygonPoints,
}: {
    x: number;
    y: number;
    r: number;
    g: number;
    b: number;
    a: number;
    polygonPoints?: readonly { x: number; y: number }[] | null;
}): boolean {
    if (polygonPoints && !isPointInsideFrameSlotCutout(x, y, polygonPoints)) {
        return false;
    }

    return isCanvaWhiteSlotPixel(r, g, b, a);
}

export async function punchOutFrameSlots(
    imageUrl: string,
    slots: readonly PunchOutSlot[],
): Promise<string> {
    if (typeof window === "undefined" || !imageUrl || slots.length === 0) {
        return imageUrl;
    }

    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            try {
                const canvas = document.createElement("canvas");
                canvas.width = img.naturalWidth || img.width;
                canvas.height = img.naturalHeight || img.height;
                const ctx = canvas.getContext("2d");
                if (!ctx) {
                    resolve(imageUrl);
                    return;
                }

                // Draw original imported Canva image
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;

                // Smart selective cutout:
                // Only clear strict white/off-white Canva slot fill inside detected slots.
                // Colored/patterned frame backgrounds and decorations are preserved.
                slots.forEach((slot) => {
                    const polygonPoints = (slot.shape === "polygon" || slot.shape === "bezier") && slot.points && slot.points.length >= 3
                        ? flattenBezierPoints(slot.points).map((point) => ({ x: point.x * canvas.width, y: point.y * canvas.height }))
                        : null;
                    const minX = Math.max(0, Math.floor(slot.x * canvas.width));
                    const minY = Math.max(0, Math.floor(slot.y * canvas.height));
                    const maxX = Math.min(canvas.width, Math.ceil((slot.x + slot.width) * canvas.width));
                    const maxY = Math.min(canvas.height, Math.ceil((slot.y + slot.height) * canvas.height));

                    for (let y = minY; y < maxY; y++) {
                        for (let x = minX; x < maxX; x++) {
                            const offset = (y * canvas.width + x) * 4;
                            const r = data[offset];
                            const g = data[offset + 1];
                            const b = data[offset + 2];
                            const a = data[offset + 3];

                            if (shouldClearFrameSlotPixel({
                                x: x + 0.5,
                                y: y + 0.5,
                                r,
                                g,
                                b,
                                a,
                                polygonPoints,
                            })) {
                                data[offset + 3] = 0; // Clear white slot fill to 100% transparent
                            }
                        }
                    }
                });

                ctx.putImageData(imageData, 0, 0);
                resolve(canvas.toDataURL("image/png"));
            } catch {
                resolve(imageUrl);
            }
        };
        img.onerror = () => resolve(imageUrl);
        img.src = imageUrl;
    });
}
