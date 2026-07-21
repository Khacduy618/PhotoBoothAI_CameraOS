import type { ThemeConfig, StyleConfig, FrameConfig } from "@/types/theme";
import type { BoothLayoutConfig, OverlayItem } from "@/types/customization";

/**
 * RenderConfig — the single normalized descriptor consumed by every render surface.
 *
 * Pipeline:
 *   BoothSelection
 *     ↓  createRenderConfig()
 *   RenderConfig
 *     ↓
 *   PreviewRenderer | LayoutCompositor | ExportRenderer | PrintRenderer
 *
 * All render surfaces read from RenderConfig only.
 * No render surface parses BoothSelection directly.
 */
export interface RenderConfig {
    /** Resolved layout geometry */
    layout: BoothLayoutConfig;
    /** Resolved theme (colors, text style) */
    theme: ThemeConfig;
    /** Resolved frame config with final color applied */
    frame: FrameConfig;
    /** Override frame border color after frame package selection */
    frameColor?: string;
    /** Resolved style/filter */
    style: StyleConfig;
    /** Ordered overlay items to composite above photos */
    overlays: readonly OverlayItem[];
    /** Target output pixel width */
    outputWidth: number;
    /** Target output pixel height */
    outputHeight: number;
}
