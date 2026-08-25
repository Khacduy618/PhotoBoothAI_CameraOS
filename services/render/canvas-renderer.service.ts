import type { RenderConfig } from "@/types/render-config";
import type { RenderSurface } from "@/types/render-config";
import type { ResolvedLayoutGeometry } from "./layout-geometry.service";
import type { PreparedAssets } from "./render-asset-loader.service";
import type { PreparedTextLayouts } from "./text-layout.service";
import { resolveStickerConfig } from "@/config/sticker.config";
import { calculateObjectFitRect } from "./object-fit.service";
import { calculatePhotoLayerGeometry } from "@/services/layout/frameGeometry";
import { resolveRenderPlan } from "./render-plan.service";

export interface CanvasRendererOptions {
    sources: Array<{ photoId: string; blob: Blob }>;
    renderConfig: RenderConfig;
    geometry: Readonly<ResolvedLayoutGeometry>;
    assets: PreparedAssets;
    textLayouts: PreparedTextLayouts;
    surface: RenderSurface;
    createCanvas?: () => HTMLCanvasElement;
}

function drawRoundedPolygonPath(
    context: CanvasRenderingContext2D,
    points: readonly { x: number; y: number; cornerRadius?: number }[],
): void {
    if (!context.moveTo || !context.lineTo || !context.quadraticCurveTo || points.length < 3) return;

    const pointAt = (index: number) => points[(index + points.length) % points.length];
    const getInsetPoint = (from: { x: number; y: number }, to: { x: number; y: number }, radius: number) => {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const length = Math.hypot(dx, dy) || 1;
        const distance = Math.min(radius, length / 2);
        return {
            x: from.x + (dx / length) * distance,
            y: from.y + (dy / length) * distance,
        };
    };

    const first = pointAt(0);
    const previous = pointAt(-1);
    const firstRadius = first.cornerRadius ?? 0;
    const firstStart = firstRadius > 0 ? getInsetPoint(first, previous, firstRadius) : first;
    context.moveTo(firstStart.x, firstStart.y);

    for (let index = 0; index < points.length; index += 1) {
        const prev = pointAt(index - 1);
        const current = pointAt(index);
        const next = pointAt(index + 1);
        const radius = current.cornerRadius ?? 0;
        if (radius > 0) {
            const before = getInsetPoint(current, prev, radius);
            const after = getInsetPoint(current, next, radius);
            context.lineTo(before.x, before.y);
            context.quadraticCurveTo(current.x, current.y, after.x, after.y);
        } else {
            context.lineTo(current.x, current.y);
        }
    }
}

