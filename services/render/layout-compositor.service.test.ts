import { describe, expect, it, vi } from "vitest";

import {
    composePhotoLayout,
    type CanvasLike,
} from "@/services/render/layout-compositor.service";

function createSource(photoId: string): { photoId: string; blob: Blob } {
    return {
        photoId,
        blob: new Blob([photoId], { type: "image/jpeg" }),
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

        expect(result.width).toBe(1600);
        expect(result.height).toBe(1600);
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
            1600,
            1600,
        );
    });

    it("composes 1x4 vertical output at the approved dimensions", async () => {
        const { canvas, drawImage } = createCanvasStub();
        const result = await composePhotoLayout({
            layoutId: "1x4-vertical",
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
        expect(result.height).toBe(3600);
        expect(result.cells).toHaveLength(4);
        expect(result.cells.map((cell) => cell.x)).toEqual([
            result.cells[0].x,
            result.cells[0].x,
            result.cells[0].x,
            result.cells[0].x,
        ]);
        expect(drawImage).toHaveBeenCalledTimes(4);
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

        expect(result.width).toBe(1600);
        expect(result.height).toBe(2400);
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
            1600,
            1600,
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
            1600,
            1600,
        );
    });
});
