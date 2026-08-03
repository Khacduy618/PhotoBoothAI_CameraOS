import { describe, expect, it } from "vitest";

import { defaultBoothSelection } from "@/config/theme.config";
import {
    archiveAbandonedSessions,
    SessionService,
} from "@/services/session/session.service";
import {
    SessionStorageService,
    type KeyValueStorage,
} from "@/services/storage/session-storage.service";

class MemoryStorage implements KeyValueStorage {
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

function createService() {
    let nowCalls = 0;
    const service = new SessionService(
        new SessionStorageService(new MemoryStorage()),
        {
            createId: () => "session-1",
            now: () => {
                nowCalls += 1;
                return `2026-07-19T00:00:0${nowCalls}.000Z`;
            },
        },
    );

    return service;
}

describe("SessionService", () => {
    it("creates a unique active single-photo session when a flow starts", async () => {
        const service = createService();

        const result = await service.startSession({
            selection: defaultBoothSelection,
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toMatchObject({
                id: "session-1",
                status: "active",
                mode: "single-photo",
                createdAt: "2026-07-19T00:00:01.000Z",
                updatedAt: "2026-07-19T00:00:01.000Z",
                photoIds: [],
                selection: expect.objectContaining({
                    themeId: "classic",
                    frameId: "white-border",
                    styleId: "none",
                    layoutId: "four-landscape-2x2",
                    countdownSeconds: 8,
                }),
            });
        }
    });

    it("restores the active session", async () => {
        const service = createService();
        const created = await service.startSession();

        await expect(
            service.getActiveSession(),
        ).resolves.toEqual(created);
    });

    it("links captured photos to the active session", async () => {
        const service = createService();
        await service.startSession();

        const result = await service.addPhotoToActiveSession(
            "photo-1",
        );

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.photoIds).toEqual([
                "photo-1",
            ]);
            expect(result.value.updatedAt).toBe(
                "2026-07-19T00:00:02.000Z",
            );
        }
    });

    it("does not duplicate the same photo link", async () => {
        const service = createService();
        await service.startSession();
        await service.addPhotoToActiveSession("photo-1");

        const result = await service.addPhotoToActiveSession(
            "photo-1",
        );

        expect(result.ok).toBe(true);
        expect(
            result.ok ? result.value.photoIds : [],
        ).toEqual(["photo-1"]);
    });

    it("returns typed error when linking without active session", async () => {
        const service = createService();

        const result = await service.addPhotoToActiveSession(
            "photo-1",
        );

        expect(result.ok).toBe(false);
        expect(result.ok ? null : result.error).toMatchObject({
            code: "not_found",
            category: "storage",
            recoverable: true,
        });
    });

    it("abandons and archives sessions by retention age", async () => {
        const storage = new SessionStorageService(
            new MemoryStorage(),
        );
        const service = new SessionService(storage, {
            createId: () => "session-archive",
            now: () => "2026-07-19T00:00:00.000Z",
        });
        await service.startSession();
        await service.abandonActiveSession();

        const result = await archiveAbandonedSessions(
            storage,
            { olderThanMs: 1000 },
            () => "2026-07-19T00:00:02.000Z",
        );

        expect(result.ok).toBe(true);
        const archived = result.ok
            ? result.value.find(
                (session) =>
                    session.id === "session-archive",
            )
            : null;
        expect(archived).toMatchObject({
            status: "archived",
            archivedAt: "2026-07-19T00:00:02.000Z",
        });
    });

    it("completes the active session with timestamps", async () => {
        const service = createService();
        await service.startSession();

        const result = await service.completeActiveSession();

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.status).toBe("completed");
            expect(result.value.completedAt).toBe(
                "2026-07-19T00:00:02.000Z",
            );
            expect(result.value.updatedAt).toBe(
                "2026-07-19T00:00:02.000Z",
            );
        }
    });
});
