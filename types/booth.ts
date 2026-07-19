import type { BoothLayoutId } from "@/types/customization";

export type BoothState =
    | "idle"
    | "ready"
    | "countdown"
    | "capturing"
    | "between-shots"
    | "result"
    | "error";

export type BoothFlowStateValue =
    | "attract"
    | "layout-selection"
    | "countdown-selection"
    | "frame-selection"
    | "camera-initializing"
    | "preview-ready"
    | "countdown"
    | "capturing"
    | "saving-original"
    | "between-shots"
    | "processing-layout"
    | "customizing"
    | "generating-final"
    | "result"
    | "completed"
    | "recoverable-error"
    | "fatal-error";

export type BoothTriggerSource = "touch" | "gesture";

export interface BoothFlowError {
    code: string;
    message: string;
    recoverable: boolean;
}

export interface BoothFlowContext {
    layoutId: BoothLayoutId;
    totalShots: number;
    currentShotIndex: number;
    savedPhotoIds: readonly string[];
    pendingPhotoId?: string;
    countdownSeconds?: number;
    triggerLocked: boolean;
    awaitingGestureRelease: boolean;
    error?: BoothFlowError;
}

export interface BoothFlowState {
    value: BoothFlowStateValue;
    context: BoothFlowContext;
}

export type BoothFlowEvent =
    | { type: "START" }
    | { type: "SELECT_LAYOUT"; layoutId: BoothLayoutId }
    | { type: "SELECT_COUNTDOWN"; seconds: number }
    | { type: "SELECT_FRAME" }
    | { type: "CAMERA_INITIALIZING" }
    | { type: "CAMERA_READY" }
    | { type: "START_COUNTDOWN"; source: BoothTriggerSource }
    | { type: "GESTURE_RELEASED" }
    | { type: "COUNTDOWN_DONE" }
    | { type: "CAPTURE_SUCCEEDED"; photoId: string }
    | { type: "CAPTURE_FAILED"; error: BoothFlowError }
    | { type: "SAVE_ORIGINAL_SUCCEEDED" }
    | { type: "SAVE_ORIGINAL_FAILED"; error: BoothFlowError }
    | { type: "NEXT_SHOT_READY" }
    | { type: "LAYOUT_PROCESSED" }
    | { type: "CUSTOMIZATION_DONE" }
    | { type: "FINAL_READY" }
    | { type: "RETAKE_ALL" }
    | { type: "DONE" }
    | { type: "RECOVERABLE_ERROR"; error: BoothFlowError }
    | { type: "FATAL_ERROR"; error: BoothFlowError }
    | { type: "RESET" };
