import { describe, expect, it, vi } from "vitest";

import {
    composePhotoLayout,
    type CanvasLike,
} from "@/services/render/layout-compositor.service";
import { createRenderConfig } from "@/services/render/render-config.builder";
import { RenderAssetLoaderService } from "@/services/render/render-asset-loader.service";
import type { BoothSelection, FrameConfig } from "@/types/theme";

function createSource(photoId: string): { photoId: string; blob: Blob } {
    return {
        photoId,
        blob: new Blob([photoId], { type: "image/jpeg" }),
    };
}

function createRenderSelection(layoutId: BoothSelection["layoutId"] = "2x2"): BoothSelection {
    return {
        themeId: "classic",
        frameId: "white-border",
        styleId: "none",
        layoutId,
        countdownSeconds: 8,
        customization: {
            stickerItems: [],
            textLabels: [],
            drawingStrokes: [],
            overlays: [],
        },
    };
}

function createImage(width = 800, height = 600): HTMLImageElement {
    return {
        width,
        height,
        naturalWidth: width,
        naturalHeight: height,
    } as HTMLImageElement;
}

function createCanvasStub() {
    const drawImage = vi.fn();
    const fillRect = vi.fn();
    const clearRect = vi.fn();
    const context = {
        fillStyle: "#000000",
        fillRect,
        clearRect,
        drawImage,
    } as unknown as CanvasRenderingContext2D;
    const canvas: CanvasLike = {
        width: 0,
        height: 0,
        getContext: vi.fn(() => context),
        toBlob: vi.fn((callback) => {
            callback(
                new Blob(["layout-output"], {
                    type: "image/jpeg",
                }),
            );
        }),
    };

    return {
        canvas,
        context,
        drawImage,
        fillRect,
        clearRect,
    };
}

