import type { BoothSelection } from "@/types/theme";
import type { RenderConfig, AssetManifest, CreateRenderConfigInput } from "@/types/render-config";
import type { OverlayItem, StickerOverlay, TextOverlay } from "@/types/customization";
import { resolveBoothLayoutConfig } from "@/config/layout.config";
import { resolveFrameConfig } from "@/config/frame.config";
import { resolveThemeConfig, resolveStyleConfig } from "@/config/theme.config";
import { AssetManager } from "@/services/platform/asset-manager";
import { resolvePhotoSlots } from "@/services/render/photo-slot-resolver.service";

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
        const ext = sticker as unknown as Partial<StickerOverlay>;
        overlays.push({
            id: sticker.id,
            type: "sticker",
            content: sticker.stickerId,
            x: sticker.x,
            y: sticker.y,
            baseWidth: 150,
            baseHeight: 150,
            scale: sticker.scale ?? 1,
            rotationRadians: rotRad,
            rotationDegrees: sticker.rotationDegrees,
            zIndex: ext.zIndex ?? (10 + idx),
            opacity: ext.opacity ?? 1,
            flipX: ext.flipX ?? false,
            flipY: ext.flipY ?? false,
        });
    });

    customization.textLabels.forEach((label, idx) => {
        const rotRad = ((label.rotationDegrees || 0) * Math.PI) / 180;
        const ext = label as unknown as Partial<TextOverlay>;
        overlays.push({
            id: label.id,
            type: "text",
            content: label.text,
            x: label.x,
            y: label.y,
            baseWidth: 200,
            baseHeight: 50,
            scale: ext.scale ?? 1,
            rotationRadians: rotRad,
            rotationDegrees: label.rotationDegrees,
            color: label.color,
            fontSize: label.fontSize,
            fontFamily: ext.fontFamily,
            fontWeight: ext.fontWeight,
            outlineColor: ext.outlineColor,
            outlineWidth: ext.outlineWidth,
            shadowPreset: ext.shadowPreset,
            letterSpacing: ext.letterSpacing,
            align: ext.align,
            zIndex: ext.zIndex ?? (20 + idx),
            opacity: ext.opacity ?? 1,
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

    return [...overlays].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
}

/**
 * createRenderConfig — the single entry point for building a RenderConfig from BoothSelection.
 *
 * All render surfaces (PreviewRenderer, LayoutCompositor, ExportRenderer, FinalResultView)
 * call this function and consume RenderConfig exclusively.
 *
 * No render surface parses BoothSelection fields directly.
 */
export function createRenderConfig(
    inputOrSelection: BoothSelection | CreateRenderConfigInput
): RenderConfig {
    const selection: BoothSelection = "selection" in inputOrSelection ? inputOrSelection.selection : inputOrSelection;
    const capturedPhotos = "capturedPhotos" in inputOrSelection ? inputOrSelection.capturedPhotos || [] : [];

    const layout = resolveBoothLayoutConfig(selection.layoutId);
    const theme = resolveThemeConfig(selection.themeId);
    const style = resolveStyleConfig(selection.styleId);

    const resolvedFrame = resolveFrameConfig(selection.frameId);
    const frame = selection.frameColor && selection.frameId !== "none"
        ? { ...resolvedFrame, borderColor: selection.frameColor }
        : resolvedFrame;

    const overlays = buildOverlaysFromCustomization(selection.customization);
    const photoSlots = resolvePhotoSlots({ layout, frame });

    // Build AssetManifest
    const stickerUrls: string[] = [];
    const fontDescriptors: string[] = [];

    overlays.forEach((item) => {
        if (item.type === "sticker") {
            const stickerObj = AssetManager.getStickerConfigs().find((s) => s.id === item.content);
            if (stickerObj) {
                stickerUrls.push(stickerObj.id);
            }
        } else if (item.type === "text") {
            const fontSpec = `${item.fontWeight || 900} ${item.fontSize || 48}px "${item.fontFamily || "sans-serif"}"`;
            fontDescriptors.push(fontSpec);
        }
    });

    const assetManifest: AssetManifest = {
        backgroundUrl: frame.kind === "template" ? frame.patternUrl : undefined,
        frameUrl: frame.assetUrl ?? frame.patternUrl,
        stickerUrls,
        capturedPhotoBlobs: capturedPhotos.map((p) => p.originalBlob),
        fontDescriptors,
    };

    const outputWidth = frame.outputWidth || layout.outputWidth;
    const outputHeight = frame.outputHeight || layout.outputHeight;

    return {
        layout,
        theme,
        frame,
        frameColor: selection.frameColor ?? frame.borderColor,
        style,
        overlays,
        photoSlots,
        assetManifest,
        outputWidth,
        outputHeight,
    };
}
