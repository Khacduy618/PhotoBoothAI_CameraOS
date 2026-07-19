import type {
    BoothCountdownSeconds,
    BoothLayoutId,
    BoothOutputCustomization,
} from "@/types/customization";

export type SessionStatus =
    | "active"
    | "completed"
    | "abandoned"
    | "archived"
    | "error";

export type BoothSessionMode = "single-photo";

export interface BoothSessionSelection {
    themeId: string;
    frameId: string;
    styleId: string;
    layoutId: BoothLayoutId;
    countdownSeconds: BoothCountdownSeconds;
    customization: BoothOutputCustomization;
}

export interface BoothSession {
    id: string;
    status: SessionStatus;
    mode: BoothSessionMode;
    createdAt: string;
    updatedAt: string;
    completedAt?: string;
    abandonedAt?: string;
    archivedAt?: string;
    photoIds: readonly string[];
    selection?: BoothSessionSelection;
    errorCode?: string;
}
