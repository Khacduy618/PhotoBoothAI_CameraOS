import { act, renderHook } from "@testing-library/react";
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";

const mediapipeMocks = vi.hoisted(() => ({
    forVisionTasks: vi.fn(),
    createFromOptions: vi.fn(),
}));

vi.mock("@mediapipe/tasks-vision", () => ({
    FilesetResolver: {
        forVisionTasks:
            mediapipeMocks.forVisionTasks,
    },
    GestureRecognizer: {
        createFromOptions:
            mediapipeMocks.createFromOptions,
    },
}));

import { boothConfig } from "@/config/booth.config";
import { useGestureRecognizer } from "@/hooks/use-gesture-recognizer";

function createVideoRef() {
    return {
        current: null,
    } as React.RefObject<HTMLVideoElement | null>;
}

describe("useGestureRecognizer", () => {
    it("keeps gesture recognition enabled by default", () => {
        expect(boothConfig.gesture.enabled).toBe(true);
    });

    beforeEach(() => {
        vi.useFakeTimers();
        mediapipeMocks.forVisionTasks.mockReset();
        mediapipeMocks.createFromOptions.mockReset();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it("does not initialize MediaPipe while gesture recognition is disabled", async () => {
        const { result } = renderHook(() =>
            useGestureRecognizer(
                createVideoRef(),
                false,
            ),
        );

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });

        expect(
            mediapipeMocks.forVisionTasks,
        ).not.toHaveBeenCalled();
        expect(
            mediapipeMocks.createFromOptions,
        ).not.toHaveBeenCalled();
        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toBeNull();
    });

    it("initializes MediaPipe after the scheduled startup", async () => {
        const recognizer = {
            close: vi.fn(),
            recognizeForVideo: vi.fn(),
        };

        mediapipeMocks.forVisionTasks.mockResolvedValue(
            {},
        );
        mediapipeMocks.createFromOptions.mockResolvedValue(
            recognizer,
        );

        const { result } = renderHook(() =>
            useGestureRecognizer(
                createVideoRef(),
                true,
            ),
        );

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });

        expect(
            mediapipeMocks.forVisionTasks,
        ).toHaveBeenCalledTimes(1);
        expect(
            mediapipeMocks.createFromOptions,
        ).toHaveBeenCalledTimes(1);
        expect(
            mediapipeMocks.createFromOptions,
        ).toHaveBeenCalledWith(
            {},
            expect.objectContaining({
                cannedGesturesClassifierOptions:
                    expect.objectContaining({
                        categoryAllowlist:
                            expect.arrayContaining([
                                "Pointing_Up",
                            ]),
                    }),
            }),
        );
        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toBeNull();
    });

    it("closes a late-created recognizer when initialization is cancelled", async () => {
        let resolveVision:
            | ((value: object) => void)
            | undefined;

        let resolveRecognizer:
            | ((value: {
                  close: () => void;
              }) => void)
            | undefined;

        const recognizer = {
            close: vi.fn(),
            recognizeForVideo: vi.fn(),
        };

        mediapipeMocks.forVisionTasks.mockReturnValue(
            new Promise((resolve) => {
                resolveVision = resolve;
            }),
        );

        mediapipeMocks.createFromOptions.mockReturnValue(
            new Promise((resolve) => {
                resolveRecognizer = resolve;
            }),
        );

        const { unmount } = renderHook(() =>
            useGestureRecognizer(
                createVideoRef(),
                true,
            ),
        );

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });

        await act(async () => {
            resolveVision?.({});
        });

        unmount();

        await act(async () => {
            resolveRecognizer?.(recognizer);
        });

        expect(recognizer.close).toHaveBeenCalledTimes(1);
    });

    it("cleans scheduled initialization before it starts", () => {
        const { unmount } = renderHook(() =>
            useGestureRecognizer(
                createVideoRef(),
                true,
            ),
        );

        unmount();

        act(() => {
            vi.advanceTimersByTime(0);
        });

        expect(
            mediapipeMocks.forVisionTasks,
        ).not.toHaveBeenCalled();
    });

    it("resets gesture result when disabled", async () => {
        mediapipeMocks.forVisionTasks.mockResolvedValue(
            {},
        );
        mediapipeMocks.createFromOptions.mockResolvedValue(
            {
                close: vi.fn(),
                recognizeForVideo: vi.fn(),
            },
        );

        const { result, rerender } = renderHook(
            ({ enabled }) =>
                useGestureRecognizer(
                    createVideoRef(),
                    enabled,
                ),
            {
                initialProps: {
                    enabled: true,
                },
            },
        );

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });

        rerender({ enabled: false });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });

        expect(result.current.result).toEqual({
            name: "None",
            confidence: 0,
            heldDurationMs: 0,
        });
    });
});
