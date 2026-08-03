import type { TextOverlay, OverlayItem } from "@/types/customization";

export type OverlayId = string;

export interface TextLineLayout {
    text: string;
    graphemes: string[];
    width: number;
    x: number;
    y: number;
}

export interface TextLayoutResult {
    lines: readonly TextLineLayout[];
    bounds: { x: number; y: number; width: number; height: number };
    anchor: { x: number; y: number };
    width: number;
    height: number;
}

export interface PreparedTextLayouts {
    layouts: Record<OverlayId, TextLayoutResult>;
}

export class TextLayoutEngine {
    public static getGraphemes(text: string): string[] {
        if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
            const segmenter = new Intl.Segmenter("vi", { granularity: "grapheme" });
            return Array.from(segmenter.segment(text), (s) => s.segment);
        }
        return Array.from(text);
    }

    public static computeTextLayout(
        overlay: TextOverlay,
        measureTextWidth?: (text: string, fontSpec: string) => number
    ): TextLayoutResult {
        const rawContent = (overlay.content || "").toUpperCase();
        const graphemes = this.getGraphemes(rawContent);
        
        // Logical font sizing
        const scale = overlay.scale ?? 1;
        const fontSize = (overlay.fontSize || 48) * scale;
        
        // Approximate width if canvas measureText not passed
        const approxCharWidth = fontSize * 0.6;
        const measuredWidth = measureTextWidth
            ? measureTextWidth(rawContent, `${fontSize}px ${overlay.fontFamily || "sans-serif"}`)
            : rawContent.length * approxCharWidth;

        const height = fontSize * 1.2;

        const singleLine: TextLineLayout = {
            text: rawContent,
            graphemes,
            width: measuredWidth,
            x: 0,
            y: 0,
        };

        return {
            lines: Object.freeze([singleLine]),
            bounds: Object.freeze({
                x: overlay.x * 1000 - measuredWidth / 2,
                y: overlay.y * 1500 - height / 2,
                width: measuredWidth,
                height,
            }),
            anchor: Object.freeze({ x: 0.5, y: 0.5 }),
            width: measuredWidth,
            height,
        };
    }

    public static prepareTextLayouts(
        overlays: readonly OverlayItem[],
        measureTextWidth?: (text: string, fontSpec: string) => number
    ): PreparedTextLayouts {
        const layouts: Record<OverlayId, TextLayoutResult> = {};

        for (const item of overlays) {
            if (item.type === "text") {
                layouts[item.id] = this.computeTextLayout(item, measureTextWidth);
            }
        }

        return Object.freeze({ layouts });
    }
}
