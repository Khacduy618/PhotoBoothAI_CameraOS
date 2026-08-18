import { describe, expect, it } from "vitest";

import {
    deleteSharePhoto,
    getSharePhoto,
    saveSharePhoto,
    cleanupExpiredSharePhotos,
    type SharePhotoStorage,
} from "@/services/sharing/share-photo-storage.service";

class MemoryStorage implements SharePhotoStorage {
    private readonly values = new Map<string, string>();

    getItem(key: string): string | null {
        return this.values.get(key) ?? null;
    }

    setItem(key: string, value: string): void {
        this.values.set(key, value);
    }

    removeItem(key: string): void {
        this.values.delete(key);
    }
}

describe("share photo storage", () => {
    it("saves and loads temporary share photos", () => {
        const storage = new MemoryStorage();
        const record = {
            photoId: "photo-1",
            dataUrl: "data:image/jpeg;base64,abc",
            mimeType: "image/jpeg",
            savedAt: "2026-07-19T00:00:00.000Z",
        };

        saveSharePhoto(storage, record);

        expect(getSharePhoto(storage, "photo-1")).toEqual(
            record,
        );
    });

    it("returns null for missing, corrupt or unsafe records", () => {
        const storage = new MemoryStorage();
        storage.setItem(
            "photoboothai:share-photo:v1:bad",
            "not-json",
        );
        storage.setItem(
            "photoboothai:share-photo:v1:text",
            JSON.stringify({
                photoId: "text",
                dataUrl: "file:///tmp/photo.jpg",
                mimeType: "image/jpeg",
                savedAt: "2026-07-19T00:00:00.000Z",
            }),
        );

        expect(getSharePhoto(storage, "missing")).toBeNull();
        expect(getSharePhoto(storage, "bad")).toBeNull();
        expect(getSharePhoto(storage, "text")).toBeNull();
    });

    it("deletes temporary share photos", () => {
        const storage = new MemoryStorage();
        const record = {
            photoId: "photo-2",
            dataUrl: "data:image/jpeg;base64,abc",
            mimeType: "image/jpeg",
            savedAt: "2026-07-19T00:00:00.000Z",
        };

        saveSharePhoto(storage, record);
        deleteSharePhoto(storage, "photo-2");

        expect(getSharePhoto(storage, "photo-2")).toBeNull();
    });

    it("cleans up expired share photos older than 2 minutes", () => {
        const storage = new MemoryStorage();
        const now = new Date("2026-07-21T12:00:00.000Z").getTime();

        const freshRecord = {
            photoId: "fresh",
            dataUrl: "data:image/jpeg;base64,fresh",
            mimeType: "image/jpeg",
            savedAt: new Date(now - 30 * 1000).toISOString(), // 30s ago
        };

        const expiredRecord = {
            photoId: "expired",
            dataUrl: "data:image/jpeg;base64,expired",
            mimeType: "image/jpeg",
            savedAt: new Date(now - 130 * 1000).toISOString(), // 130s ago (> 2m)
        };

        saveSharePhoto(storage, freshRecord);
        saveSharePhoto(storage, expiredRecord);

        // MemoryStorage helper for cleanup scan
        const storageWithKeyScan = Object.assign(storage, {
            get length() {
                return 2;
            },
            key(index: number) {
                const keys = ["photoboothai:share-photo:v1:fresh", "photoboothai:share-photo:v1:expired"];
                return keys[index] ?? null;
            },
        });

        cleanupExpiredSharePhotos(storageWithKeyScan, 120_000, () => now);

        expect(getSharePhoto(storage, "fresh")).toEqual(freshRecord);
        expect(getSharePhoto(storage, "expired")).toBeNull();
    });
});
