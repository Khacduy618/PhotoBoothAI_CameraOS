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
import type { CameraController } from "@/hooks/use-camera";
import { useGestureRecognizer } from "@/hooks/use-gesture-recognizer";
import { renderPhotoOutput } from "@/services/render/render-photo-output";
import {
    saveSharePhoto,
} from "@/services/sharing/share-photo-storage.service";
import {
    MemoryPhotoBlobStorage,
    PhotoStorageService,
} from "@/services/storage/photo-storage.service";
import type { BoothSelection } from "@/types/theme";

export interface CapturedPhoto {
    id: string;
    sessionId: string;
    originalUrl: string;
    outputUrl: string;
    usedFallback: boolean;
}

interface CreateCapturedPhotoOutputOptions {
    originalBlob: Blob;
    sessionId: string;
    photoStorage: Pick<
        PhotoStorageService,
        "saveOriginalPhoto" | "createObjectUrl"
    >;
    renderOriginal: (original: Blob) => Promise<Blob>;
    createObjectUrl?: (blob: Blob) => string;
    createId?: () => string;
    now?: () => string;
    saveSharePhotoRecord?: (input: {
        photoId: string;
        dataUrl: string;
        mimeType: string;
        savedAt: string;
    }) => void;
    createShareDataUrl?: (blob: Blob) => Promise<string>;
}

export function canChangeSetup(
    boothState: string,
    capturedPhotoCount: number,
): boolean {
    return (
        boothState !== "countdown" &&
        boothState !== "capturing" &&
        capturedPhotoCount === 0
    );
}

export async function createBlobDataUrl(
    blob: Blob,
): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener("load", () => {
            if (typeof reader.result === "string") {
                resolve(reader.result);
                return;
            }

            reject(
                new Error(
                    "Không thể tạo dữ liệu chia sẻ ảnh.",
                ),
            );
        });
        reader.addEventListener("error", () => {
            reject(
                reader.error ??
                    new Error(
                        "Không thể đọc dữ liệu ảnh.",
                    ),
            );
        });
        reader.readAsDataURL(blob);
    });
}

