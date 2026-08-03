import { isCanvaPlaceholderPixel } from "./alpha-mask.service";

export async function punchOutFrameSlots(
    imageUrl: string,
    slots: readonly { x: number; y: number; width: number; height: number }[],
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

                // Smart Selective Cutout:
                // Only clear pixels inside slot bounding boxes IF they are Canva placeholders (clouds, sky blue, green hills, white slot fill)!
                // Decorative stickers (flowers, cartoon eyes, badges, barcodes, borders) are 100% PRESERVED!
                slots.forEach((slot) => {
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

                            // Check if this pixel is a Canva placeholder (clouds, sky blue, green hills, white slot fill)
                            const maxRGB = Math.max(r, g, b);
                            const minRGB = Math.min(r, g, b);
                            const isWhiteOrCloud = minRGB >= 235 && (maxRGB - minRGB) <= 18;

                            if (isCanvaPlaceholderPixel(r, g, b, a) || isWhiteOrCloud) {
                                data[offset + 3] = 0; // Clear to 100% transparent
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