describe("layout compositor", () => {
    it("composes 2x2 output at the approved dimensions", async () => {
        const { canvas, drawImage } = createCanvasStub();
        const result = await composePhotoLayout({
            layoutId: "2x2",
            sources: [
                createSource("photo-1"),
                createSource("photo-2"),
                createSource("photo-3"),
                createSource("photo-4"),
            ],
            createImage: async () => createImage(),
            createCanvas: () => canvas,
        });

        expect(result.width).toBe(1200);
        expect(result.height).toBe(1800);
        expect(result.sourcePhotoIds).toEqual([
            "photo-1",
            "photo-2",
            "photo-3",
            "photo-4",
        ]);
        expect(result.cells).toHaveLength(4);
        expect(drawImage).toHaveBeenCalledTimes(4);
        expect(result.blob.type).toBe("image/jpeg");
    });

    it("uses preserved source blobs when renderConfig is provided without captured photo assets", async () => {
        const { canvas, drawImage } = createCanvasStub();
        const renderConfig = createRenderConfig(createRenderSelection("2x2"));

        await composePhotoLayout({
            renderConfig,
            sources: [
                createSource("photo-1"),
                createSource("photo-2"),
                createSource("photo-3"),
                createSource("photo-4"),
            ],
            createImage: async () => createImage(),
            createCanvas: () => canvas,
        });

        expect(drawImage).toHaveBeenCalledTimes(4);
    });

    it("returns compositor cell metadata from compatible frame slots", async () => {
        const { canvas } = createCanvasStub();
        const renderConfig = createRenderConfig(createRenderSelection("four-portrait-2x2"));
        const metadataFrame: FrameConfig = {
            ...renderConfig.frame,
            id: "metadata-frame",
            kind: "png-overlay",
            source: "canva",
            shotCount: 4,
            photoViewportOrientation: "portrait",
            layoutFamily: "2x2",
            outputWidth: 1200,
            outputHeight: 1800,
            slots: [
                { id: "frame-slot-1", index: 0, x: 101, y: 121, width: 301, height: 321 },
                { id: "frame-slot-2", index: 1, x: 501, y: 121, width: 301, height: 321 },
                { id: "frame-slot-3", index: 2, x: 101, y: 521, width: 301, height: 321 },
                { id: "frame-slot-4", index: 3, x: 501, y: 521, width: 301, height: 321 },
            ],
        };

        const result = await composePhotoLayout({
            renderConfig: {
                ...renderConfig,
                frame: metadataFrame,
                photoSlots: undefined,
            },
            sources: [
                createSource("photo-1"),
                createSource("photo-2"),
                createSource("photo-3"),
                createSource("photo-4"),
            ],
            createImage: async () => createImage(),
            createCanvas: () => canvas,
        });

        expect(result.cells[0]).toEqual({
            photoId: "photo-1",
            x: 101,
            y: 121,
            width: 301,
            height: 321,
        });
    });

    it("fails instead of exporting placeholders when default photo loading fails", async () => {
        const renderConfig = createRenderConfig(createRenderSelection("2x2"));
        const loadPhotoSpy = vi
            .spyOn(RenderAssetLoaderService, "loadPhoto")
            .mockRejectedValueOnce(new Error("photo decode failed"));

        await expect(composePhotoLayout({
            renderConfig,
            sources: [
                createSource("photo-1"),
                createSource("photo-2"),
                createSource("photo-3"),
                createSource("photo-4"),
            ],
            createCanvas: () => createCanvasStub().canvas,
        })).rejects.toThrow("photo decode failed");

        loadPhotoSpy.mockRestore();
    });

    it("clears canvas pixels after successful composition", async () => {
        const { canvas, clearRect } = createCanvasStub();

        await composePhotoLayout({
            layoutId: "2x2",
            sources: [
                createSource("photo-1"),
                createSource("photo-2"),
                createSource("photo-3"),
                createSource("photo-4"),
            ],
            createImage: async () => createImage(),
            createCanvas: () => canvas,
        });

        expect(clearRect).toHaveBeenCalledWith(
            0,
            0,
            1200,
            1800,
        );
    });

    it("composes 2-shot stacked output at the approved 4x6 dimensions", async () => {
        const { canvas, drawImage } = createCanvasStub();
        const result = await composePhotoLayout({
            layoutId: "stacked-2-4x6-portrait",
            sources: [
                createSource("photo-1"),
                createSource("photo-2"),
            ],
            createImage: async () => createImage(),
            createCanvas: () => canvas,
        });

        expect(result.width).toBe(1200);
        expect(result.height).toBe(1800);
        expect(result.cells).toHaveLength(2);
        expect(result.cells.map((cell) => cell.x)).toEqual([
            result.cells[0].x,
            result.cells[0].x,
        ]);
        expect(drawImage).toHaveBeenCalledTimes(2);
    });

    it("composes 2x3 output from six preserved originals", async () => {
        const { canvas, drawImage } = createCanvasStub();
        const result = await composePhotoLayout({
            layoutId: "2x3",
            sources: [
                createSource("photo-1"),
                createSource("photo-2"),
                createSource("photo-3"),
                createSource("photo-4"),
                createSource("photo-5"),
                createSource("photo-6"),
            ],
            createImage: async () => createImage(),
            createCanvas: () => canvas,
        });

        expect(result.width).toBe(1200);
        expect(result.height).toBe(1800);
        expect(result.sourcePhotoIds).toEqual([
            "photo-1",
            "photo-2",
            "photo-3",
            "photo-4",
            "photo-5",
            "photo-6",
        ]);
        expect(result.cells).toHaveLength(6);
        expect(drawImage).toHaveBeenCalledTimes(6);
    });

    it("fails explicitly when required source originals are missing", async () => {
        await expect(
            composePhotoLayout({
                layoutId: "2x3",
                sources: [
                    createSource("photo-1"),
                    createSource("photo-2"),
                    createSource("photo-3"),
                    createSource("photo-4"),
                ],
                createImage: async () => createImage(),
                createCanvas: () => createCanvasStub().canvas,
            }),
        ).rejects.toThrow("cần 6 ảnh");
    });

    it("fails explicitly when too many source originals are provided", async () => {
        await expect(
            composePhotoLayout({
                layoutId: "2x2",
                sources: [
                    createSource("photo-1"),
                    createSource("photo-2"),
                    createSource("photo-3"),
                    createSource("photo-4"),
                    createSource("photo-5"),
                ],
                createImage: async () => createImage(),
                createCanvas: () => createCanvasStub().canvas,
            }),
        ).rejects.toThrow("cần 4 ảnh");
    });

    it("does not mutate source blobs while composing derivatives", async () => {
        const { canvas } = createCanvasStub();
        const sources = [
            createSource("photo-1"),
            createSource("photo-2"),
            createSource("photo-3"),
            createSource("photo-4"),
        ];
        const originalBlobs = sources.map((source) => source.blob);

        await composePhotoLayout({
            layoutId: "2x2",
            sources,
            createImage: async () => createImage(),
            createCanvas: () => canvas,
        });

        expect(sources.map((source) => source.blob)).toEqual(
            originalBlobs,
        );
    });

    it("fails explicitly when canvas export fails and clears canvas pixels", async () => {
        const { canvas, clearRect } = createCanvasStub();
        canvas.toBlob = vi.fn((callback) => {
            callback(null);
        });

        await expect(
            composePhotoLayout({
                layoutId: "2x2",
                sources: [
                    createSource("photo-1"),
                    createSource("photo-2"),
                    createSource("photo-3"),
                    createSource("photo-4"),
                ],
                createImage: async () => createImage(),
                createCanvas: () => canvas,
            }),
        ).rejects.toThrow("Không thể tạo ảnh layout output");

        expect(clearRect).toHaveBeenCalledWith(
            0,
            0,
            1200,
            1800,
        );
    });

    it("clears canvas pixels when image loading fails after partial drawing", async () => {
        const { canvas, clearRect, drawImage } = createCanvasStub();
        const createImageMock = vi
            .fn()
            .mockResolvedValueOnce(createImage())
            .mockRejectedValueOnce(
                new Error("image load failed"),
            );

        await expect(
            composePhotoLayout({
                layoutId: "2x2",
                sources: [
                    createSource("photo-1"),
                    createSource("photo-2"),
                    createSource("photo-3"),
                    createSource("photo-4"),
                ],
                createImage: createImageMock,
                createCanvas: () => canvas,
            }),
        ).rejects.toThrow("image load failed");

        expect(drawImage).toHaveBeenCalledTimes(1);
        expect(clearRect).toHaveBeenCalledWith(
            0,
            0,
            1200,
            1800,
        );
    });
});