export class CanvasRenderer {
    public static async render(options: CanvasRendererOptions): Promise<{ blob: Blob }> {
        const { renderConfig, assets, textLayouts, surface, sources, createCanvas } = options;
        const { overlays } = renderConfig;
        
        const canvas: HTMLCanvasElement = createCanvas
            ? createCanvas()
            : document.createElement("canvas");

        canvas.width = surface.width;
        canvas.height = surface.height;

        const context = canvas.getContext("2d");
        if (!context) {
            throw new Error("Failed to get 2d context for CanvasRenderer");
        }

        const plan = resolveRenderPlan(renderConfig, surface);

        if (context.clearRect) {
            context.clearRect(0, 0, canvas.width, canvas.height);
        }

        // 1. Draw Background
        if (context.fillRect) {
            context.fillStyle = surface.backgroundColor || plan.frame.backgroundColor;
            context.fillRect(
                plan.frame.rect.x,
                plan.frame.rect.y,
                plan.frame.rect.width,
                plan.frame.rect.height,
            );
        }

        if (assets.background && context.drawImage) {
            context.drawImage(assets.background, 0, 0, canvas.width, canvas.height);
        }

        // 2. Draw Photo Slots
        for (let idx = 0; idx < renderConfig.layout.shotCount; idx++) {
            const slot = plan.grid.cells[idx];
            if (!slot) continue;
            const source = sources[idx];

            const slotX = slot.x;
            const slotY = slot.y;
            const slotWidth = slot.width;
            const slotHeight = slot.height;

            if (source && assets.capturedPhotos.has(`photo-${idx}`)) {
                const img = assets.capturedPhotos.get(`photo-${idx}`);
                if (!img) {
                    throw new Error("image load failed");
                }
                
                if (context.save) context.save();
                // Clip photos to the actual slot shape. Rect slots use their bounding box;
                // polygon slots prevent attendee media from leaking through decorative
                // transparent areas outside the operator-selected punchout shape.
                if (context.beginPath) context.beginPath();
                if (slot.shape === "bezier" && slot.points && slot.points.length >= 3 && context.moveTo && context.bezierCurveTo) {
                    context.moveTo(slot.points[0].x, slot.points[0].y);
                    for (let pointIndex = 0; pointIndex < slot.points.length; pointIndex += 1) {
                        const current = slot.points[pointIndex];
                        const next = slot.points[(pointIndex + 1) % slot.points.length];
                        const c1 = current.outHandle ?? current;
                        const c2 = next.inHandle ?? next;
                        context.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, next.x, next.y);
                    }
                    if (context.closePath) context.closePath();
                } else if (slot.shape === "polygon" && slot.points && slot.points.length >= 3 && context.moveTo && context.lineTo) {
                    if (slot.points.some((point) => (point.cornerRadius ?? 0) > 0)) {
                        drawRoundedPolygonPath(context, slot.points);
                    } else {
                        context.moveTo(slot.points[0].x, slot.points[0].y);
                        for (let pointIndex = 1; pointIndex < slot.points.length; pointIndex += 1) {
                            context.lineTo(slot.points[pointIndex].x, slot.points[pointIndex].y);
                        }
                    }
                    if (context.closePath) context.closePath();
                } else if (context.rect) {
                    context.rect(slotX, slotY, slotWidth, slotHeight);
                }
                if (context.clip) context.clip();

                const imgWidth = (img as HTMLImageElement).naturalWidth || img.width || 1920;
                const imgHeight = (img as HTMLImageElement).naturalHeight || img.height || 1080;
                const fitMode = renderConfig.frame.photoFit === "contain" ? "contain" : "cover";
                const geom = calculatePhotoLayerGeometry({
                    canvasWidth: canvas.width,
                    canvasHeight: canvas.height,
                    slot: { x: slotX, y: slotY, width: slotWidth, height: slotHeight },
                    imageWidth: imgWidth,
                    imageHeight: imgHeight,
                    fitMode,
                });

                if (context.filter !== undefined) {
                    context.filter = "contrast(1.08) saturate(1.18) sepia(0.04)";
                }

                if (context.drawImage) {
                    context.drawImage(img as CanvasImageSource, geom.photoX, geom.photoY, geom.photoWidth, geom.photoHeight);
                }
                if (context.restore) context.restore();
            } else {
                // Empty photo placeholder box
                context.fillStyle = "#e5e5e5";
                if (context.fillRect) {
                    context.fillRect(slotX, slotY, slotWidth, slotHeight);
                }
            }
        }

        // 3. Draw only real Canva/operator PNG overlays above photos. Bundled solid frames
        // are represented by the sheet background underneath photos, not by a border stroke
        // over the captured media.
        if (assets.frame && context.drawImage) {
            context.drawImage(assets.frame, 0, 0, canvas.width, canvas.height);
        }

