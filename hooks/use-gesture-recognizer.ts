"use client";

import {
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";

import {
    FilesetResolver,
    GestureRecognizer,
} from "@mediapipe/tasks-vision";

import { boothConfig } from "@/config/booth.config";
import type {
    GestureResult,
    SupportedGesture,
} from "@/types/gesture";

const EMPTY_RESULT: GestureResult = {
    name: "None",
    confidence: 0,
    heldDurationMs: 0,
};

function normalizeGesture(
    rawName: string | undefined,
): SupportedGesture {
    if (rawName === "Open_Palm") {
        return "Open_Palm";
    }

    if (rawName === "Closed_Fist") {
        return "Closed_Fist";
    }

    if (rawName === "Pointing_Up") {
        return "Pointing_Up";
    }

    if (!rawName || rawName === "None") {
        return "None";
    }

    return "Unknown";
}

function getGestureThreshold(
    gesture: SupportedGesture,
): number {
    if (gesture === "Open_Palm") {
        return boothConfig.gesture.openPalmConfidence;
    }

    if (gesture === "Closed_Fist") {
        return boothConfig.gesture.closedFistConfidence;
    }

    if (gesture === "Pointing_Up") {
        return boothConfig.gesture.pointingUpConfidence;
    }

    return 1;
}

export function useGestureRecognizer(
    videoRef: React.RefObject<HTMLVideoElement | null>,
    enabled: boolean,
) {
    const recognizerRef =
        useRef<GestureRecognizer | null>(null);

    const animationFrameRef =
        useRef<number | null>(null);

    const isDetectingRef = useRef(false);
    const lastInferenceAtRef = useRef(0);
    const lastVideoTimeRef = useRef(-1);

    const stableGestureRef =
        useRef<SupportedGesture>("None");

    const gestureStartedAtRef = useRef(0);
    const gestureLastSeenAtRef = useRef(0);

    const [result, setResult] =
        useState<GestureResult>(EMPTY_RESULT);

    const [isLoading, setIsLoading] =
        useState(true);

    const [error, setError] =
        useState<string | null>(null);

    const resetGesture = useCallback(() => {
        stableGestureRef.current = "None";
        gestureStartedAtRef.current = 0;
        gestureLastSeenAtRef.current = 0;

        setResult(EMPTY_RESULT);
    }, []);

    const initialize = useCallback(
        async (isCancelled: () => boolean) => {
            if (
                recognizerRef.current ||
                isCancelled()
            ) {
                return;
            }

            try {
                setIsLoading(true);
                setError(null);

                const vision =
                    await FilesetResolver.forVisionTasks(
                        boothConfig.mediapipe.wasmUrl,
                    );

                if (isCancelled()) {
                    return;
                }

                const recognizer =
                    await GestureRecognizer.createFromOptions(
                        vision,
                        {
                            baseOptions: {
                                modelAssetPath:
                                    boothConfig.mediapipe.modelUrl,

                                // CPU ổn định hơn cho POC trên macOS.
                                delegate: "CPU",
                            },

                            runningMode: "VIDEO",

                            numHands:
                                boothConfig.gesture.numberOfHands,

                            minHandDetectionConfidence: 0.5,
                            minHandPresenceConfidence: 0.5,
                            minTrackingConfidence: 0.5,

                            cannedGesturesClassifierOptions: {
                                maxResults: 1,
                                scoreThreshold: 0.4,
                                categoryAllowlist: [
                                "Open_Palm",
                                "Closed_Fist",
                                "Pointing_Up",
                                ],
                            },
                        },
                    );

                if (isCancelled()) {
                    recognizer.close();
                    return;
                }

                recognizerRef.current = recognizer;
                setIsLoading(false);
            } catch (cause) {
                if (isCancelled()) {
                    return;
                }

                const message =
                    cause instanceof Error
                        ? cause.message
                        : "Không thể khởi tạo Gesture Recognizer.";

                setError(message);
                setIsLoading(false);
            }
        },
        [],
    );

    useEffect(() => {
        let cancelled = false;

        const initializeTimeoutId =
            window.setTimeout(() => {
                void initialize(
                    () => cancelled,
                );
            }, 0);

        return () => {
            cancelled = true;

            window.clearTimeout(
                initializeTimeoutId,
            );

            if (animationFrameRef.current !== null) {
                cancelAnimationFrame(
                    animationFrameRef.current,
                );
            }

            recognizerRef.current?.close();
            recognizerRef.current = null;
            isDetectingRef.current = false;
        };
    }, [initialize]);

    useEffect(() => {
        if (!enabled) {
            const resetTimeoutId = window.setTimeout(
                resetGesture,
                0,
            );

            return () => {
                window.clearTimeout(resetTimeoutId);
            };
        }

        if (isLoading || error) {
            return;
        }

        let cancelled = false;

        const detect = (frameTimestamp: number) => {
            if (cancelled) {
                return;
            }

            const video = videoRef.current;
            const recognizer = recognizerRef.current;

            const videoIsReady =
                video !== null &&
                recognizer !== null &&
                video.readyState >=
                HTMLMediaElement.HAVE_CURRENT_DATA &&
                video.videoWidth > 0 &&
                video.videoHeight > 0 &&
                !video.paused &&
                !video.ended;

            const enoughTimePassed =
                frameTimestamp -
                lastInferenceAtRef.current >=
                boothConfig.gesture.inferenceIntervalMs;

            const isNewVideoFrame =
                video !== null &&
                video.currentTime !==
                lastVideoTimeRef.current;

            if (
                videoIsReady &&
                enoughTimePassed &&
                isNewVideoFrame &&
                !isDetectingRef.current
            ) {
                lastInferenceAtRef.current =
                    frameTimestamp;

                lastVideoTimeRef.current =
                    video.currentTime;

                isDetectingRef.current = true;

                try {
                    const recognition =
                        recognizer.recognizeForVideo(
                            video,
                            frameTimestamp,
                        );

                    const category =
                        recognition.gestures[0]?.[0];

                    const detectedGesture =
                        normalizeGesture(
                            category?.categoryName,
                        );

                    const confidence =
                        category?.score ?? 0;

                    const now = performance.now();

                    const requiredConfidence =
                        getGestureThreshold(
                            detectedGesture,
                        );

                    const gestureIsConfident =
                        detectedGesture !== "None" &&
                        detectedGesture !== "Unknown" &&
                        confidence >= requiredConfidence;

                    if (gestureIsConfident) {
                        const isSameGesture =
                            stableGestureRef.current ===
                            detectedGesture;

                        if (!isSameGesture) {
                            stableGestureRef.current =
                                detectedGesture;

                            gestureStartedAtRef.current =
                                now;
                        }

                        gestureLastSeenAtRef.current =
                            now;

                        setResult({
                            name: detectedGesture,
                            confidence,
                            heldDurationMs:
                                now -
                                gestureStartedAtRef.current,
                        });
                    } else {
                        const timeSinceLastSeen =
                            now -
                            gestureLastSeenAtRef.current;

                        const isInsideGracePeriod =
                            stableGestureRef.current !==
                            "None" &&
                            timeSinceLastSeen <=
                            boothConfig.gesture
                                .lostGestureGraceMs;

                        if (isInsideGracePeriod) {
                            setResult((current) => ({
                                ...current,
                                confidence,
                                heldDurationMs:
                                    now -
                                    gestureStartedAtRef.current,
                            }));
                        } else {
                            stableGestureRef.current =
                                "None";

                            gestureStartedAtRef.current =
                                0;

                            gestureLastSeenAtRef.current =
                                0;

                            setResult({
                                name: "None",
                                confidence,
                                heldDurationMs: 0,
                            });
                        }
                    }
                } catch (cause) {
                    // Không dùng console.error vì Next Dev Overlay
                    // có thể biến log stderr của WASM thành màn hình lỗi.
                    console.warn(
                        "Gesture inference skipped:",
                        cause,
                    );
                } finally {
                    isDetectingRef.current = false;
                }
            }

            animationFrameRef.current =
                requestAnimationFrame(detect);
        };

        animationFrameRef.current =
            requestAnimationFrame(detect);

        return () => {
            cancelled = true;

            if (animationFrameRef.current !== null) {
                cancelAnimationFrame(
                    animationFrameRef.current,
                );
            }

            isDetectingRef.current = false;
        };
    }, [
        enabled,
        error,
        isLoading,
        resetGesture,
        videoRef,
    ]);

    return {
        result,
        isLoading,
        error,
    };
}