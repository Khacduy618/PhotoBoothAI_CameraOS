import { resolveBoothLayoutConfig } from "@/config/layout.config";
import { createImageFromBlob } from "@/services/render/render-photo-output";
import type { BoothLayoutConfig } from "@/types/customization";

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

export interface ComposeLayoutOptions {
    layoutId: string;
    sources: readonly LayoutCompositorSource[];
    createImage?: (blob: Blob) => Promise<HTMLImageElement>;
    createCanvas?: () => CanvasLike;
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

export async function composePhotoLayout({
    layoutId,
    sources,
    createImage = createImageFromBlob,
    createCanvas = defaultCreateCanvas,
}: ComposeLayoutOptions): Promise<ComposeLayoutResult> {
    const layout = resolveBoothLayoutConfig(layoutId);
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
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);

        const gap = Math.round(
            Math.min(canvas.width, canvas.height) * 0.025,
        );
        const cellWidth =
            (canvas.width - gap * (layout.columns + 1)) /
            layout.columns;
        const cellHeight =
            (canvas.height - gap * (layout.rows + 1)) /
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
