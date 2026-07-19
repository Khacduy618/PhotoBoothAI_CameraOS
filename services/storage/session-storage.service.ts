import type { StorageError } from "@/types/errors";
import type { BoothSession } from "@/types/session";

export type StorageResult<T> =
    | { ok: true; value: T }
    | { ok: false; error: StorageError };

export interface KeyValueStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

const SESSION_STORE_KEY =
    "photoboothai:sessions:v1";

function createStorageError(
    code: StorageError["code"],
    message: string,
    suggestedAction: string,
    cause?: unknown,
): StorageError {
    return {
        code,
        category: "storage",
        recoverable: code !== "corrupt_data",
        message,
        suggestedAction,
        diagnosticCause:
            cause instanceof Error
                ? cause.message
                : typeof cause === "string"
                    ? cause
                    : undefined,
        occurredAt: new Date().toISOString(),
    };
}

function isBoothSession(
    value: unknown,
): value is BoothSession {
    if (
        typeof value !== "object" ||
        value === null
    ) {
        return false;
    }

    const session = value as Partial<BoothSession>;

    return (
        typeof session.id === "string" &&
        typeof session.status === "string" &&
        typeof session.mode === "string" &&
        typeof session.createdAt === "string" &&
        typeof session.updatedAt === "string" &&
        Array.isArray(session.photoIds)
    );
}

function readAllSessions(
    storage: KeyValueStorage,
): StorageResult<BoothSession[]> {
    try {
        const raw = storage.getItem(SESSION_STORE_KEY);

        if (raw === null) {
            return { ok: true, value: [] };
        }

        const parsed: unknown = JSON.parse(raw);

        if (!Array.isArray(parsed)) {
            return {
                ok: false,
                error: createStorageError(
                    "corrupt_data",
                    "Dữ liệu session không hợp lệ.",
                    "Tạo session mới hoặc chạy quy trình khôi phục dữ liệu.",
                ),
            };
        }

        if (!parsed.every(isBoothSession)) {
            return {
                ok: false,
                error: createStorageError(
                    "corrupt_data",
                    "Một hoặc nhiều session đã bị lỗi dữ liệu.",
                    "Tạo session mới hoặc chạy quy trình khôi phục dữ liệu.",
                ),
            };
        }

        return { ok: true, value: parsed };
    } catch (cause) {
        return {
            ok: false,
            error: createStorageError(
                "read_failed",
                "Không thể đọc dữ liệu session.",
                "Thử tải lại ứng dụng hoặc kiểm tra quyền lưu trữ của trình duyệt.",
                cause,
            ),
        };
    }
}

function writeAllSessions(
    storage: KeyValueStorage,
    sessions: readonly BoothSession[],
): StorageResult<readonly BoothSession[]> {
    try {
        storage.setItem(
            SESSION_STORE_KEY,
            JSON.stringify(sessions),
        );

        return { ok: true, value: sessions };
    } catch (cause) {
        const errorName =
            cause instanceof Error ? cause.name : "";

        return {
            ok: false,
            error: createStorageError(
                errorName === "QuotaExceededError"
                    ? "quota_exceeded"
                    : "write_failed",
                "Không thể lưu dữ liệu session.",
                "Giải phóng dung lượng hoặc thử lại sau.",
                cause,
            ),
        };
    }
}

export class SessionStorageService {
    constructor(
        private readonly storage: KeyValueStorage,
    ) {}

    async createSession(
        session: BoothSession,
    ): Promise<StorageResult<BoothSession>> {
        const current = readAllSessions(this.storage);

        if (!current.ok) {
            return current;
        }

        if (
            current.value.some(
                (existing) => existing.id === session.id,
            )
        ) {
            return {
                ok: false,
                error: createStorageError(
                    "write_failed",
                    "Session đã tồn tại.",
                    "Tạo session với mã định danh khác.",
                ),
            };
        }

        const writeResult = writeAllSessions(
            this.storage,
            [session, ...current.value],
        );

        if (!writeResult.ok) {
            return writeResult;
        }

        return { ok: true, value: session };
    }

    async getSession(
        sessionId: string,
    ): Promise<StorageResult<BoothSession | null>> {
        const current = readAllSessions(this.storage);

        if (!current.ok) {
            return current;
        }

        return {
            ok: true,
            value:
                current.value.find(
                    (session) => session.id === sessionId,
                ) ?? null,
        };
    }

    async updateSession(
        session: BoothSession,
    ): Promise<StorageResult<BoothSession>> {
        const current = readAllSessions(this.storage);

        if (!current.ok) {
            return current;
        }

        const sessionExists = current.value.some(
            (existing) => existing.id === session.id,
        );

        if (!sessionExists) {
            return {
                ok: false,
                error: createStorageError(
                    "not_found",
                    "Không tìm thấy session cần cập nhật.",
                    "Tạo session mới hoặc tải lại danh sách session.",
                ),
            };
        }

        const writeResult = writeAllSessions(
            this.storage,
            current.value.map((existing) =>
                existing.id === session.id
                    ? session
                    : existing,
            ),
        );

        if (!writeResult.ok) {
            return writeResult;
        }

        return { ok: true, value: session };
    }

    async deleteSession(
        sessionId: string,
    ): Promise<StorageResult<boolean>> {
        const current = readAllSessions(this.storage);

        if (!current.ok) {
            return current;
        }

        const nextSessions = current.value.filter(
            (session) => session.id !== sessionId,
        );

        const writeResult = writeAllSessions(
            this.storage,
            nextSessions,
        );

        if (!writeResult.ok) {
            return writeResult;
        }

        return {
            ok: true,
            value:
                nextSessions.length !==
                current.value.length,
        };
    }

    async listSessions(): Promise<
        StorageResult<readonly BoothSession[]>
    > {
        return readAllSessions(this.storage);
    }

    async getActiveSession(): Promise<
        StorageResult<BoothSession | null>
    > {
        const current = readAllSessions(this.storage);

        if (!current.ok) {
            return current;
        }

        return {
            ok: true,
            value:
                current.value.find(
                    (session) =>
                        session.status === "active",
                ) ?? null,
        };
    }
}

export function createSessionStorageService(
    storage?: KeyValueStorage,
): StorageResult<SessionStorageService> {
    const browserStorage =
        storage ??
        (typeof window !== "undefined"
            ? window.localStorage
            : undefined);

    if (!browserStorage) {
        return {
            ok: false,
            error: createStorageError(
                "storage_unavailable",
                "Bộ nhớ trình duyệt chưa sẵn sàng.",
                "Mở ứng dụng trong trình duyệt hỗ trợ localStorage.",
            ),
        };
    }

    return {
        ok: true,
        value: new SessionStorageService(browserStorage),
    };
}
