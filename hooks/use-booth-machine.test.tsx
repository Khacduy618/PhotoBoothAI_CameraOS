import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { boothConfig } from "@/config/booth.config";
import { useBoothMachine } from "@/hooks/use-booth-machine";
import type { GestureResult } from "@/types/gesture";

const noGesture: GestureResult = {
    name: "None",
    confidence: 0,
    heldDurationMs: 0,
};

const openPalm: GestureResult = {
    name: "Open_Palm",
    confidence: boothConfig.gesture.openPalmConfidence,
    heldDurationMs: boothConfig.gesture.openPalmHoldMs,
};

const closedFist: GestureResult = {
    name: "Closed_Fist",
    confidence: boothConfig.gesture.closedFistConfidence,
    heldDurationMs: boothConfig.gesture.closedFistHoldMs,
};

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe("useBoothMachine", () => {
    it("starts in idle state", () => {
        const onCapture = vi.fn(async () => undefined);

        const { result } = renderHook(
            ({ gesture }) =>
                useBoothMachine({
                    gesture,
                    onCapture,
                }),
            {
                initialProps: {
                    gesture: noGesture,
                },
            },
        );

        expect(result.current.state).toBe("idle");
        expect(result.current.countdown).toBeNull();
    });

    it("moves to ready when open palm is stable", async () => {
        vi.useFakeTimers();
        const onCapture = vi.fn(async () => undefined);

        const { result, rerender } = renderHook(
            ({ gesture }) =>
                useBoothMachine({
                    gesture,
                    onCapture,
                }),
            {
                initialProps: {
                    gesture: noGesture,
                },
            },
        );

        rerender({ gesture: openPalm });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });

        expect(result.current.state).toBe("ready");
    });

    it("captures after closed fist countdown", async () => {
        vi.useFakeTimers();
        const onCapture = vi.fn(async () => undefined);

        const { result, rerender } = renderHook(
            ({ gesture }) =>
                useBoothMachine({
                    gesture,
                    onCapture,
                }),
            {
                initialProps: {
                    gesture: noGesture,
                },
            },
        );

        rerender({ gesture: closedFist });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });

        expect(result.current.state).toBe("countdown");

        await act(async () => {
            await vi.advanceTimersByTimeAsync(
                boothConfig.countdown.seconds * 1000,
            );
        });

        expect(onCapture).toHaveBeenCalledTimes(1);
        expect(result.current.state).toBe("result");
        expect(result.current.countdown).toBeNull();
    });

    it("requires closed fist release before another gesture capture", async () => {
        vi.useFakeTimers();
        const onCapture = vi.fn(async () => undefined);

        const { result, rerender } = renderHook(
            ({ gesture }) =>
                useBoothMachine({
                    gesture,
                    onCapture,
                }),
            {
                initialProps: {
                    gesture: noGesture,
                },
            },
        );

        rerender({ gesture: closedFist });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(
                boothConfig.countdown.seconds * 1000,
            );
        });

        expect(onCapture).toHaveBeenCalledTimes(1);
        expect(result.current.state).toBe("result");

        act(() => {
            result.current.reset();
        });

        rerender({ gesture: closedFist });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });

        expect(result.current.state).toBe("idle");
        expect(onCapture).toHaveBeenCalledTimes(1);

        rerender({ gesture: noGesture });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });

        rerender({ gesture: closedFist });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(
                boothConfig.countdown.seconds * 1000,
            );
        });

        expect(onCapture).toHaveBeenCalledTimes(2);
        expect(result.current.state).toBe("result");
    });

    it("runs countdown and capture for each selected layout shot", async () => {
        vi.useFakeTimers();
        const onCapture = vi.fn(async () => undefined);

        const { result } = renderHook(() =>
            useBoothMachine({
                gesture: noGesture,
                onCapture,
                totalShots: 3,
                countdownSeconds: 3,
                betweenShotDelayMs: 2000,
            }),
        );

        act(() => {
            result.current.captureManually();
        });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(3000);
        });

        expect(onCapture).toHaveBeenCalledTimes(1);
        expect(result.current.state).toBe("between-shots");
        expect(result.current.capturedShotCount).toBe(1);

        await act(async () => {
            await vi.advanceTimersByTimeAsync(2000);
        });
        expect(result.current.state).toBe("countdown");

        await act(async () => {
            await vi.advanceTimersByTimeAsync(3000);
        });
        expect(onCapture).toHaveBeenCalledTimes(2);
        expect(result.current.capturedShotCount).toBe(2);

        await act(async () => {
            await vi.advanceTimersByTimeAsync(2000 + 3000);
        });

        expect(onCapture).toHaveBeenCalledTimes(3);
        expect(result.current.state).toBe("result");
        expect(result.current.capturedShotCount).toBe(3);
    });

    it("ignores duplicate manual capture while countdown is active", async () => {
        vi.useFakeTimers();
        const onCapture = vi.fn(async () => undefined);

        const { result } = renderHook(() =>
            useBoothMachine({
                gesture: noGesture,
                onCapture,
            }),
        );

        act(() => {
            result.current.captureManually();
            result.current.captureManually();
        });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(
                boothConfig.countdown.seconds * 1000,
            );
        });

        expect(onCapture).toHaveBeenCalledTimes(1);
        expect(result.current.state).toBe("result");
    });

    it("reset during between-shot delay prevents the next capture", async () => {
        vi.useFakeTimers();
        const onCapture = vi.fn(async () => undefined);

        const { result } = renderHook(() =>
            useBoothMachine({
                gesture: noGesture,
                onCapture,
                totalShots: 2,
                countdownSeconds: 3,
                betweenShotDelayMs: 2000,
            }),
        );

        act(() => {
            result.current.captureManually();
        });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(3000);
        });

        expect(onCapture).toHaveBeenCalledTimes(1);
        expect(result.current.state).toBe("between-shots");

        act(() => {
            result.current.reset();
        });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(2000 + 3000);
        });

        expect(onCapture).toHaveBeenCalledTimes(1);
        expect(result.current.state).toBe("idle");
        expect(result.current.capturedShotCount).toBe(0);
    });

    it("reset during countdown prevents capture", async () => {
        vi.useFakeTimers();
        const onCapture = vi.fn(async () => undefined);

        const { result, rerender } = renderHook(
            ({ gesture }) =>
                useBoothMachine({
                    gesture,
                    onCapture,
                }),
            {
                initialProps: {
                    gesture: noGesture,
                },
            },
        );

        rerender({ gesture: closedFist });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });

        rerender({ gesture: noGesture });

        act(() => {
            result.current.reset();
        });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(
                boothConfig.countdown.seconds * 1000,
            );
        });

        expect(onCapture).not.toHaveBeenCalled();
        expect(result.current.state).toBe("idle");
        expect(result.current.countdown).toBeNull();
    });

    it("unmount during countdown prevents capture", async () => {
        vi.useFakeTimers();
        const onCapture = vi.fn(async () => undefined);

        const { rerender, unmount } = renderHook(
            ({ gesture }) =>
                useBoothMachine({
                    gesture,
                    onCapture,
                }),
            {
                initialProps: {
                    gesture: noGesture,
                },
            },
        );

        rerender({ gesture: closedFist });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });

        unmount();

        await act(async () => {
            await vi.advanceTimersByTimeAsync(
                boothConfig.countdown.seconds * 1000,
            );
        });

        expect(onCapture).not.toHaveBeenCalled();
    });

    it("multi-shot failure preserves completed count until full retry starts", async () => {
        vi.useFakeTimers();
        const onCapture = vi
            .fn()
            .mockResolvedValueOnce(undefined)
            .mockRejectedValueOnce(
                new Error("capture failed"),
            )
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce(undefined);

        const { result } = renderHook(() =>
            useBoothMachine({
                gesture: noGesture,
                onCapture,
                totalShots: 2,
                countdownSeconds: 3,
                betweenShotDelayMs: 2000,
            }),
        );

        act(() => {
            result.current.captureManually();
        });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(3000);
        });
        expect(result.current.capturedShotCount).toBe(1);

        await act(async () => {
            await vi.advanceTimersByTimeAsync(2000 + 3000);
        });

        expect(result.current.state).toBe("error");
        expect(result.current.capturedShotCount).toBe(1);

        act(() => {
            result.current.captureManually();
        });

        expect(result.current.capturedShotCount).toBe(0);

        await act(async () => {
            await vi.advanceTimersByTimeAsync(3000);
        });
        expect(result.current.capturedShotCount).toBe(1);

        await act(async () => {
            await vi.advanceTimersByTimeAsync(2000 + 3000);
        });

        expect(onCapture).toHaveBeenCalledTimes(4);
        expect(result.current.state).toBe("result");
        expect(result.current.capturedShotCount).toBe(2);
    });

    it("capture failure moves to error and allows retry", async () => {
        vi.useFakeTimers();
        const onCapture = vi
            .fn()
            .mockRejectedValueOnce(
                new Error("capture failed"),
            )
            .mockResolvedValueOnce(undefined);

        const { result, rerender } = renderHook(
            ({ gesture }) =>
                useBoothMachine({
                    gesture,
                    onCapture,
                }),
            {
                initialProps: {
                    gesture: noGesture,
                },
            },
        );

        rerender({ gesture: closedFist });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(
                boothConfig.countdown.seconds * 1000,
            );
        });

        expect(result.current.state).toBe("error");

        act(() => {
            result.current.captureManually();
        });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(
                boothConfig.countdown.seconds * 1000,
            );
        });

        expect(onCapture).toHaveBeenCalledTimes(2);
        expect(result.current.state).toBe("result");
    });
});
