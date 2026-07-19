import { afterEach, describe, expect, it, vi } from "vitest";

import {
    assertCaptureReady,
    canChangeSetup,
    createCapturedPhotoOutput,
    performRetake,
} from "@/components/camera/camera-preview";
import {
    MemoryPhotoBlobStorage,
    PhotoStorageService,
} from "@/services/storage/photo-storage.service";

afterEach(() => {
    vi.restoreAllMocks();
});

describe("assertCaptureReady", () => {
    it("rejects capture when stream is missing", () => {
        const video = {
            videoWidth: 1280,
            videoHeight: 720,
        } as HTMLVideoElement;

        expect(() => {
            assertCaptureReady(null, video);
        }).toThrow("Camera chưa kết nối.");
    });

    it("rejects capture when video is missing", () => {
        expect(() => {
            assertCaptureReady({} as MediaStream, null);
        }).toThrow("Camera chưa sẵn sàng.");
    });

    it("rejects capture when video dimensions are unavailable", () => {
        const video = {
            videoWidth: 0,
            videoHeight: 720,
        } as HTMLVideoElement;

        expect(() => {
            assertCaptureReady({} as MediaStream, video);
        }).toThrow("Video stream chưa sẵn sàng.");
    });

    it("returns the video when stream and dimensions are valid", () => {
        const video = {
            videoWidth: 1280,
            videoHeight: 720,
        } as HTMLVideoElement;

        expect(
            assertCaptureReady({} as MediaStream, video),
        ).toBe(video);
    });
});

describe("canChangeSetup", () => {
    it("allows setup changes before capture while idle or ready", () => {
        expect(canChangeSetup("idle", 0)).toBe(true);
        expect(canChangeSetup("ready", 0)).toBe(true);
    });

    it("blocks setup changes during countdown or capturing", () => {
        expect(canChangeSetup("countdown", 0)).toBe(false);
        expect(canChangeSetup("capturing", 0)).toBe(false);
    });

    it("blocks setup changes after captured media exists", () => {
        expect(canChangeSetup("idle", 1)).toBe(false);
        expect(canChangeSetup("result", 1)).toBe(false);
    });
});

