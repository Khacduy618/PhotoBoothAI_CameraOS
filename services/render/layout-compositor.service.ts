import { resolveBoothLayoutConfig } from "@/config/layout.config";
import { getLayoutGeometry } from "@/services/layout/layout-engine";
import { createImageFromBlob } from "@/services/render/render-photo-output";
import type { BoothLayoutConfig } from "@/types/customization";
import { resolveStickerConfig } from "@/config/sticker.config";

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

import type { RenderConfig } from "@/types/render-config";
import { resolveThemeConfig, resolveFrameConfig, resolveStyleConfig } from "@/config/theme.config";

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

function defaultCreateCanvas(): CanvasLike {
    return document.createElement("canvas");
}

function assertSourceCount(
    layout: BoothLayoutConfig,
    sources: readonly LayoutCompositorSource[],
): void {
    if (sources.length !== layout.shotCount) {
        throw new Error(
            `Layout ${layout.name} cần ${layout.shotCount} ảnh, hiện có ${sources.length} ảnh.`,
        );
    }
}

function clearCanvasPixels(
    canvas: CanvasLike,
    context: CanvasRenderingContext2D,
): void {
    context.clearRect(0, 0, canvas.width, canvas.height);
}

function drawImageCover(
    context: CanvasRenderingContext2D,
    image: HTMLImageElement,
    x: number,
    y: number,
    width: number,
    height: number,
): void {
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;

    if (sourceWidth <= 0 || sourceHeight <= 0) {
        throw new Error("Ảnh nguồn không có kích thước hợp lệ.");
    }

    const scale = Math.max(
        width / sourceWidth,
        height / sourceHeight,
    );
    const scaledWidth = sourceWidth * scale;
    const scaledHeight = sourceHeight * scale;
    const sourceX = Math.max(
        0,
        (scaledWidth - width) / 2 / scale,
    );
    const sourceY = Math.max(
        0,
        (scaledHeight - height) / 2 / scale,
    );
    const croppedSourceWidth = Math.min(
        sourceWidth,
        width / scale,
    );
    const croppedSourceHeight = Math.min(
        sourceHeight,
        height / scale,
    );

    context.drawImage(
        image,
        sourceX,
        sourceY,
        croppedSourceWidth,
        croppedSourceHeight,
        x,
        y,
        width,
        height,
    );
}

function getContrastColor(hexColor: string): string {
    if (!hexColor || !hexColor.startsWith("#")) return "#ffffff";
    const cleanHex = hexColor.replace("#", "");
    if (cleanHex.length !== 6) return "#ffffff";
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? "#111111" : "#ffffff";
}

