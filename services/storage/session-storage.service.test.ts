import { describe, expect, it } from "vitest";

import {
    SessionStorageService,
    type KeyValueStorage,
} from "@/services/storage/session-storage.service";
import type { BoothSession } from "@/types/session";

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

class FailingStorage extends MemoryStorage {
    constructor(
        private readonly failure: "get" | "set",
        private readonly cause: Error,
    ) {
        super();
    }

    override getItem(key: string): string | null {
        if (this.failure === "get") {
            throw this.cause;
        }

        return super.getItem(key);
    }

    override setItem(key: string, value: string): void {
        if (this.failure === "set") {
            throw this.cause;
        }

        super.setItem(key, value);
    }
}

function createSession(
    id: string,
    status: BoothSession["status"] = "active",
): BoothSession {
    return {
        id,
        status,
        mode: "single-photo",
        createdAt: "2026-07-19T00:00:00.000Z",
        updatedAt: "2026-07-19T00:00:00.000Z",
        photoIds: [],
    };
}

describe("SessionStorageService", () => {
    it("creates, reads and lists sessions", async () => {
        const service = new SessionStorageService(
            new MemoryStorage(),
        );
        const session = createSession("session-1");

        await expect(
            service.createSession(session),
        ).resolves.toEqual({
            ok: true,
            value: session,
        });

        await expect(
            service.getSession("session-1"),
        ).resolves.toEqual({
            ok: true,
            value: session,
        });

        const listResult = await service.listSessions();
        expect(listResult.ok).toBe(true);
        expect(
            listResult.ok ? listResult.value : [],
        ).toEqual([session]);
    });

    it("updates and deletes sessions", async () => {
        const service = new SessionStorageService(
            new MemoryStorage(),
        );
        const session = createSession("session-2");
        const completed: BoothSession = {
            ...session,
            status: "completed",
            completedAt: "2026-07-19T00:01:00.000Z",
        };

        await service.createSession(session);

        await expect(
            service.updateSession(completed),
        ).resolves.toEqual({
            ok: true,
            value: completed,
        });

        await expect(
            service.deleteSession("session-2"),
        ).resolves.toEqual({
            ok: true,
            value: true,
        });

        await expect(
            service.getSession("session-2"),
        ).resolves.toEqual({
            ok: true,
            value: null,
        });
    });

    it("restores the active session", async () => {
        const service = new SessionStorageService(
            new MemoryStorage(),
        );
        const completed = createSession(
            "completed-session",
            "completed",
        );
        const active = createSession("active-session");

        await service.createSession(completed);
        await service.createSession(active);

        await expect(
            service.getActiveSession(),
        ).resolves.toEqual({
            ok: true,
            value: active,
        });
    });

    it("returns typed not_found error for missing updates", async () => {
        const service = new SessionStorageService(
            new MemoryStorage(),
        );

        const result = await service.updateSession(
            createSession("missing-session"),
        );

        expect(result.ok).toBe(false);
        expect(result.ok ? null : result.error).toMatchObject({
            code: "not_found",
            category: "storage",
            recoverable: true,
        });
    });

    it("returns typed read failure errors", async () => {
        const service = new SessionStorageService(
            new FailingStorage(
                "get",
                new Error("read unavailable"),
            ),
        );

        const result = await service.listSessions();

        expect(result.ok).toBe(false);
        expect(result.ok ? null : result.error).toMatchObject({
            code: "read_failed",
            category: "storage",
            recoverable: true,
            diagnosticCause: "read unavailable",
        });
    });

    it("returns quota errors when browser storage is full", async () => {
        const quotaError = new Error("quota full");
        quotaError.name = "QuotaExceededError";
        const service = new SessionStorageService(
            new FailingStorage("set", quotaError),
        );

        const result = await service.createSession(
            createSession("quota-session"),
        );

        expect(result.ok).toBe(false);
        expect(result.ok ? null : result.error).toMatchObject({
            code: "quota_exceeded",
            category: "storage",
            recoverable: true,
        });
    });
});