describe("createCapturedPhotoOutput", () => {
    it("preserves original and uses rendered output when rendering succeeds", async () => {
        const originalBlob = new Blob(["original"], {
            type: "image/jpeg",
        });
        const renderedBlob = new Blob(["rendered"], {
            type: "image/jpeg",
        });
        const calls: string[] = [];
        const photoStorage = new PhotoStorageService(
            new MemoryPhotoBlobStorage(),
        );
        const saveOriginalPhoto = vi.spyOn(
            photoStorage,
            "saveOriginalPhoto",
        );
        const createObjectUrl = vi
            .fn((blob: Blob) => {
                calls.push(
                    blob === originalBlob
                        ? "object-url:original"
                        : "object-url:rendered",
                );
                return blob === originalBlob
                    ? "blob:original"
                    : "blob:rendered";
            });
        const renderOriginal = vi.fn(async () => {
            calls.push("render");
            return renderedBlob;
        });

        saveOriginalPhoto.mockImplementationOnce(
            async (input) => {
                calls.push("save-original");
                return PhotoStorageService.prototype.saveOriginalPhoto.call(
                    photoStorage,
                    input,
                );
            },
        );

        const photo = await createCapturedPhotoOutput({
            originalBlob,
            sessionId: "session-1",
            photoStorage,
            renderOriginal,
            createObjectUrl,
            createId: () => "capture-1",
            now: () => "2026-07-19T00:00:00.000Z",
        });

        expect(photo).toEqual({
            id: "capture-1",
            sessionId: "session-1",
            originalUrl: "blob:original",
            outputUrl: "blob:rendered",
            usedFallback: false,
        });
        expect(calls).toEqual([
            "save-original",
            "object-url:original",
            "render",
            "object-url:rendered",
        ]);
        expect(createObjectUrl).toHaveBeenNthCalledWith(1, originalBlob);
        expect(createObjectUrl).toHaveBeenNthCalledWith(2, renderedBlob);
    });

    it("falls back to original when rendering fails", async () => {
        const warnSpy = vi
            .spyOn(console, "warn")
            .mockImplementation(() => undefined);
        const originalBlob = new Blob(["original"], {
            type: "image/jpeg",
        });
        const photoStorage = new PhotoStorageService(
            new MemoryPhotoBlobStorage(),
        );
        const createObjectUrl = vi.fn(() => "blob:original");

        const photo = await createCapturedPhotoOutput({
            originalBlob,
            sessionId: "session-1",
            photoStorage,
            renderOriginal: vi.fn(async () => {
                throw new Error("render failed");
            }),
            createObjectUrl,
            createId: () => "capture-2",
            now: () => "2026-07-19T00:00:00.000Z",
        });

        expect(photo).toEqual({
            id: "capture-2",
            sessionId: "session-1",
            originalUrl: "blob:original",
            outputUrl: "blob:original",
            usedFallback: true,
        });
        expect(createObjectUrl).toHaveBeenCalledTimes(1);
        expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it("blocks preview output when original storage fails", async () => {
        const originalBlob = new Blob(["original"], {
            type: "image/jpeg",
        });
        const photoStorage = new PhotoStorageService(
            new MemoryPhotoBlobStorage(),
        );
        vi.spyOn(
            photoStorage,
            "saveOriginalPhoto",
        ).mockResolvedValueOnce({
            ok: false,
            error: {
                code: "quota_exceeded",
                category: "storage",
                recoverable: true,
                message: "Không thể lưu ảnh gốc.",
                suggestedAction: "Giải phóng dung lượng.",
                occurredAt: "2026-07-19T00:00:00.000Z",
            },
        });
        const renderOriginal = vi.fn(async () => originalBlob);
        const createObjectUrl = vi.fn(() => "blob:original");

        await expect(
            createCapturedPhotoOutput({
                originalBlob,
                sessionId: "session-1",
                photoStorage,
                renderOriginal,
                createObjectUrl,
                createId: () => "capture-3",
            }),
        ).rejects.toThrow("Không thể lưu ảnh gốc.");
        expect(renderOriginal).not.toHaveBeenCalled();
        expect(createObjectUrl).not.toHaveBeenCalled();
    });
});

describe("performRetake", () => {
    it("clears photo and resets without reconnecting for manual retake", async () => {
        const connect = vi.fn(async () => true);
        const clearPhoto = vi.fn();
        const reset = vi.fn();

        const completed = await performRetake({
            reconnectCamera: false,
            selectedDeviceId: "camera-1",
            connect,
            clearPhoto,
            reset,
        });

        expect(completed).toBe(true);
        expect(connect).not.toHaveBeenCalled();
        expect(clearPhoto).toHaveBeenCalledTimes(1);
        expect(reset).toHaveBeenCalledTimes(1);
    });

    it("reconnects default camera before clearing photo for gesture retake", async () => {
        const connect = vi.fn(async (deviceId?: string) => {
            expect(deviceId).toBeUndefined();
            return true;
        });
        const calls: string[] = [];

        const completed = await performRetake({
            reconnectCamera: true,
            selectedDeviceId: "",
            connect: async (deviceId) => {
                calls.push(`connect:${deviceId ?? "default"}`);
                return connect(deviceId);
            },
            clearPhoto: () => {
                calls.push("clearPhoto");
            },
            reset: () => {
                calls.push("reset");
            },
        });

        expect(completed).toBe(true);
        expect(connect).toHaveBeenCalledWith(undefined);
        expect(calls).toEqual([
            "connect:default",
            "clearPhoto",
            "reset",
        ]);
    });

    it("reconnects the selected camera before clearing photo", async () => {
        const connect = vi.fn(async () => true);
        const clearPhoto = vi.fn();
        const reset = vi.fn();

        const completed = await performRetake({
            reconnectCamera: true,
            selectedDeviceId: "camera-2",
            connect,
            clearPhoto,
            reset,
        });

        expect(completed).toBe(true);
        expect(connect).toHaveBeenCalledWith("camera-2");
        expect(clearPhoto).toHaveBeenCalledTimes(1);
        expect(reset).toHaveBeenCalledTimes(1);
    });

    it("keeps the captured photo when reconnect fails", async () => {
        const connect = vi.fn(async () => false);
        const clearPhoto = vi.fn();
        const reset = vi.fn();

        const completed = await performRetake({
            reconnectCamera: true,
            selectedDeviceId: "camera-2",
            connect,
            clearPhoto,
            reset,
        });

        expect(completed).toBe(false);
        expect(connect).toHaveBeenCalledWith("camera-2");
        expect(clearPhoto).not.toHaveBeenCalled();
        expect(reset).not.toHaveBeenCalled();
    });
});
