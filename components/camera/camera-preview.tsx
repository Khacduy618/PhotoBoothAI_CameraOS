"use client";

import {
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";

import { boothConfig } from "@/config/booth.config";
import {
    resolveFrameConfig,
    resolveStyleConfig,
    resolveThemeConfig,
} from "@/config/theme.config";
import { useBoothMachine } from "@/hooks/use-booth-machine";
import { useCamera } from "@/hooks/use-camera";
import { useGestureRecognizer } from "@/hooks/use-gesture-recognizer";
import type { BoothSelection } from "@/types/theme";

interface CapturedPhoto {
    id: string;
    url: string;
}

interface PerformRetakeOptions {
    reconnectCamera: boolean;
    selectedDeviceId: string;
    connect: (
        deviceId?: string,
    ) => Promise<boolean>;
    clearPhoto: () => void;
    reset: () => void;
}

export async function performRetake({
    reconnectCamera,
    selectedDeviceId,
    connect,
    clearPhoto,
    reset,
}: PerformRetakeOptions): Promise<boolean> {
    if (reconnectCamera) {
        const reconnected = await connect(
            selectedDeviceId || undefined,
        );

        if (!reconnected) {
            return false;
        }
    }

    clearPhoto();
    reset();

    return true;
}

interface CameraPreviewProps {
    selection: BoothSelection;
}

export function CameraPreview({
    selection,
}: CameraPreviewProps) {
    const selectedTheme = resolveThemeConfig(selection.themeId);
    const selectedFrame = resolveFrameConfig(selection.frameId);
    const selectedStyle = resolveStyleConfig(selection.styleId);

    const videoRef =
        useRef<HTMLVideoElement>(null);

    const hasAutoConnectedRef =
        useRef(false);

    const retakeLockedRef = useRef(false);
    const retakeAwaitingReleaseRef =
        useRef(false);

    const photoUrlRef =
        useRef<string | null>(null);

    const capturedPhotosRef =
        useRef<CapturedPhoto[]>([]);

    const {
        adapter,
        stream,
        devices,
        error: cameraError,
        isConnecting,
        connect,
    } = useCamera();

    const [
        selectedDeviceId,
        setSelectedDeviceId,
    ] = useState("");

    const [photoUrl, setPhotoUrl] =
        useState<string | null>(null);

    const [capturedPhotos, setCapturedPhotos] =
        useState<CapturedPhoto[]>([]);

    useEffect(() => {
        if (hasAutoConnectedRef.current) {
            return;
        }

        hasAutoConnectedRef.current = true;

        void connect();
    }, [connect]);

    useEffect(() => {
        const video = videoRef.current;

        if (!video || !stream) {
            return;
        }

        video.srcObject = stream;

        const startVideo = async () => {
            try {
                await video.play();
            } catch (cause) {
                console.error(
                    "Không thể tự phát camera:",
                    cause,
                );
            }
        };

        void startVideo();

        return () => {
            video.pause();
            video.srcObject = null;
        };
    }, [photoUrl, stream]);

    useEffect(() => {
        return () => {
            capturedPhotosRef.current.forEach(
                (photo) => {
                    URL.revokeObjectURL(photo.url);
                },
            );

            capturedPhotosRef.current = [];
            photoUrlRef.current = null;
        };
    }, []);

    const capture =
        useCallback(async () => {
            const video = videoRef.current;

            if (!video) {
                throw new Error(
                    "Camera chưa sẵn sàng.",
                );
            }

            if (
                video.videoWidth === 0 ||
                video.videoHeight === 0
            ) {
                throw new Error(
                    "Video stream chưa sẵn sàng.",
                );
            }

            const blob =
                await adapter.capture(video);

            const nextUrl =
                URL.createObjectURL(blob);

            const nextPhoto = {
                id: crypto.randomUUID(),
                url: nextUrl,
            };

            photoUrlRef.current = nextUrl;
            capturedPhotosRef.current = [
                nextPhoto,
                ...capturedPhotosRef.current,
            ];

            setCapturedPhotos(
                capturedPhotosRef.current,
            );
            setPhotoUrl(nextUrl);
        }, [adapter]);

    const gesture =
        useGestureRecognizer(
            videoRef,
            Boolean(stream) && boothConfig.gesture.enabled,
        );

    const booth = useBoothMachine({
        gesture: gesture.result,
        onCapture: capture,
    });

    const boothState = booth.state;
    const boothCountdown = booth.countdown;
    const resetBooth = booth.reset;
    const captureManually = booth.captureManually;

    const requiredHoldMs =
        gesture.result.name === "Closed_Fist"
            ? boothConfig.gesture.closedFistHoldMs
            : gesture.result.name ===
                "Pointing_Up"
                ? boothConfig.gesture
                    .pointingUpHoldMs
                : boothConfig.gesture.openPalmHoldMs;

    const holdProgress = Math.min(
        100,
        (gesture.result.heldDurationMs /
            requiredHoldMs) *
        100,
    );

    const gestureLabel =
        gesture.result.name === "Open_Palm"
            ? "✋ Open Palm"
            : gesture.result.name ===
                "Closed_Fist"
                ? "✊ Closed Fist"
                : gesture.result.name ===
                    "Pointing_Up"
                    ? "☝ Pointing Up"
                    : "Đưa tay vào khung hình";

    const handleRetake = useCallback(
        async (reconnectCamera = false) => {
            await performRetake({
                reconnectCamera,
                selectedDeviceId,
                connect,
                clearPhoto: () => {
                    photoUrlRef.current = null;
                    setPhotoUrl(null);
                },
                reset: resetBooth,
            });
        },
        [
            resetBooth,
            connect,
            selectedDeviceId,
        ],
    );

    useEffect(() => {
        if (
            boothState !== "result" ||
            !photoUrl
        ) {
            return;
        }

        const timeoutId = window.setTimeout(
            () => {
                setPhotoUrl(null);
                photoUrlRef.current = null;
                resetBooth();
            },
            3000,
        );

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [resetBooth, boothState, photoUrl]);

    useEffect(() => {
        if (
            boothState !== "result" ||
            !photoUrl ||
            retakeLockedRef.current
        ) {
            return;
        }

        const pointingUpIsStable =
            gesture.result.name === "Pointing_Up" &&
            gesture.result.confidence >=
            boothConfig.gesture
                .pointingUpConfidence &&
            gesture.result.heldDurationMs >=
            boothConfig.gesture.pointingUpHoldMs;

        if (!pointingUpIsStable) {
            retakeAwaitingReleaseRef.current = false;
            return;
        }

        if (retakeAwaitingReleaseRef.current) {
            return;
        }

        retakeLockedRef.current = true;
        retakeAwaitingReleaseRef.current = true;

        const timeoutId = window.setTimeout(
            () => {
                void handleRetake(true).finally(
                    () => {
                        retakeLockedRef.current = false;
                    },
                );
            },
            0,
        );

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [
        boothState,
        gesture.result,
        handleRetake,
        photoUrl,
    ]);

    if (
        boothState === "result" &&
        photoUrl
    ) {
        return (
            <section className="mx-auto flex w-full max-w-5xl flex-col gap-5">
                <header>
                    <h1 className="text-2xl font-semibold">
                        Ảnh đã chụp
                    </h1>

                    <p className="text-sm text-neutral-500">
                        Ảnh sẽ tự thu nhỏ xuống góc phải
                        sau 3 giây để chụp tiếp.
                    </p>

                    {cameraError ? (
                        <p className="mt-2 text-sm text-red-500">
                            {cameraError}
                        </p>
                    ) : null}
                </header>

                <video
                    ref={videoRef}
                    className="pointer-events-none absolute h-px w-px opacity-0"
                    muted
                    autoPlay
                    playsInline
                    aria-hidden="true"
                    tabIndex={-1}
                />

                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={photoUrl}
                    alt="Ảnh vừa chụp"
                    className="aspect-video w-full rounded-3xl object-cover"
                />

                <div className="flex flex-wrap gap-3">
                    <a
                        href={photoUrl}
                        download="momentai-photo.jpg"
                        className="rounded-xl bg-white px-5 py-3 font-medium text-black"
                    >
                        Tải ảnh
                    </a>

                    <button
                        type="button"
                        className="rounded-xl border px-5 py-3"
                        onClick={() => {
                            void handleRetake(false);
                        }}
                    >
                        Chụp lại
                    </button>
                </div>
            </section>
        );
    }

    return (
        <section className="mx-auto flex w-full max-w-6xl flex-col gap-4">
            <header className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold">
                        MomentAI Gesture POC
                    </h1>

                    <p className="text-sm text-neutral-500">
                        ✋ giữ để sẵn sàng, ✊ giữ
                        để bắt đầu chụp.
                    </p>
                    <p className="mt-1 text-xs text-neutral-400">
                        Theme: {selectedTheme.name} · Khung: {selectedFrame.name} · Style: {selectedStyle.name}
                    </p>
                </div>

                <div className="text-xs text-neutral-400">
                    Held:{" "}
                    {Math.round(
                        gesture.result.heldDurationMs,
                    )}
                    ms / {requiredHoldMs}ms
                </div>

                <div className="flex flex-wrap gap-2">
                    <select
                        className="rounded-lg border px-3 py-2 text-black"
                        value={selectedDeviceId}
                        onChange={(event) => {
                            setSelectedDeviceId(
                                event.target.value,
                            );
                        }}
                    >
                        <option value="">
                            Camera mặc định
                        </option>

                        {devices.map((device) => (
                            <option
                                key={device.deviceId}
                                value={device.deviceId}
                            >
                                {device.label}
                            </option>
                        ))}
                    </select>

                    <button
                        type="button"
                        disabled={isConnecting}
                        className="rounded-lg bg-white px-4 py-2 text-black disabled:opacity-50"
                        onClick={() => {
                            void connect(
                                selectedDeviceId ||
                                undefined,
                            );
                        }}
                    >
                        {isConnecting
                            ? "Đang kết nối..."
                            : "Kết nối lại"}
                    </button>
                </div>
            </header>

            <div className="relative aspect-video overflow-hidden rounded-3xl bg-black">
                <video
                    ref={videoRef}
                    className="h-full w-full -scale-x-100 object-cover"
                    muted
                    autoPlay
                    playsInline
                />

                <div className="absolute left-5 top-5 rounded-2xl bg-black/70 px-4 py-3 backdrop-blur">
                    <div className="font-semibold">
                        {gestureLabel}
                    </div>

                    <div className="text-sm text-neutral-300">
                        {Math.round(
                            gesture.result.confidence *
                            100,
                        )}
                        % confidence
                    </div>

                    <div className="mt-2 h-2 w-44 overflow-hidden rounded-full bg-neutral-700">
                        <div
                            className="h-full bg-emerald-400 transition-[width]"
                            style={{
                                width: `${holdProgress}%`,
                            }}
                        />
                    </div>
                </div>

                <div className="absolute right-5 top-5 rounded-xl bg-black/70 px-4 py-2">
                    State:{" "}
                    {boothState.toUpperCase()}
                </div>

                {boothCountdown !== null ? (
                    <div className="absolute inset-0 grid place-items-center bg-black/40 text-[14rem] font-black">
                        {boothCountdown}
                    </div>
                ) : null}
            </div>

            {capturedPhotos.length > 0 ? (
                <aside className="fixed bottom-5 right-5 z-20 flex max-h-[70vh] w-40 flex-col gap-3 overflow-hidden rounded-2xl bg-black/70 p-3 shadow-2xl backdrop-blur">
                    <div className="text-xs font-medium text-white">
                        Ảnh vừa chụp
                    </div>

                    {capturedPhotos
                        .slice(0, 4)
                        .map((photo) => (
                            <a
                                key={photo.id}
                                href={photo.url}
                                download="momentai-photo.jpg"
                                className="block overflow-hidden rounded-xl border border-white/20 bg-black"
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={photo.url}
                                    alt="Ảnh đã chụp"
                                    className="aspect-video w-full object-cover"
                                />
                            </a>
                        ))}
                </aside>
            ) : null}

            <footer className="flex flex-wrap items-center justify-between gap-4">
                <div className="text-sm">
                    {gesture.isLoading ? (
                        <span>
                            Đang tải mô hình cử chỉ...
                        </span>
                    ) : null}

                    {cameraError ||
                        gesture.error ? (
                        <span className="text-red-500">
                            {cameraError ||
                                gesture.error}
                        </span>
                    ) : null}
                </div>

                <button
                    type="button"
                    disabled={
                        !stream ||
                        boothState === "countdown" ||
                        boothState === "capturing"
                    }
                    className="rounded-xl border px-5 py-3 disabled:opacity-40"
                    onClick={
                        captureManually
                    }
                >
                    Chụp thủ công
                </button>
            </footer>
        </section>
    );
}
