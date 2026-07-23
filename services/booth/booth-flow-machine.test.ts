import { describe, expect, it } from "vitest";

import {
    createBoothFlowState,
    reduceBoothFlow,
} from "@/services/booth/booth-flow-machine";
import type {
    BoothFlowError,
    BoothFlowEvent,
    BoothFlowState,
} from "@/types/booth";
import type { BoothLayoutId } from "@/types/customization";

const recoverableError: BoothFlowError = {
    code: "capture_failed",
    message: "Không thể chụp ảnh.",
    recoverable: true,
};

function applyEvents(
    initialState: BoothFlowState,
    events: readonly BoothFlowEvent[],
): BoothFlowState {
    return events.reduce(reduceBoothFlow, initialState);
}

function selectLayoutFlow(
    layoutId: BoothLayoutId,
): BoothFlowState {
    return applyEvents(createBoothFlowState(), [
        { type: "START" },
        { type: "SELECT_LAYOUT", layoutId },
        { type: "SELECT_COUNTDOWN", seconds: 8 },
        { type: "SELECT_FRAME" },
        { type: "CAMERA_READY" },
    ]);
}

function captureShot(
    state: BoothFlowState,
    photoId: string,
): BoothFlowState {
    return applyEvents(state, [
        { type: "START_COUNTDOWN", source: "touch" },
        { type: "COUNTDOWN_DONE" },
        { type: "CAPTURE_SUCCEEDED", photoId },
        { type: "SAVE_ORIGINAL_SUCCEEDED" },
        { type: "NEXT_SHOT_READY" },
    ]);
}

