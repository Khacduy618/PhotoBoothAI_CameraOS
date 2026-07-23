import { defaultBoothLayoutId, defaultCountdownSeconds, resolveBoothLayoutConfig } from "@/config/layout.config";
import type {
    BoothFlowContext,
    BoothFlowError,
    BoothFlowEvent,
    BoothFlowState,
} from "@/types/booth";
import type { BoothLayoutId } from "@/types/customization";

const defaultLayout = resolveBoothLayoutConfig(defaultBoothLayoutId);

export function createBoothFlowState(
    layoutId: BoothLayoutId = defaultLayout.id,
): BoothFlowState {
    const layout = resolveBoothLayoutConfig(layoutId);

    return {
        value: "attract",
        context: {
            layoutId: layout.id,
            totalShots: layout.shotCount,
            currentShotIndex: 0,
            countdownSeconds: defaultCountdownSeconds,
            savedPhotoIds: [],
            triggerLocked: false,
            awaitingGestureRelease: false,
        },
    };
}

function resetCaptureProgress(
    context: BoothFlowContext,
): BoothFlowContext {
    return {
        ...context,
        currentShotIndex: 0,
        savedPhotoIds: [],
        pendingPhotoId: undefined,
        triggerLocked: false,
        awaitingGestureRelease: false,
        error: undefined,
    };
}

function withError(
    state: BoothFlowState,
    error: BoothFlowError,
    fatal = false,
): BoothFlowState {
    return {
        value: fatal ? "fatal-error" : "recoverable-error",
        context: {
            ...state.context,
            triggerLocked: false,
            error,
        },
    };
}

export function reduceBoothFlow(
    state: BoothFlowState,
    event: BoothFlowEvent,
): BoothFlowState {
    switch (event.type) {
        case "START":
            if (state.value !== "attract") {
                return state;
            }

            return {
                ...state,
                value: "layout-selection",
            };

        case "SELECT_LAYOUT": {
            if (state.value !== "layout-selection") {
                return state;
            }

            const layout = resolveBoothLayoutConfig(event.layoutId);

            return {
                value: "countdown-selection",
                context: {
                    ...resetCaptureProgress(state.context),
                    layoutId: layout.id,
                    totalShots: layout.shotCount,
                },
            };
        }

        case "SELECT_COUNTDOWN":
            if (state.value !== "countdown-selection") {
                return state;
            }

            return {
                value: "frame-selection",
                context: {
                    ...state.context,
                    countdownSeconds: defaultCountdownSeconds,
                },
            };

        case "SELECT_FRAME":
            if (state.value !== "frame-selection") {
                return state;
            }

            return {
                ...state,
                value: "camera-initializing",
            };

        case "CAMERA_INITIALIZING":
            if (
                state.value !== "frame-selection" &&
                state.value !== "recoverable-error"
            ) {
                return state;
            }

            return {
                ...state,
                value: "camera-initializing",
            };

        case "CAMERA_READY":
            if (
                state.value !== "camera-initializing" &&
                state.value !== "between-shots" &&
                state.value !== "recoverable-error"
            ) {
                return state;
            }

            return {
                value: "preview-ready",
                context: {
                    ...state.context,
                    triggerLocked: false,
                    error: undefined,
                },
            };

        case "START_COUNTDOWN":
            if (
                state.value !== "preview-ready" ||
                state.context.triggerLocked ||
                (event.source === "gesture" &&
                    state.context.awaitingGestureRelease)
            ) {
                return state;
            }

            return {
                value: "countdown",
                context: {
                    ...state.context,
                    triggerLocked: true,
                    awaitingGestureRelease:
                        event.source === "gesture" ||
                        state.context.awaitingGestureRelease,
                },
            };

        case "GESTURE_RELEASED":
            return {
                ...state,
                context: {
                    ...state.context,
                    awaitingGestureRelease: false,
                },
            };

        case "COUNTDOWN_DONE":
            if (state.value !== "countdown") {
                return state;
            }

            return {
                ...state,
                value: "capturing",
            };

        case "CAPTURE_SUCCEEDED":
            if (state.value !== "capturing") {
                return state;
            }

            return {
                value: "saving-original",
                context: {
                    ...state.context,
                    pendingPhotoId: event.photoId,
                },
            };

        case "CAPTURE_FAILED":
            if (
                state.value !== "countdown" &&
                state.value !== "capturing"
            ) {
                return state;
            }

            return withError(state, event.error);

        case "SAVE_ORIGINAL_SUCCEEDED":
            if (
                state.value !== "saving-original" ||
                !state.context.pendingPhotoId
            ) {
                return state;
            }

            return {
                ...state,
                context: {
                    ...state.context,
                    savedPhotoIds: [
                        ...state.context.savedPhotoIds,
                        state.context.pendingPhotoId,
                    ],
                    pendingPhotoId: undefined,
                },
            };

        case "SAVE_ORIGINAL_FAILED":
            if (state.value !== "saving-original") {
                return state;
            }

            return withError(
                {
                    ...state,
                    context: {
                        ...state.context,
                        pendingPhotoId: undefined,
                    },
                },
                event.error,
            );

        case "NEXT_SHOT_READY": {
            if (
                state.value !== "saving-original" ||
                state.context.pendingPhotoId
            ) {
                return state;
            }

            const savedCount = state.context.savedPhotoIds.length;
            const nextShotIndex = Math.min(
                savedCount,
                state.context.totalShots,
            );

            if (savedCount >= state.context.totalShots) {
                return {
                    value: "processing-layout",
                    context: {
                        ...state.context,
                        currentShotIndex: nextShotIndex,
                        triggerLocked: false,
                    },
                };
            }

            return {
                value: "between-shots",
                context: {
                    ...state.context,
                    currentShotIndex: nextShotIndex,
                    triggerLocked: false,
                },
            };
        }

        case "LAYOUT_PROCESSED":
            if (state.value !== "processing-layout") {
                return state;
            }

            return {
                ...state,
                value: "customizing",
            };

        case "CUSTOMIZATION_DONE":
            if (state.value !== "customizing") {
                return state;
            }

            return {
                ...state,
                value: "generating-final",
            };

        case "FINAL_READY":
            if (state.value !== "generating-final") {
                return state;
            }

            return {
                ...state,
                value: "result",
            };

        case "RETAKE_ALL":
            if (
                state.value !== "result" &&
                state.value !== "recoverable-error"
            ) {
                return state;
            }

            return {
                value: "preview-ready",
                context: resetCaptureProgress(state.context),
            };

        case "DONE":
            if (state.value !== "result") {
                return state;
            }

            return {
                ...state,
                value: "completed",
            };

        case "RECOVERABLE_ERROR":
            return withError(state, event.error);

        case "FATAL_ERROR":
            return withError(state, event.error, true);

        case "RESET":
            return createBoothFlowState(state.context.layoutId);

        default:
            return state;
    }
}
