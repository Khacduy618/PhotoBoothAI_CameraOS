import type { StorageError } from "@/types/errors";
import type {
    BoothSession,
    BoothSessionMode,
    BoothSessionSelection,
} from "@/types/session";
import type {
    SessionStorageService,
    StorageResult,
} from "@/services/storage/session-storage.service";

export interface StartSessionInput {
    mode?: BoothSessionMode;
    selection?: BoothSessionSelection;
}

export interface SessionServiceOptions {
    createId?: () => string;
    now?: () => string;
}

export interface ArchiveAbandonedSessionsInput {
    olderThanMs: number;
}

function createSessionError(
    code: StorageError["code"],
    message: string,
    suggestedAction: string,
): StorageError {
    return {
        code,
        category: "storage",
        recoverable: true,
        message,
        suggestedAction,
        occurredAt: new Date().toISOString(),
    };
}

export class SessionService {
    private readonly createId: () => string;
    private readonly now: () => string;

    constructor(
        private readonly storage: SessionStorageService,
        options: SessionServiceOptions = {},
    ) {
        this.createId =
            options.createId ??
            (() => crypto.randomUUID());
        this.now =
            options.now ??
            (() => new Date().toISOString());
    }

    async startSession(
        input: StartSessionInput = {},
    ): Promise<StorageResult<BoothSession>> {
        const timestamp = this.now();
        const session: BoothSession = {
            id: this.createId(),
            status: "active",
            mode: input.mode ?? "single-photo",
            createdAt: timestamp,
            updatedAt: timestamp,
            photoIds: [],
            selection: input.selection,
        };

        return this.storage.createSession(session);
    }

    async getActiveSession(): Promise<
        StorageResult<BoothSession | null>
    > {
        return this.storage.getActiveSession();
    }

    async addPhotoToActiveSession(
        photoId: string,
    ): Promise<StorageResult<BoothSession>> {
        const activeSession =
            await this.storage.getActiveSession();

        if (!activeSession.ok) {
            return activeSession;
        }

        if (!activeSession.value) {
            return {
                ok: false,
                error: createSessionError(
                    "not_found",
                    "Không tìm thấy session đang hoạt động.",
                    "Tạo session mới trước khi lưu ảnh.",
                ),
            };
        }

        if (
            activeSession.value.photoIds.includes(photoId)
        ) {
            return {
                ok: true,
                value: activeSession.value,
            };
        }

        const updatedSession: BoothSession = {
            ...activeSession.value,
            updatedAt: this.now(),
            photoIds: [
                ...activeSession.value.photoIds,
                photoId,
            ],
        };

        return this.storage.updateSession(
            updatedSession,
        );
    }

    async abandonActiveSession(): Promise<
        StorageResult<BoothSession>
    > {
        const activeSession =
            await this.storage.getActiveSession();

        if (!activeSession.ok) {
            return activeSession;
        }

        if (!activeSession.value) {
            return {
                ok: false,
                error: createSessionError(
                    "not_found",
                    "Không tìm thấy session đang hoạt động.",
                    "Tạo session mới hoặc tải lại trạng thái booth.",
                ),
            };
        }

        const timestamp = this.now();

        return this.storage.updateSession({
            ...activeSession.value,
            status: "abandoned",
            updatedAt: timestamp,
            abandonedAt: timestamp,
        });
    }

    async completeActiveSession(): Promise<
        StorageResult<BoothSession>
    > {
        const activeSession =
            await this.storage.getActiveSession();

        if (!activeSession.ok) {
            return activeSession;
        }

        if (!activeSession.value) {
            return {
                ok: false,
                error: createSessionError(
                    "not_found",
                    "Không tìm thấy session đang hoạt động.",
                    "Tạo session mới hoặc tải lại trạng thái booth.",
                ),
            };
        }

        const timestamp = this.now();

        return this.storage.updateSession({
            ...activeSession.value,
            status: "completed",
            updatedAt: timestamp,
            completedAt: timestamp,
        });
    }
}


export async function archiveAbandonedSessions(
    storage: SessionStorageService,
    input: ArchiveAbandonedSessionsInput,
    now: () => string = () => new Date().toISOString(),
): Promise<StorageResult<readonly BoothSession[]>> {
    const sessions = await storage.listSessions();

    if (!sessions.ok) {
        return sessions;
    }

    const currentTime = new Date(now()).getTime();
    const archivedAt = now();
    const updatedSessions = sessions.value.map((session) => {
        if (
            session.status !== "abandoned" ||
            !session.abandonedAt
        ) {
            return session;
        }

        const abandonedAt = new Date(
            session.abandonedAt,
        ).getTime();

        if (
            Number.isNaN(abandonedAt) ||
            currentTime - abandonedAt < input.olderThanMs
        ) {
            return session;
        }

        return {
            ...session,
            status: "archived" as const,
            updatedAt: archivedAt,
            archivedAt,
        };
    });

    for (const session of updatedSessions) {
        const updateResult =
            await storage.updateSession(session);

        if (!updateResult.ok) {
            return updateResult;
        }
    }

    return { ok: true, value: updatedSessions };
}
