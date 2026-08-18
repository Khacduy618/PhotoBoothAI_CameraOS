import type { StickerCustomization, TextLabelCustomization } from "@/types/customization";

export interface OverlayItem {
    id: string;
    type: "sticker" | "text" | "logo" | "watermark" | "qr" | "ai-decoration";
    x: number;
    y: number;
    scale: number;
    rotationDegrees: number;
    metadata?: Record<string, unknown>;
}

export class OverlayManager {
    static clamp(val: number, min = 0, max = 1): number {
        return Math.min(Math.max(min, val), max);
    }

    static moveSticker(item: StickerCustomization, dx: number, dy: number): StickerCustomization {
        return {
            ...item,
            x: this.clamp(item.x + dx),
            y: this.clamp(item.y + dy),
        };
    }

    static moveText(item: TextLabelCustomization, dx: number, dy: number): TextLabelCustomization {
        return {
            ...item,
            x: this.clamp(item.x + dx),
            y: this.clamp(item.y + dy),
        };
    }

    static scaleSticker(item: StickerCustomization, factor: number): StickerCustomization {
        return {
            ...item,
            scale: Math.min(Math.max(0.2, item.scale * factor), 4.0),
        };
    }

    static rotateSticker(item: StickerCustomization, angle: number): StickerCustomization {
        let newAngle = (item.rotationDegrees + angle) % 360;
        if (newAngle < 0) newAngle += 360;
        return {
            ...item,
            rotationDegrees: newAngle,
        };
    }

    static rotateText(item: TextLabelCustomization, angle: number): TextLabelCustomization {
        let newAngle = (item.rotationDegrees + angle) % 360;
        if (newAngle < 0) newAngle += 360;
        return {
            ...item,
            rotationDegrees: newAngle,
        };
    }

    static transformStickers(
        items: readonly StickerCustomization[],
        oldAspect: number,
        newAspect: number
    ): StickerCustomization[] {
        const aspectScale = oldAspect > 0 ? (newAspect / oldAspect) : 1;
        return items.map(item => {
            const relX = item.x - 0.5;
            const newX = this.clamp(0.5 + relX * aspectScale, 0.05, 0.95);
            const newY = this.clamp(item.y, 0.05, 0.95);
            return { ...item, x: newX, y: newY };
        });
    }

    static transformTextLabels(
        items: readonly TextLabelCustomization[],
        oldAspect: number,
        newAspect: number
    ): TextLabelCustomization[] {
        const aspectScale = oldAspect > 0 ? (newAspect / oldAspect) : 1;
        return items.map(item => {
            const relX = item.x - 0.5;
            const newX = this.clamp(0.5 + relX * aspectScale, 0.05, 0.95);
            const newY = this.clamp(item.y, 0.05, 0.95);
            return { ...item, x: newX, y: newY };
        });
    }
}