describe("booth flow machine", () => {
    it("starts at attract with simplified single-shot defaults", () => {
        const state = createBoothFlowState();

        expect(state.value).toBe("attract");
        expect(state.context).toEqual(
            expect.objectContaining({
                layoutId: "single-4x6-landscape",
                totalShots: 1,
                countdownSeconds: 8,
                currentShotIndex: 0,
                savedPhotoIds: [],
                triggerLocked: false,
                awaitingGestureRelease: false,
            }),
        );
    });

    it("walks setup into preview-ready with selected layout and countdown", () => {
        const state = selectLayoutFlow("1x4-vertical");

        expect(state.value).toBe("preview-ready");
        expect(state.context).toEqual(
            expect.objectContaining({
                layoutId: "stacked-4-4x6-portrait",
                totalShots: 4,
                countdownSeconds: 8,
            }),
        );
    });

    it("captures all 2x2 shots before processing layout", () => {
        let state = selectLayoutFlow("2x2");

        state = captureShot(state, "photo-1");
        expect(state.value).toBe("between-shots");
        expect(state.context.currentShotIndex).toBe(1);

        state = reduceBoothFlow(state, { type: "CAMERA_READY" });
        state = captureShot(state, "photo-2");
        state = reduceBoothFlow(state, { type: "CAMERA_READY" });
        state = captureShot(state, "photo-3");
        state = reduceBoothFlow(state, { type: "CAMERA_READY" });
        state = captureShot(state, "photo-4");

        expect(state.value).toBe("processing-layout");
        expect(state.context.savedPhotoIds).toEqual([
            "photo-1",
            "photo-2",
            "photo-3",
            "photo-4",
        ]);
        expect(state.context.currentShotIndex).toBe(4);
    });

    it("captures all 2x3 shots before processing layout", () => {
        let state = selectLayoutFlow("2x3");

        for (let index = 1; index <= 6; index += 1) {
            state = captureShot(state, `photo-${index}`);
            if (index < 6) {
                expect(state.value).toBe("between-shots");
                state = reduceBoothFlow(state, { type: "CAMERA_READY" });
            }
        }

        expect(state.value).toBe("processing-layout");
        expect(state.context.savedPhotoIds).toHaveLength(6);
        expect(state.context.currentShotIndex).toBe(6);
    });

    it("guards duplicate countdown triggers", () => {
        const previewState = selectLayoutFlow("2x2");
        const countdownState = reduceBoothFlow(previewState, {
            type: "START_COUNTDOWN",
            source: "touch",
        });
        const duplicateState = reduceBoothFlow(countdownState, {
            type: "START_COUNTDOWN",
            source: "gesture",
        });

        expect(duplicateState).toBe(countdownState);
        expect(duplicateState.value).toBe("countdown");
    });

    it("requires gesture release before gesture capture can unlock", () => {
        const previewState = selectLayoutFlow("2x2");
        const countdownState = reduceBoothFlow(previewState, {
            type: "START_COUNTDOWN",
            source: "gesture",
        });

        expect(countdownState.context.awaitingGestureRelease).toBe(true);

        const releasedState = reduceBoothFlow(countdownState, {
            type: "GESTURE_RELEASED",
        });

        expect(releasedState.context.awaitingGestureRelease).toBe(false);
    });

    it("blocks sustained gesture from triggering the next shot until release", () => {
        let state = selectLayoutFlow("2x2");
        state = reduceBoothFlow(state, {
            type: "START_COUNTDOWN",
            source: "gesture",
        });
        state = reduceBoothFlow(state, { type: "COUNTDOWN_DONE" });
        state = reduceBoothFlow(state, {
            type: "CAPTURE_SUCCEEDED",
            photoId: "photo-1",
        });
        state = reduceBoothFlow(state, {
            type: "SAVE_ORIGINAL_SUCCEEDED",
        });
        state = reduceBoothFlow(state, { type: "NEXT_SHOT_READY" });
        state = reduceBoothFlow(state, { type: "CAMERA_READY" });

        expect(state.value).toBe("preview-ready");
        expect(state.context.awaitingGestureRelease).toBe(true);

        const blockedState = reduceBoothFlow(state, {
            type: "START_COUNTDOWN",
            source: "gesture",
        });

        expect(blockedState).toBe(state);

        const releasedState = reduceBoothFlow(state, {
            type: "GESTURE_RELEASED",
        });
        const nextCountdownState = reduceBoothFlow(releasedState, {
            type: "START_COUNTDOWN",
            source: "gesture",
        });

        expect(nextCountdownState.value).toBe("countdown");
    });

    it("still allows touch trigger while awaiting gesture release", () => {
        const previewState = selectLayoutFlow("2x2");
        const awaitingReleaseState = {
            ...previewState,
            context: {
                ...previewState.context,
                awaitingGestureRelease: true,
            },
        };

        const countdownState = reduceBoothFlow(awaitingReleaseState, {
            type: "START_COUNTDOWN",
            source: "touch",
        });

        expect(countdownState.value).toBe("countdown");
    });

    it("keeps partial captures when a later capture fails", () => {
        let state = selectLayoutFlow("2x2");
        state = captureShot(state, "photo-1");
        state = reduceBoothFlow(state, { type: "CAMERA_READY" });
        state = reduceBoothFlow(state, {
            type: "START_COUNTDOWN",
            source: "touch",
        });
        state = reduceBoothFlow(state, { type: "COUNTDOWN_DONE" });
        state = reduceBoothFlow(state, {
            type: "CAPTURE_FAILED",
            error: recoverableError,
        });

        expect(state.value).toBe("recoverable-error");
        expect(state.context.savedPhotoIds).toEqual(["photo-1"]);
        expect(state.context.error).toEqual(recoverableError);
    });

    it("does not advance until original save succeeds", () => {
        let state = selectLayoutFlow("2x2");
        state = reduceBoothFlow(state, {
            type: "START_COUNTDOWN",
            source: "touch",
        });
        state = reduceBoothFlow(state, { type: "COUNTDOWN_DONE" });
        state = reduceBoothFlow(state, {
            type: "CAPTURE_SUCCEEDED",
            photoId: "photo-1",
        });

        expect(state.value).toBe("saving-original");
        expect(state.context.pendingPhotoId).toBe("photo-1");
        expect(state.context.savedPhotoIds).toEqual([]);

        const blockedState = reduceBoothFlow(state, {
            type: "NEXT_SHOT_READY",
        });

        expect(blockedState).toBe(state);
    });

    it("preserves prior originals and blocks completion when original save fails", () => {
        let state = selectLayoutFlow("2x2");
        state = captureShot(state, "photo-1");
        state = reduceBoothFlow(state, { type: "CAMERA_READY" });
        state = reduceBoothFlow(state, {
            type: "START_COUNTDOWN",
            source: "touch",
        });
        state = reduceBoothFlow(state, { type: "COUNTDOWN_DONE" });
        state = reduceBoothFlow(state, {
            type: "CAPTURE_SUCCEEDED",
            photoId: "photo-2",
        });
        state = reduceBoothFlow(state, {
            type: "SAVE_ORIGINAL_FAILED",
            error: recoverableError,
        });

        expect(state.value).toBe("recoverable-error");
        expect(state.context.savedPhotoIds).toEqual(["photo-1"]);
        expect(state.context.pendingPhotoId).toBeUndefined();
        expect(state.context.error).toEqual(recoverableError);
    });

    it("moves through processing, customization, final result and done", () => {
        let state = selectLayoutFlow("2x2");
        state = captureShot(state, "photo-1");
        state = reduceBoothFlow(state, { type: "CAMERA_READY" });
        state = captureShot(state, "photo-2");
        state = reduceBoothFlow(state, { type: "CAMERA_READY" });
        state = captureShot(state, "photo-3");
        state = reduceBoothFlow(state, { type: "CAMERA_READY" });
        state = captureShot(state, "photo-4");
        state = reduceBoothFlow(state, { type: "LAYOUT_PROCESSED" });
        state = reduceBoothFlow(state, { type: "CUSTOMIZATION_DONE" });
        state = reduceBoothFlow(state, { type: "FINAL_READY" });

        expect(state.value).toBe("result");

        state = reduceBoothFlow(state, { type: "DONE" });
        expect(state.value).toBe("completed");
    });

    it("retake all resets capture progress without changing layout", () => {
        let state = selectLayoutFlow("1x4-vertical");
        state = captureShot(state, "photo-1");
        state = reduceBoothFlow(state, {
            type: "RECOVERABLE_ERROR",
            error: recoverableError,
        });
        state = reduceBoothFlow(state, { type: "RETAKE_ALL" });

        expect(state.value).toBe("preview-ready");
        expect(state.context.layoutId).toBe("stacked-4-4x6-portrait");
        expect(state.context.savedPhotoIds).toEqual([]);
        expect(state.context.currentShotIndex).toBe(0);
    });
});