        // 4. Draw Overlays above both photos and Canva frame so drawing can decorate imported frames too.
        for (const item of overlays) {
            const rotRad = item.rotationRadians !== undefined ? item.rotationRadians : ((item.rotationDegrees || 0) * Math.PI) / 180;
            const opacity = item.opacity !== undefined ? item.opacity : 1;
            const px = item.x * canvas.width;
            const py = item.y * canvas.height;

            if (item.type === "sticker") {
                const stickerConfig = resolveStickerConfig(item.content);
                if (stickerConfig) {
                    if (context.save) context.save();
                    context.globalAlpha = opacity;

                    const emojiSize = ((item.baseWidth * item.scale) / 1000) * canvas.width;

                    if (context.translate) context.translate(px, py);
                    if (context.rotate) context.rotate(rotRad);

                    const flipX = item.flipX ? -1 : 1;
                    const flipY = item.flipY ? -1 : 1;
                    if (context.scale) context.scale(flipX, flipY);

                    context.font = `${Math.round(emojiSize)}px sans-serif`;
                    context.textAlign = "center";
                    context.textBaseline = "middle";
                    if (context.fillText) context.fillText(stickerConfig.emoji, 0, 0);
                    if (context.restore) context.restore();
                }
            } else if (item.type === "text") {
                const textLayout = textLayouts.layouts[item.id];
                if (context.save) context.save();
                context.globalAlpha = opacity;
                if (context.translate) context.translate(px, py);
                if (context.rotate) context.rotate(rotRad);

                const textScale = item.scale ?? 1;
                const fontSize = (((item.fontSize || 48) * textScale) / 1000) * canvas.width;

                const fontMap: Record<string, string> = {
                    "sans-serif": 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    "serif": 'Georgia, "Times New Roman", serif',
                    "cursive": '"Brush Script MT", "Snell Roundhand", cursive',
                    "monospace": 'Monaco, "Courier New", monospace',
                };
                const fontStack = fontMap[item.fontFamily || "sans-serif"] || item.fontFamily || "system-ui, sans-serif";
                context.font = `${item.fontWeight || 900} ${Math.round(fontSize)}px ${fontStack}`;
                context.textAlign = (item.align || "center") as CanvasTextAlign;
                context.textBaseline = "middle";
                context.lineJoin = "round";
                context.miterLimit = 2;

                const textToDraw = textLayout ? textLayout.lines[0].text : (item.content || "").toUpperCase();

                // Shadows
                if (item.shadowPreset === "soft") {
                    context.shadowColor = "rgba(0,0,0,0.3)";
                    context.shadowBlur = 8 * textScale;
                    context.shadowOffsetX = 0;
                    context.shadowOffsetY = 4 * textScale;
                } else if (item.shadowPreset === "hard") {
                    context.shadowColor = "rgba(0,0,0,0.8)";
                    context.shadowBlur = 0;
                    context.shadowOffsetX = 4 * textScale;
                    context.shadowOffsetY = 4 * textScale;
                } else if (item.shadowPreset === "neon") {
                    context.shadowColor = item.color || "#ffffff";
                    context.shadowBlur = 20 * textScale;
                    context.shadowOffsetX = 0;
                    context.shadowOffsetY = 0;
                }

                // Outline
                const outlineWidthVal = item.outlineWidth !== undefined ? item.outlineWidth : 2;
                if (outlineWidthVal > 0) {
                    const strokeWidthPx = ((outlineWidthVal * textScale) / 1000) * canvas.width;
                    context.strokeStyle = item.outlineColor || "#000000";
                    context.lineWidth = Math.max(1, strokeWidthPx * 1.5);
                    if (context.strokeText) context.strokeText(textToDraw, 0, 0);
                }

                // Fill Text
                context.fillStyle = item.color || "#ffffff";
                if (context.fillText) context.fillText(textToDraw, 0, 0);
                if (context.restore) context.restore();
            } else if (item.type === "drawing" && item.points && item.points.length >= 2) {
                if (context.save) context.save();
                context.globalAlpha = opacity;
                context.strokeStyle = item.color || "#ffffff";

                const strokeWidthPx = ((item.strokeWidth || 9) * canvas.width) / 1000;
                context.lineWidth = strokeWidthPx;
                context.lineCap = "round";
                context.lineJoin = "round";

                // Match the attendee preview exactly: drawings are sheet-level overlays above
                // the selected frame and captured photos. Do not clip strokes away during
                // export, otherwise the downloaded derivative diverges from what the user saw.
                if (context.beginPath) context.beginPath();
                if (context.moveTo) context.moveTo(item.points[0].x * canvas.width, item.points[0].y * canvas.height);
                for (let i = 1; i < item.points.length; i++) {
                    if (context.lineTo) context.lineTo(item.points[i].x * canvas.width, item.points[i].y * canvas.height);
                }
                if (context.stroke) context.stroke();
                if (context.restore) context.restore();
            }
        }

        const mimeType = surface.type === "export" ? "image/jpeg" : "image/png";
        const blob = await new Promise<Blob>((resolve, reject) => {
            if (typeof canvas.toBlob === "function") {
                canvas.toBlob(
                    (b) => {
                        if (b) resolve(b);
                        else reject(new Error("Không thể tạo ảnh layout output."));
                    },
                    mimeType,
                    0.95
                );
            } else {
                reject(new Error("Không thể tạo ảnh layout output."));
            }
        });

        return { blob };
    }
}
