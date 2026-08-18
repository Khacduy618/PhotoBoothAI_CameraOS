import { resolveBoothLayoutConfig } from "@/config/layout.config";
import type { BoothLayoutConfig } from "@/types/customization";
import type { RenderConfig } from "@/types/render-config";
import type { RenderSurface } from "@/types/render-config";
import { resolveLayoutGeometry } from "./layout-geometry.service";
import { TextLayoutEngine } from "./text-layout.service";
import { RenderAssetLoaderService } from "./render-asset-loader.service";
import { CanvasRenderer } from "./canvas-renderer.service";
import { resolveRenderPlan } from "./render-plan.service";
import { resolvePhotoSlots } from "./photo-slot-resolver.service";

export interface LayoutCompositorSource {
    photoId: string;
    blob: Blob;
}

export interface LayoutCompositorCell {
    photoId: string;
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface ComposeLayoutResult {
    blob: Blob;
    layoutId: BoothLayoutConfig["id"];
    width: number;
    height: number;
    sourcePhotoIds: readonly string[];
    cells: readonly LayoutCompositorCell[];
}

export interface CanvasLike {
    width: number;
    height: number;
    getContext(contextId: "2d"): CanvasRenderingContext2D | null;
    toBlob(
        callback: (blob: Blob | null) => void,
        type?: string,
        quality?: number,
    ): void;
}

interface PartialPhotoLoadError extends Error {
    partialPhotos?: Map<string, HTMLImageElement>;
}

export interface ComposeLayoutOptions {
    sources: readonly LayoutCompositorSource[];
    createImage?: (blob: Blob) => Promise<HTMLImageElement>;
    createCanvas?: () => CanvasLike;
    renderConfig?: RenderConfig;
    layoutId?: string;
    borderColor?: string;
    patternUrl?: string;
    textLabel?: string;
    textColor?: string;
}

export async function composePhotoLayout(
    options: ComposeLayoutOptions,
): Promise<ComposeLayoutResult> {
    const { sources, renderConfig, layoutId = "2x2", createCanvas } = options;
    const resolvedLayout = renderConfig
        ? renderConfig.layout
        : resolveBoothLayoutConfig(layoutId);

    if (sources.length !== resolvedLayout.shotCount) {
        throw new Error(
            `Layout ${resolvedLayout.name} cần ${resolvedLayout.shotCount} ảnh, hiện có ${sources.length} ảnh.`,
        );
    }

    const sourceBlobs = sources.map((source) => source.blob);
    const config: RenderConfig = renderConfig
        ? {
            ...renderConfig,
            assetManifest: {
                ...renderConfig.assetManifest,
                capturedPhotoBlobs: sourceBlobs,
            },
        }
        : {
            layout: resolvedLayout,
            theme: { id: "classic", name: "Classic", description: "", backgroundColor: "#ffffff", textColor: "#000000", accentColor: "#0000ff" },
            frame: { id: "none", name: "None", description: "", borderColor: options.borderColor || "transparent", borderWidth: 0, kind: "none" },
            style: { id: "none", name: "None", description: "", mode: "none" },
            overlays: [],
            assetManifest: { stickerUrls: [], capturedPhotoBlobs: sourceBlobs, fontDescriptors: [] },
            outputWidth: resolvedLayout.outputWidth,
            outputHeight: resolvedLayout.outputHeight,
        };

    const canvas = createCanvas ? createCanvas() : undefined;
    if (canvas) {
        canvas.width = config.outputWidth;
        canvas.height = config.outputHeight;
    }

    const resolvedPhotoSlots = resolvePhotoSlots({
        layout: config.layout,
        frame: config.frame,
    });
    const configWithResolvedSlots: RenderConfig = {
        ...config,
        photoSlots: resolvedPhotoSlots,
    };

    const geometry = resolveLayoutGeometry(configWithResolvedSlots.layout, configWithResolvedSlots.frame);
    let preparedAssets;
    try {
        preparedAssets = await RenderAssetLoaderService.loadAssets(config.assetManifest, { createImage: options.createImage });
    } catch (err) {
        if (canvas) {
            const ctx = canvas.getContext("2d");
            if (ctx) {
                const partialMap = err instanceof Error
                    ? (err as PartialPhotoLoadError).partialPhotos
                    : undefined;
                if (partialMap && ctx.drawImage) {
                    partialMap.forEach((img) => {
                        ctx.drawImage(img, 0, 0);
                    });
                }
                if (ctx.clearRect) ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }
        throw err;
    }
    const textLayouts = TextLayoutEngine.prepareTextLayouts(configWithResolvedSlots.overlays);

    const surface: RenderSurface = {
        width: config.outputWidth,
        height: config.outputHeight,
        pixelRatio: 1,
        type: "export",
    };

    let blob: Blob;
    try {
        const renderResult = await CanvasRenderer.render({
            sources: Array.from(sources),
            renderConfig: configWithResolvedSlots,
            geometry,
            assets: preparedAssets,
            textLayouts,
            surface,
            createCanvas: canvas ? (() => canvas as unknown as HTMLCanvasElement) : undefined,
        });
        blob = renderResult.blob;
        if (canvas) {
            const ctx = canvas.getContext("2d");
            if (ctx && ctx.clearRect) ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    } catch (err) {
        if (canvas) {
            const ctx = canvas.getContext("2d");
            if (ctx && ctx.clearRect) ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        throw err;
    }

    const resolvedPlan = resolveRenderPlan(configWithResolvedSlots, surface);
    const cells: LayoutCompositorCell[] = resolvedPlan.grid.cells.slice(0, configWithResolvedSlots.layout.shotCount).map((slot, idx) => ({
        photoId: sources[idx] ? sources[idx].photoId : `photo-${idx}`,
        x: slot.x,
        y: slot.y,
        width: slot.width,
        height: slot.height,
    }));

    return {
        blob,
        layoutId: config.layout.id,
        width: config.outputWidth,
        height: config.outputHeight,
        sourcePhotoIds: sources.map((s) => s.photoId),
        cells,
    };
}