export async function createCapturedPhotoOutput({
    originalBlob,
    sessionId,
    photoStorage,
    renderOriginal,
    createObjectUrl = URL.createObjectURL,
    createId = () => crypto.randomUUID(),
    now = () => new Date().toISOString(),
    saveSharePhotoRecord,
    createShareDataUrl = createBlobDataUrl,
}: CreateCapturedPhotoOutputOptions): Promise<CapturedPhoto> {
    const photoId = createId();
    const savedOriginal =
        await photoStorage.saveOriginalPhoto({
            id: photoId,
            sessionId,
            originalBlob,
            capturedAt: now(),
            source: "webcam",
        });

    if (!savedOriginal.ok) {
        throw new Error(savedOriginal.error.message);
    }

    const originalUrlResult =
        photoStorage.createObjectUrl(
            savedOriginal.value.original.blob,
            createObjectUrl,
        );

    if (!originalUrlResult.ok) {
        throw new Error(originalUrlResult.error.message);
    }

    const originalUrl = originalUrlResult.value;
    let outputUrl = originalUrl;
    let outputBlob = savedOriginal.value.original.blob;
    let usedFallback = false;

    try {
        const renderedBlob = await renderOriginal(
            savedOriginal.value.original.blob,
        );
        const renderedUrlResult =
            photoStorage.createObjectUrl(
                renderedBlob,
                createObjectUrl,
            );

        if (!renderedUrlResult.ok) {
            throw new Error(
                renderedUrlResult.error.message,
            );
        }

        outputUrl = renderedUrlResult.value;
        outputBlob = renderedBlob;
    } catch (cause) {
        usedFallback = true;
        console.warn(
            "Render output failed; using original capture:",
            cause,
        );
    }

    if (saveSharePhotoRecord) {
        saveSharePhotoRecord({
            photoId,
            dataUrl: await createShareDataUrl(outputBlob),
            mimeType:
                outputBlob.type ||
                savedOriginal.value.metadata.mimeType,
            savedAt: now(),
        });
    }

    return {
        id: photoId,
        sessionId,
        originalUrl,
        outputUrl,
        usedFallback,
    };
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

export function assertCaptureReady(
    stream: MediaStream | null,
    video: HTMLVideoElement | null,
): HTMLVideoElement {
    if (!stream) {
        throw new Error("Camera chưa kết nối.");
    }

    if (!video) {
        throw new Error("Camera chưa sẵn sàng.");
    }

    if (
        video.videoWidth === 0 ||
        video.videoHeight === 0
    ) {
        throw new Error("Video stream chưa sẵn sàng.");
    }

    return video;
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
    camera: CameraController;
    onBackToSetup?: () => void;
}

export function CameraPreview({
    selection,
    camera,
    onBackToSetup,
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

    const photoStorageRef =
        useRef<PhotoStorageService | null>(null);

    const captureSessionIdRef =
        useRef<string | null>(null);

    if (photoStorageRef.current === null) {
        photoStorageRef.current = new PhotoStorageService(
            new MemoryPhotoBlobStorage(),
        );
    }

    if (captureSessionIdRef.current === null) {
        captureSessionIdRef.current = crypto.randomUUID();
    }

    const {
        adapter,
        stream,
        devices,
        error: cameraError,
        status: cameraStatus,
        isConnecting,
        connect,
    } = camera;

    const [
        selectedDeviceId,
        setSelectedDeviceId,
    ] = useState("");

    const [photoUrl, setPhotoUrl] =
        useState<string | null>(null);

    const [capturedPhotos, setCapturedPhotos] =
        useState<CapturedPhoto[]>([]);

    const [captureError, setCaptureError] =
        useState<string | null>(null);

    useEffect(() => {
        if (hasAutoConnectedRef.current) {
            return;
        }

        if (stream) {
            hasAutoConnectedRef.current = true;
            return;
        }

        hasAutoConnectedRef.current = true;

        void connect();
    }, [connect, stream]);

    useEffect(() => {
        const video = videoRef.current;

        if (!video || !stream) {
            return;
        }

        let cancelled = false;
        video.srcObject = stream;

        const startVideo = async () => {
            try {
                await video.play();
            } catch (cause) {
                const wasInterrupted =
                    cause instanceof DOMException &&
                    cause.name === "AbortError";

                if (!cancelled && !wasInterrupted) {
                    console.warn(
                        "Không thể tự phát camera:",
                        cause,
                    );
                }
            }
        };

        void startVideo();

        return () => {
            cancelled = true;

            if (video.srcObject === stream) {
                video.pause();
                video.srcObject = null;
            }
        };
    }, [stream]);

    useEffect(() => {
        return () => {
            capturedPhotosRef.current.forEach(
                (photo) => {
                    URL.revokeObjectURL(photo.originalUrl);
                    if (photo.outputUrl !== photo.originalUrl) {
                        URL.revokeObjectURL(photo.outputUrl);
                    }
                },
            );

            capturedPhotosRef.current = [];
            photoUrlRef.current = null;
        };
    }, []);

    const capture =
        useCallback(async () => {
            try {
                setCaptureError(null);
                
                const video = assertCaptureReady(
                    stream,
                    videoRef.current,
                );

                const originalBlob =
                    await adapter.capture(video);

                const captureSessionId =
                    captureSessionIdRef.current;
                const photoStorage = photoStorageRef.current;

                if (!captureSessionId || !photoStorage) {
                    throw new Error(
                        "Session lưu ảnh chưa sẵn sàng.",
                    );
                }

                const nextPhoto = await createCapturedPhotoOutput({
                    originalBlob,
                    sessionId: captureSessionId,
                    photoStorage,
                    saveSharePhotoRecord:
                        typeof window !== "undefined"
                            ? (record) => {
                                saveSharePhoto(
                                    window.localStorage,
                                    record,
                                );
                            }
                            : undefined,
                    renderOriginal: (original) =>
                        renderPhotoOutput({
                            original,
                            theme: selectedTheme,
                            frame: selectedFrame,
                            style: selectedStyle,
                        }),
                });

                photoUrlRef.current = nextPhoto.outputUrl;
                capturedPhotosRef.current = [
                    nextPhoto,
                    ...capturedPhotosRef.current,
                ];

                setCapturedPhotos(
                    capturedPhotosRef.current,
                );
                setPhotoUrl(nextPhoto.outputUrl);
            } catch (cause) {
                const errorMessage =
                    cause instanceof Error
                        ? cause.message
                        : "Không thể chụp ảnh.";
                
                setCaptureError(errorMessage);
                
                console.warn(
                    "Capture failed:",
                    errorMessage,
                );
                
                throw cause;
            }
        }, [
            adapter,
            selectedFrame,
            selectedStyle,
            selectedTheme,
            stream,
        ]);

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

    const aiStatus = !boothConfig.gesture.enabled
        ? "disabled"
        : gesture.error
            ? "failed"
            : gesture.isLoading
                ? "loading"
                : "active";

    const aiStatusLabel =
        aiStatus === "active"
            ? "AI gesture active"
            : aiStatus === "loading"
                ? "Đang tải AI gesture"
                : aiStatus === "failed"
                    ? "AI gesture gặp lỗi"
                    : "AI gesture đang tắt";

    const aiStatusDescription =
        aiStatus === "active"
            ? "Có thể dùng cử chỉ hoặc nút chụp thủ công."
            : "Preview vẫn hoạt động. Hãy dùng nút Chụp thủ công để tiếp tục.";

    const aiStatusClassName =
        aiStatus === "active"
            ? "border-emerald-400/30 bg-emerald-400/15 text-emerald-100"
            : aiStatus === "loading"
                ? "border-sky-400/30 bg-sky-400/15 text-sky-100"
                : aiStatus === "failed"
                    ? "border-amber-400/40 bg-amber-400/15 text-amber-100"
                    : "border-zinc-500/40 bg-zinc-700/60 text-zinc-100";

    const handleRetake = useCallback(
        async (reconnectCamera = false) => {
            setCaptureError(null);
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

    // PB-006: Explicit capture error UI
    if (boothState === "error") {
        return (
            <section className="mx-auto flex w-full max-w-5xl flex-col items-center justify-center min-h-[80vh] gap-8 px-8 text-center">
                <div className="flex flex-col gap-6 max-w-2xl">
                    <div className="text-7xl">⚠️</div>
                    
                    <h1 className="text-5xl md:text-6xl font-bold">
                        Chụp ảnh thất bại
                    </h1>

                    <div className="text-xl md:text-2xl text-zinc-400 space-y-2">
                        {captureError ? (
                            <p>{captureError}</p>
                        ) : (
                            <p>Không thể hoàn thành chụp ảnh. Vui lòng thử lại.</p>
                        )}
                    </div>

                    {cameraError ? (
                        <div className="text-lg text-amber-400 bg-amber-400/10 rounded-2xl px-6 py-4">
                            Camera: {cameraError}
                        </div>
                    ) : null}
                </div>

                <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
                    <button
                        type="button"
                        onClick={() => {
                            void handleRetake(true);
                        }}
                        className="flex-1 px-8 py-6 text-2xl font-semibold bg-white text-black rounded-full transition-all hover:bg-zinc-200 hover:scale-105 active:scale-95"
                    >
                        Thử lại
                    </button>

                    {onBackToSetup ? (
                        <button
                            type="button"
                            onClick={() => {
                                setCaptureError(null);
                                onBackToSetup();
                            }}
                            className="flex-1 px-8 py-6 text-2xl font-semibold bg-zinc-800 text-white rounded-full border-2 border-zinc-700 transition-all hover:bg-zinc-700 hover:scale-105 active:scale-95"
                        >
                            Quay lại
                        </button>
                    ) : null}
                </div>

                <div className="text-sm text-zinc-600 mt-4">
                    <p>Nếu vấn đề vẫn tiếp diễn, vui lòng liên hệ nhân viên hỗ trợ.</p>
                </div>
            </section>
        );
    }

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

                    {capturedPhotos[0]?.usedFallback ? (
                        <p className="mt-2 text-sm text-amber-400">
                            Không thể render theme/khung/style; đang dùng ảnh gốc.
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
                    <div>
                        Camera: {cameraStatus.toUpperCase()}
                    </div>
                    <div>
                        Held: {" "}
                        {Math.round(
                            gesture.result.heldDurationMs,
                        )}
                        ms / {requiredHoldMs}ms
                    </div>
                </div>


                <div className="flex flex-wrap gap-2">
                    {onBackToSetup ? (
                        <button
                            type="button"
                            disabled={
                                !canChangeSetup(
                                    boothState,
                                    capturedPhotos.length,
                                )
                            }
                            className="rounded-lg border px-4 py-2 disabled:opacity-50"
                            onClick={onBackToSetup}
                        >
                            Đổi setup
                        </button>
                    ) : null}

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

                <div className={`absolute left-5 top-5 max-w-sm rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur ${aiStatusClassName}`}>
                    <div className="flex items-center justify-between gap-3">
                        <div className="font-semibold">
                            {aiStatusLabel}
                        </div>

                        <div className="rounded-full bg-black/30 px-2 py-1 text-xs uppercase tracking-wide">
                            {aiStatus}
                        </div>
                    </div>

                    {aiStatus === "active" ? (
                        <div className="mt-2">
                            <div className="font-medium">
                                {gestureLabel}
                            </div>

                            <div className="text-sm opacity-80">
                                {Math.round(
                                    gesture.result.confidence *
                                    100,
                                )}
                                % confidence
                            </div>

                            <div className="mt-2 h-2 w-44 overflow-hidden rounded-full bg-black/30">
                                <div
                                    className="h-full bg-emerald-300 transition-[width]"
                                    style={{
                                        width: `${holdProgress}%`,
                                    }}
                                />
                            </div>
                        </div>
                    ) : (
                        <p className="mt-2 text-sm leading-relaxed opacity-90">
                            {aiStatusDescription}
                        </p>
                    )}

                    {aiStatus === "failed" && gesture.error ? (
                        <p className="mt-2 text-xs leading-relaxed text-amber-50/80">
                            {gesture.error}
                        </p>
                    ) : null}
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
                                href={photo.outputUrl}
                                download="momentai-photo.jpg"
                                className="block overflow-hidden rounded-xl border border-white/20 bg-black"
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={photo.outputUrl}
                                    alt="Ảnh đã chụp"
                                    className="aspect-video w-full object-cover"
                                />
                            </a>
                        ))}
                </aside>
            ) : null}

            <footer className="flex flex-wrap items-center justify-between gap-4">
                <div className="max-w-xl text-sm">
                    {cameraError ? (
                        <span className="text-red-500">
                            {cameraError}
                        </span>
                    ) : null}

                    {!cameraError && aiStatus !== "active" ? (
                        <span className="text-amber-300">
                            {aiStatusDescription}
                        </span>
                    ) : null}
                </div>

                <div className="flex flex-col items-end gap-2">
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
                        {boothState === "countdown"
                            ? "Đang đếm ngược..."
                            : boothState === "capturing"
                                ? "Đang chụp..."
                                : "Chụp thủ công"}
                    </button>

                    {!stream ? (
                        <p className="max-w-xs text-right text-xs text-neutral-400">
                            Camera chưa sẵn sàng nên chưa thể bắt đầu countdown.
                        </p>
                    ) : null}
                </div>
            </footer>
        </section>
    );
}
