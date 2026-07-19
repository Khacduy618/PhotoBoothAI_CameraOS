import { describe, expect, it, vi } from "vitest";

import {
    MemoryPhotoBlobStorage,
    PhotoStorageService,
    type PhotoBlobStorage,
} from "@/services/storage/photo-storage.service";
import type { BoothPhoto } from "@/types/photo";

class FailingPhotoStorage implements PhotoBlobStorage {
    constructor(
        private readonly failure:
            | "put"
            | "get"
            | "delete"
            | "list",
        private readonly cause: Error,
    ) {}

    async put(): Promise<void> {
        if (this.failure === "put") {
            throw this.cause;
        }
    }

    async get(): Promise<BoothPhoto | null> {
        if (this.failure === "get") {
            throw this.cause;
        }

        return null;
    }

    async delete(): Promise<void> {
        if (this.failure === "delete") {
            throw this.cause;
        }
    }

    async list(): Promise<readonly BoothPhoto[]> {
        if (this.failure === "list") {
            throw this.cause;
        }

        return [];
    }
}

function createBlob(content: string): Blob {
    return new Blob([content], {
        type: "image/jpeg",
    });
}

describe("PhotoStorageService", () => {
    it("saves and retrieves an original photo before derivatives", async () => {
        const service = new PhotoStorageService(
            new MemoryPhotoBlobStorage(),
        );
        const originalBlob = createBlob("original");

        const saveResult = await service.saveOriginalPhoto({
            id: "photo-1",
            sessionId: "session-1",
            originalBlob,
            capturedAt: "2026-07-19T00:00:00.000Z",
            source: "webcam",
            width: 1280,
            height: 720,
        });

        expect(saveResult.ok).toBe(true);
        expect(
            saveResult.ok
                ? saveResult.value.original.blob
                : null,
        ).toBe(originalBlob);
        expect(
            saveResult.ok
                ? saveResult.value.derivatives
                : [],
        ).toEqual([]);

        await expect(
            service.getPhoto("photo-1"),
        ).resolves.toEqual(saveResult);
    });

    it("adds processed derivatives without replacing the original", async () => {
        const service = new PhotoStorageService(
            new MemoryPhotoBlobStorage(),
        );
        const originalBlob = createBlob("original");
        const derivativeBlob = createBlob("preview");

        await service.saveOriginalPhoto({
            id: "photo-2",
            sessionId: "session-1",
            originalBlob,
            capturedAt: "2026-07-19T00:00:00.000Z",
            source: "webcam",
        });

        const updateResult = await service.addDerivative({
            photoId: "photo-2",
            derivativeKind: "preview",
            blob: derivativeBlob,
            createdAt: "2026-07-19T00:00:01.000Z",
        });

        expect(updateResult.ok).toBe(true);
        if (updateResult.ok) {
            expect(updateResult.value.original.blob).toBe(
                originalBlob,
            );
            expect(updateResult.value.derivatives).toHaveLength(
                1,
            );
            expect(
                updateResult.value.derivatives[0]?.blob,
            ).toBe(derivativeBlob);
        }
    });

    it("lists and deletes photos by session", async () => {
        const service = new PhotoStorageService(
            new MemoryPhotoBlobStorage(),
        );

        await service.saveOriginalPhoto({
            id: "photo-3",
            sessionId: "session-a",
            originalBlob: createBlob("a"),
            capturedAt: "2026-07-19T00:00:00.000Z",
            source: "webcam",
        });
        await service.saveOriginalPhoto({
            id: "photo-4",
            sessionId: "session-b",
            originalBlob: createBlob("b"),
            capturedAt: "2026-07-19T00:00:00.000Z",
            source: "webcam",
        });

        const listResult = await service.listPhotosBySession(
            "session-a",
        );
        expect(listResult.ok).toBe(true);
        expect(
            listResult.ok
                ? listResult.value.map((photo) => photo.id)
                : [],
        ).toEqual(["photo-3"]);

        await expect(
            service.deletePhoto("photo-3"),
        ).resolves.toEqual({ ok: true, value: true });
        await expect(
            service.getPhoto("photo-3"),
        ).resolves.toEqual({ ok: true, value: null });
    });

    it("creates and revokes object URLs explicitly", () => {
        const service = new PhotoStorageService(
            new MemoryPhotoBlobStorage(),
        );
        const blob = createBlob("object-url");
        const createUrl = vi.fn(() => "blob:photo-1");
        const revokeUrl = vi.fn();

        const result = service.createObjectUrl(
            blob,
            createUrl,
        );

        expect(result).toEqual({
            ok: true,
            value: "blob:photo-1",
        });
        expect(createUrl).toHaveBeenCalledWith(blob);

        service.revokeObjectUrl(
            "blob:photo-1",
            revokeUrl,
        );
        expect(revokeUrl).toHaveBeenCalledWith(
            "blob:photo-1",
        );
    });

    it("returns typed quota errors when original save fails", async () => {
        const quotaError = new Error("quota full");
        quotaError.name = "QuotaExceededError";
        const service = new PhotoStorageService(
            new FailingPhotoStorage("put", quotaError),
        );

        const result = await service.saveOriginalPhoto({
            id: "photo-quota",
            sessionId: "session-1",
            originalBlob: createBlob("quota"),
            capturedAt: "2026-07-19T00:00:00.000Z",
            source: "webcam",
        });

        expect(result.ok).toBe(false);
        expect(result.ok ? null : result.error).toMatchObject({
            code: "quota_exceeded",
            category: "storage",
            recoverable: true,
        });
    });

    it("returns typed read and delete failures", async () => {
        const readService = new PhotoStorageService(
            new FailingPhotoStorage(
                "get",
                new Error("read unavailable"),
            ),
        );
        const storage = new MemoryPhotoBlobStorage();
        const seededService = new PhotoStorageService(storage);

        await seededService.saveOriginalPhoto({
            id: "photo-delete",
            sessionId: "session-1",
            originalBlob: createBlob("delete"),
            capturedAt: "2026-07-19T00:00:00.000Z",
            source: "webcam",
        });

        expect(
            await readService.getPhoto("photo-1"),
        ).toMatchObject({
            ok: false,
            error: {
                code: "read_failed",
                category: "storage",
            },
        });

        const photo = await storage.get("photo-delete");
        const customDeleteStorage: PhotoBlobStorage = {
            put: async () => undefined,
            get: async () => photo,
            list: async () => [],
            delete: async () => {
                throw new Error("delete unavailable");
            },
        };
        const customDeleteService = new PhotoStorageService(
            customDeleteStorage,
        );

        expect(
            await customDeleteService.deletePhoto(
                "photo-delete",
            ),
        ).toMatchObject({
            ok: false,
            error: {
                code: "delete_failed",
                category: "storage",
            },
        });
    });
});