export async function composePhotoLayout({
    sources,
    createImage = createImageFromBlob,
    createCanvas = defaultCreateCanvas,
    renderConfig,
    layoutId,
    borderColor,
    patternUrl,
    textLabel,
    textColor,
}: ComposeLayoutOptions): Promise<ComposeLayoutResult> {
    let finalConfig: RenderConfig;
    if (renderConfig) {
        finalConfig = renderConfig;
    } else {
        const resolvedLayout = resolveBoothLayoutConfig(layoutId || "2x2");
        const resolvedTheme = resolveThemeConfig("classic");
        const resolvedFrame = resolveFrameConfig("none");
        const resolvedStyle = resolveStyleConfig("none");
        finalConfig = {
            layout: resolvedLayout,
            theme: resolvedTheme,
            frame: {
                ...resolvedFrame,
                patternUrl: patternUrl || resolvedFrame.patternUrl,
            },
            frameColor: borderColor || resolvedFrame.borderColor,
            style: resolvedStyle,
            overlays: textLabel ? [
                {
                    id: "setup-text-preset",
                    type: "text",
                    content: textLabel,
                    x: 0.5,
                    y: 0.95,
                    baseWidth: 300,
                    baseHeight: 60,
                    scale: 1,
                    rotationRadians: 0,
                    rotationDegrees: 0,
                    opacity: 1,
                    color: textColor || "#ffffff",
                    zIndex: 20,
                }
            ] : [],
            outputWidth: resolvedLayout.outputWidth,
            outputHeight: resolvedLayout.outputHeight,
        };
    }

    const { layout, theme, frame, overlays } = finalConfig;
    assertSourceCount(layout, sources);

    const canvas = createCanvas();
    canvas.width = layout.outputWidth;
    canvas.height = layout.outputHeight;

    const context = canvas.getContext("2d");

    if (!context) {
        throw new Error("Không thể tạo canvas ghép layout.");
    }

    const cells: LayoutCompositorCell[] = [];

    try {
        const frameColor = finalConfig.frameColor || frame.borderColor;
        context.fillStyle = frame.id !== "none" ? frameColor : theme.backgroundColor;
        context.fillRect(0, 0, canvas.width, canvas.height);

        const activePatternUrl = frame.patternUrl;
        if (activePatternUrl && typeof window !== "undefined") {
            try {
                const patternImg = await new Promise<HTMLImageElement>((resolve, reject) => {
                    const img = new Image();
                    img.crossOrigin = "anonymous";
                    img.onload = () => resolve(img);
                    img.onerror = reject;
                    img.src = activePatternUrl;
                });
                context.drawImage(patternImg, 0, 0, canvas.width, canvas.height);
            } catch {
                // Fallback if pattern fails
            }
        }

        const gap = Math.round(
            Math.min(canvas.width, canvas.height) * 0.025,
        );
        const geometry = getLayoutGeometry(layout.id);
        const cellWidth =
            (canvas.width - gap * (layout.columns + 1)) /
            layout.columns;
        const gridHeight = canvas.height * (1 - geometry.brandingZoneRatio);
        const cellHeight =
            (gridHeight - gap * (layout.rows + 1)) /
            layout.rows;

        for (let index = 0; index < sources.length; index += 1) {
            const source = sources[index];
            const image = await createImage(source.blob);
            const column = index % layout.columns;
            const row = Math.floor(index / layout.columns);
            const x = Math.round(gap + column * (cellWidth + gap));
            const y = Math.round(gap + row * (cellHeight + gap));
            const width = Math.round(cellWidth);
            const height = Math.round(cellHeight);

            drawImageCover(
                context,
                image,
                x,
                y,
                width,
                height,
            );

            cells.push({
                photoId: source.photoId,
                x,
                y,
                width,
                height,
            });
        }
        // Await font readiness to guarantee font rendering parity
        if (typeof document !== "undefined" && "fonts" in document) {
            try {
                await document.fonts.ready;
            } catch {
                // Ignore font loading errors and fallback safely
            }
        }

        // Draw unified overlays onto final canvas output
        for (const item of overlays) {
            const rotRad = item.rotationRadians !== undefined ? item.rotationRadians : ((item.rotationDegrees || 0) * Math.PI) / 180;
            const opacity = item.opacity !== undefined ? item.opacity : 1;

            if (item.type === "sticker") {
                const sticker = resolveStickerConfig(item.content);
                if (sticker) {
                    context.save();
                    context.globalAlpha = opacity;
                    const px = item.x * canvas.width;
                    const py = item.y * canvas.height;
                    
                    // Sizing based on reference width (1000)
                    const emojiSize = ((item.baseWidth * item.scale) / 1000) * canvas.width;

                    context.translate(px, py);
                    context.rotate(rotRad);

                    // Support flipX/flipY
                    const flipX = item.flipX ? -1 : 1;
                    const flipY = item.flipY ? -1 : 1;
                    context.scale(flipX, flipY);

                    context.font = `${Math.round(emojiSize)}px sans-serif`;
                    context.textAlign = "center";
                    context.textBaseline = "middle";
                    context.fillText(sticker.emoji, 0, 0);
                    context.restore();
                }
            } else if (item.type === "text") {
                context.save();
                context.globalAlpha = opacity;
                const px = item.x * canvas.width;
                const py = item.y * canvas.height;
                
                // Sizing based on reference width (1000)
                const textScale = item.scale ?? 1;
                const fontSize = (((item.fontSize || 48) * textScale) / 1000) * canvas.width;

                context.translate(px, py);
                context.rotate(rotRad);

                const isBranding = item.id === "setup-text-preset";
                if (isBranding) {
                    const frameBg = frame.id !== "none" ? frameColor : theme.backgroundColor;
                    const textColor = getContrastColor(frameBg);
                    context.fillStyle = textColor;
                    context.font = `bold ${Math.round(fontSize)}px sans-serif`;
                    context.textAlign = "center";
                    context.textBaseline = "middle";
                    context.fillText(item.content.toUpperCase(), 0, 0);
                } else {
                    const textToDraw = (item.content || "").toUpperCase();
                    const fontWeightVal = item.fontWeight || 900;
                    context.font = `${fontWeightVal} ${Math.round(fontSize)}px ${item.fontFamily || "system-ui, sans-serif"}`;
                    context.textAlign = (item.align || "center") as CanvasTextAlign;
                    context.textBaseline = "middle";
                    context.lineJoin = "round";
                    context.miterLimit = 2;

                    const letterSpacingVal = item.letterSpacing || 0;
                    const letterSpacingPx = ((letterSpacingVal * textScale) / 1000) * canvas.width;
                    if (letterSpacingPx !== 0 && "letterSpacing" in context) {
                        (context as unknown as { letterSpacing: string }).letterSpacing = `${letterSpacingPx}px`;
                    }

                    // Apply shadow presets
                    if (item.shadowPreset === "soft") {
                        context.shadowColor = "rgba(0,0,0,0.3)";
                        context.shadowBlur = 8 * textScale;
                        context.shadowOffsetY = 4 * textScale;
                    } else if (item.shadowPreset === "hard") {
                        context.shadowColor = "rgba(0,0,0,0.8)";
                        context.shadowBlur = 0;
                        context.shadowOffsetX = 4 * textScale;
                        context.shadowOffsetY = 4 * textScale;
                    } else if (item.shadowPreset === "neon") {
                        context.shadowColor = item.color || "#ffffff";
                        context.shadowBlur = 20 * textScale;
                    }

                    // Stroke / outline
                    const outlineWidthVal = item.outlineWidth !== undefined ? item.outlineWidth : 2;
                    const strokeWidthPx = (((outlineWidthVal) * textScale) / 1000) * canvas.width;
                    if (strokeWidthPx > 0) {
                        context.strokeStyle = item.outlineColor || "#000000";
                        context.lineWidth = strokeWidthPx * 3;
                        context.strokeText(textToDraw, 0, 0);
                    }

                    // Fill text
                    context.fillStyle = item.color || "#ffffff";
                    context.fillText(textToDraw, 0, 0);
                }
                context.restore();
            } else if (item.type === "drawing" && item.points && item.points.length >= 2) {
                context.save();
                context.globalAlpha = opacity;
                context.strokeStyle = item.color || "#ffffff";
                
                // Width scaled from design space to final canvas
                const lineWidth = ((item.strokeWidth || 9) * canvas.width) / 1000;
                context.lineWidth = lineWidth;
                context.lineCap = "round";
                context.lineJoin = "round";
                
                context.beginPath();
                context.moveTo(item.points[0].x * canvas.width, item.points[0].y * canvas.height);
                for (let i = 1; i < item.points.length; i++) {
                    context.lineTo(item.points[i].x * canvas.width, item.points[i].y * canvas.height);
                }
                context.stroke();
                context.restore();
            }
        }

        const blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
                (outputBlob) => {
                    if (!outputBlob) {
                        reject(
                            new Error(
                                "Không thể tạo ảnh layout output.",
                            ),
                        );
                        return;
                    }

                    resolve(outputBlob);
                },
                "image/jpeg",
                0.94,
            );
        });

        return {
            blob,
            layoutId: layout.id,
            width: canvas.width,
            height: canvas.height,
            sourcePhotoIds: sources.map((source) => source.photoId),
            cells,
        };
    } finally {
        clearCanvasPixels(canvas, context);
    }
}
