"use client";

import {
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";

import { boothConfig } from "@/config/booth.config";
import type { BoothState } from "@/types/booth";
import type { GestureResult } from "@/types/gesture";

interface UseBoothMachineOptions {
    gesture: GestureResult;
    onCapture: () => Promise<void>;
}

export function useBoothMachine({
    gesture,
    onCapture,
}: UseBoothMachineOptions) {
    const [state, setState] =
        useState<BoothState>("idle");

    const [countdown, setCountdown] =
        useState<number | null>(null);

    const actionLockedRef = useRef(false);
    const countdownRunIdRef = useRef(0);
    const countdownTimeoutRef =
        useRef<number | null>(null);
    const countdownResolveRef =
        useRef<(() => void) | null>(null);
    const mountedRef = useRef(true);

    const clearCountdownTimeout =
        useCallback(() => {
            if (
                countdownTimeoutRef.current !== null
            ) {
                window.clearTimeout(
                    countdownTimeoutRef.current,
                );

                countdownTimeoutRef.current = null;
            }

            countdownResolveRef.current?.();
            countdownResolveRef.current = null;
        }, []);

    const cancelActiveCountdown = useCallback(() => {
        countdownRunIdRef.current += 1;
        actionLockedRef.current = false;
        clearCountdownTimeout();
    }, [clearCountdownTimeout]);

    useEffect(() => {
        return () => {
            mountedRef.current = false;
            cancelActiveCountdown();
        };
    }, [cancelActiveCountdown]);

    const startCountdown =
        useCallback(async () => {
            if (actionLockedRef.current) {
                return;
            }

            actionLockedRef.current = true;

            const runId =
                countdownRunIdRef.current + 1;

            countdownRunIdRef.current = runId;
            setState("countdown");

            const isCurrentRun = () =>
                mountedRef.current &&
                countdownRunIdRef.current === runId;

            for (
                let value =
                    boothConfig.countdown.seconds;
                value >= 1;
                value -= 1
            ) {
                if (!isCurrentRun()) {
                    return;
                }

                setCountdown(value);

                await new Promise<void>(
                    (resolve) => {
                        countdownResolveRef.current =
                            resolve;

                        countdownTimeoutRef.current =
                            window.setTimeout(
                                () => {
                                    countdownTimeoutRef.current =
                                        null;
                                    countdownResolveRef.current =
                                        null;
                                    resolve();
                                },
                                1000,
                            );
                    },
                );
            }

            if (!isCurrentRun()) {
                return;
            }

            setCountdown(null);
            setState("capturing");

            try {
                await onCapture();

                if (!isCurrentRun()) {
                    return;
                }

                setState("result");
            } catch (cause) {
                if (!isCurrentRun()) {
                    return;
                }

                console.warn(
                    "Capture failed:",
                    cause,
                );

                setState("error");
                actionLockedRef.current = false;
            }
        }, [onCapture]);

    useEffect(() => {
        if (
            state === "countdown" ||
            state === "capturing" ||
            state === "result"
        ) {
            return;
        }

        const openPalmIsStable =
            gesture.name === "Open_Palm" &&
            gesture.confidence >=
            boothConfig.gesture
                .openPalmConfidence &&
            gesture.heldDurationMs >=
            boothConfig.gesture
                .openPalmHoldMs;

        if (
            openPalmIsStable &&
            state === "idle"
        ) {
            const timeoutId = window.setTimeout(
                () => {
                    setState("ready");
                },
                0,
            );

            return () => {
                window.clearTimeout(timeoutId);
            };
        }

        const closedFistIsStable =
            gesture.name === "Closed_Fist" &&
            gesture.confidence >=
            boothConfig.gesture
                .closedFistConfidence &&
            gesture.heldDurationMs >=
            boothConfig.gesture
                .closedFistHoldMs;

        if (
            closedFistIsStable &&
            (state === "idle" ||
                state === "ready")
        ) {
            const timeoutId = window.setTimeout(
                () => {
                    void startCountdown();
                },
                0,
            );

            return () => {
                window.clearTimeout(timeoutId);
            };
        }
    }, [
        gesture,
        startCountdown,
        state,
    ]);

    const reset = useCallback(() => {
        cancelActiveCountdown();
        setCountdown(null);
        setState("idle");
    }, [cancelActiveCountdown]);

    const captureManually =
        useCallback(() => {
            void startCountdown();
        }, [startCountdown]);

    return {
        state,
        countdown,
        reset,
        captureManually,
    };
}