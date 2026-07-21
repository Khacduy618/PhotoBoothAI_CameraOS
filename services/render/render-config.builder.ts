import type { BoothSelection } from "@/types/theme";
import type { RenderConfig } from "@/types/render-config";
import type { OverlayItem } from "@/types/customization";
import { resolveBoothLayoutConfig } from "@/config/layout.config";
import { resolveThemeConfig, resolveStyleConfig, resolveFrameConfig } from "@/config/theme.config";
import { AssetManager } from "@/services/platform/asset-manager";

/**
 * Converts legacy StickerCustomization + TextLabelCustomization from BoothOutputCustomization
 * into the unified OverlayItem[] array consumed by RenderConfig.
 *
 * Stickers are rendered before text (lower zIndex).
 */
function buildOverlaysFromCustomization(
    customization: BoothSelection["customization"],
): readonly OverlayItem[] {
    if (customization.overlays && customization.overlays.length > 0) {
        return customization.overlays;
    }

    const overlays: OverlayItem[] = [];

    customization.stickerItems.forEach((sticker, idx) => {
        const rotRad = ((sticker.rotationDegrees || 0) * Math.PI) / 180;
        overlays.push({
            id: sticker.id,
            type: "sticker",
            content: sticker.stickerId,
            x: sticker.x,
            y: sticker.y,
            baseWidth: 150,
            baseHeight: 150,
            scale: sticker.scale,
            rotationRadians: rotRad,
            rotationDegrees: sticker.rotationDegrees,
            zIndex: 10 + idx,
            opacity: 1,
            flipX: false,
            flipY: false,
        });
    });

    customization.textLabels.forEach((label, idx) => {
        const rotRad = ((label.rotationDegrees || 0) * Math.PI) / 180;
        overlays.push({
            id: label.id,
            type: "text",
            content: label.text,
            x: label.x,
            y: label.y,
            baseWidth: 200,
            baseHeight: 50,
            scale: 1,
            rotationRadians: rotRad,
            rotationDegrees: label.rotationDegrees,
            color: label.color,
            fontSize: label.fontSize,
            zIndex: 20 + idx,
            opacity: 1,
        });
    });

    if (customization.drawingStrokes) {
        customization.drawingStrokes.forEach((stroke, idx) => {
            overlays.push({
                id: stroke.id,
                type: "drawing",
                x: 0,
                y: 0,
                baseWidth: 1000,
                baseHeight: 1500,
                scale: 1,
                rotationRadians: 0,
                rotationDegrees: 0,
                color: stroke.color,
                points: stroke.points,
                zIndex: 5 + idx,
                opacity: 1,
            });
        });
    }

    return overlays;
}

/**
 * createRenderConfig — the single entry point for building a RenderConfig from BoothSelection.
 *
 * All render surfaces (PreviewRenderer, LayoutCompositor, ExportRenderer, FinalResultView)
 * call this function and consume RenderConfig exclusively.
 *
 * No render surface parses BoothSelection fields directly.
 */
export function createRenderConfig(selection: BoothSelection): RenderConfig {
    const layout = resolveBoothLayoutConfig(selection.layoutId);
    const theme = resolveThemeConfig(selection.themeId);
    const style = resolveStyleConfig(selection.styleId);

    const resolvedFrame = resolveFrameConfig(selection.frameId);
    const frame = selection.frameColor && selection.frameId !== "none"
        ? { ...resolvedFrame, borderColor: selection.frameColor }
        : resolvedFrame;

    const overlays = buildOverlaysFromCustomization(selection.customization);

    return {
        layout,
        theme,
        frame,
        frameColor: selection.frameColor ?? frame.borderColor,
        style,
        overlays,
        outputWidth: layout.outputWidth,
        outputHeight: layout.outputHeight,
    };
}
