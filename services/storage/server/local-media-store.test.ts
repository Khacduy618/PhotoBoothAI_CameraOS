import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
    cleanupExpiredLocalMedia,
    listLocalPhotosBySession,
    readLocalPhotoFile,
    resetLocalMediaStoreForTests,
    saveLocalOriginalPhoto,
} from "./local-media-store";

let tempDir: string;

beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cameraos-media-"));
    process.env.CAMERAOS_DATA_DIR = tempDir;
    resetLocalMediaStoreForTests();
});

afterEach(async () => {
    resetLocalMediaStoreForTests();
    delete process.env.CAMERAOS_DATA_DIR;
    try {
        await rm(tempDir, { recursive: true, force: true });
    } catch {
        // Windows delayed lock cleanup safety
    }
});

describe("local SQLite media store", () => {
    it("saves an original outside public and lists session photos newest first", async () => {
        const older = await saveLocalOriginalPhoto({
            sessionId: "session_1",
            photoId: "photo_old",
            blob: new Blob(["old"], { type: "image/jpeg" }),
            capturedAt: "2026-08-04T00:00:00.000Z",
        });
        const newer = await saveLocalOriginalPhoto({
            sessionId: "session_1",
            photoId: "photo_new",
            blob: new Blob(["new"], { type: "image/jpeg" }),
            capturedAt: "2026-08-04T00:01:00.000Z",
        });

        expect(older.storageKey).toBe("sessions/session_1/originals/photo_old.jpg");
        expect(newer.mediaUrl).toBe("/api/local-media/photos/photo_new");
        const listed = await listLocalPhotosBySession("session_1");
        expect(listed.map((item) => item.photoId)).toEqual(["photo_new", "photo_old"]);

        const readResult = await readLocalPhotoFile("photo_new");
        expect(readResult?.bytes.toString()).toBe("new");
        await expect(readFile(path.join(tempDir, "sessions/session_1/originals/photo_new.jpg"), "utf8")).resolves.toBe("new");
    });

    it("rejects unsafe IDs and unsupported MIME types", async () => {
        await expect(saveLocalOriginalPhoto({
            sessionId: "../session",
            photoId: "photo_1",
            blob: new Blob(["bad"], { type: "image/jpeg" }),
        })).rejects.toThrow(/sessionId/);

        await expect(saveLocalOriginalPhoto({
            sessionId: "session_1",
            photoId: "photo_html",
            blob: new Blob(["<html />"], { type: "text/html" }),
        })).rejects.toThrow(/Unsupported local media MIME type/);
    });

    it("uses server time for TTL instead of client supplied future capturedAt", async () => {
        const beforeSave = Date.now();
        const record = await saveLocalOriginalPhoto({
            sessionId: "session_1",
            photoId: "photo_future",
            blob: new Blob(["future"], { type: "image/jpeg" }),
            capturedAt: "2999-01-01T00:00:00.000Z",
        });
        const expiresAt = Date.parse(record.expiresAt);

        expect(expiresAt).toBeGreaterThanOrEqual(beforeSave + 10 * 60 * 1000 - 1_000);
        expect(expiresAt).toBeLessThan(Date.now() + 10 * 60 * 1000 + 5_000);
    });

    it("cleans up expired media files and marks them unavailable", async () => {
        const record = await saveLocalOriginalPhoto({
            sessionId: "session_1",
            photoId: "photo_expired",
            blob: new Blob(["expired"], { type: "image/jpeg" }),
        });

        const deletedCount = await cleanupExpiredLocalMedia(new Date(Date.parse(record.expiresAt) + 1));
        expect(deletedCount).toBe(1);
        await expect(readLocalPhotoFile("photo_expired")).resolves.toBeNull();
    });
});
