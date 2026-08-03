"use client";

import {
    type PointerEvent,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    useContext,
} from "react";

import { BoothSessionContext, useBoothSession } from "@/components/booth/booth-session-context";
import { LoadingLayer, PreviewCell, getStyleFilter } from "@/components/booth/preview-cell";
import { PreviewRenderer } from "@/components/booth/preview-renderer";
import { EditablePreview } from "@/components/customize/editable-preview";
import { CustomizeFlow } from "@/components/customize/customize-flow";
import { FinalResultView } from "@/components/result/final-result-view";
import { ThemeSelector } from "@/components/selectors/theme-selector";
import { FrameSelector } from "@/components/selectors/frame-selector";
import { StyleSelector } from "@/components/selectors/style-selector";
import { StickerSelector } from "@/components/selectors/sticker-selector";
import { TextSelector } from "@/components/selectors/text-selector";
import { getLayoutGeometry, getPhotoCellRects } from "@/services/layout/layout-engine";
import { getCameraStatusLabel } from "@/utils/camera-helpers";
import { resolveStickerConfig } from "@/config/sticker.config";
import { boothConfig } from "@/config/booth.config";
import { resolveBoothLayoutConfig } from "@/config/layout.config";
import {
    defaultBoothSelection,
    frameConfigs,
    styleConfigs,
    themeConfigs,
    resolveFrameConfig,
    resolveStyleConfig,
    resolveThemeConfig,
} from "@/config/theme.config";
import { useBoothMachine } from "@/hooks/use-booth-machine";
import type { CameraController } from "@/hooks/use-camera";
import { useGestureRecognizer } from "@/hooks/use-gesture-recognizer";
import { composePhotoLayout } from "@/services/render/layout-compositor.service";
import { renderPhotoOutput } from "@/services/render/render-photo-output";
import { createRenderConfig } from "@/services/render/render-config.builder";
import {
    saveSharePhoto,
    cleanupExpiredSharePhotos,
    scheduleSharePhotoCleanup,
} from "@/services/sharing/share-photo-storage.service";
import {
    MemoryPhotoBlobStorage,
    PhotoStorageService,
} from "@/services/storage/photo-storage.service";
import type { BoothSelection, CapturedPhoto, FrameConfig } from "@/types/theme";

function getContrastColor(hexColor: string): string {
    if (!hexColor || !hexColor.startsWith("#")) return "#ffffff";
    const cleanHex = hexColor.replace("#", "");
    if (cleanHex.length !== 6) return "#ffffff";
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? "#111111" : "#ffffff";
}

export type CustomizerAction =
    | {
        type: "sticker";
        id: string;
        sticker: string;
        x: number;
        y: number;
    }
    | {
        type: "text";
        id: string;
        text: string;
        x: number;
        y: number;
    }
    | {
        type: "stroke";
        id: string;
        color: string;
        width: number;
        points: readonly { x: number; y: number }[];
    };

const stickerOptions = ["✨", "💖", "🎉", "😎", "🌟", "🥳"] as const;
const penColors = ["#ffffff", "#f59e0b", "#34d399", "#60a5fa", "#f472b6"] as const;

export function createStickerCustomizationAction({
    sticker,
    id,
    x = 0.5,
    y = 0.5,
}: {
    sticker: string;
    id: string;
    x?: number;
    y?: number;
}): CustomizerAction {
    return {
        type: "sticker",
        id,
        sticker,
        x,
        y,
    };
}

export function createTextCustomizationAction({
    text,
    id,
    x = 0.5,
    y = 0.95,
}: {
    text: string;
    id: string;
    x?: number;
    y?: number;
}): CustomizerAction | null {
    const trimmedText = text.trim();

    if (!trimmedText) {
        return null;
    }

    return {
        type: "text",
        id,
        text: trimmedText.slice(0, 32),
        x,
        y,
    };
}

export function undoCustomizationAction(
    actions: readonly CustomizerAction[],
): CustomizerAction[] {
    return actions.slice(0, -1);
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

export function revokeCapturedPhotoUrls(
    capturedPhotos: readonly Pick<CapturedPhoto, "originalUrl" | "outputUrl">[],
    revokeObjectUrl: (url: string) => void = URL.revokeObjectURL,
): void {
    capturedPhotos.forEach((photo) => {
        revokeObjectUrl(photo.originalUrl);
        if (photo.outputUrl !== photo.originalUrl) {
            revokeObjectUrl(photo.outputUrl);
        }
    });
}

export function canChangeSetup(
    boothState: string,
    capturedPhotoCount: number,
): boolean {
    return (
        boothState !== "countdown" &&
        boothState !== "capturing" &&
        boothState !== "between-shots" &&
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

    const persistentDataUrl = await createShareDataUrl(outputBlob);

    if (saveSharePhotoRecord) {
        saveSharePhotoRecord({
            photoId,
            dataUrl: persistentDataUrl,
            mimeType:
                outputBlob.type ||
                savedOriginal.value.metadata.mimeType,
            savedAt: now(),
        });
    }

    return {
        id: photoId,
        sessionId,
        originalBlob: savedOriginal.value.original.blob,
        originalUrl,
        outputUrl,
        usedFallback,
    };
}

interface SaveFinalLayoutSharePhotoOptions {
    storage: Storage;
    sessionId: string;
    blob: Blob;
    now?: () => string;
}

export async function saveFinalLayoutSharePhoto({
    storage,
    sessionId,
    blob,
    now = () => new Date().toISOString(),
}: SaveFinalLayoutSharePhotoOptions): Promise<string> {
    const photoId = `${sessionId}-layout`;

    saveSharePhoto(storage, {
        photoId,
        dataUrl: await createBlobDataUrl(blob),
        mimeType: blob.type || "image/jpeg",
        savedAt: now(),
    });

    return photoId;
}

function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();

        image.addEventListener("load", () => {
            resolve(image);
        });
        image.addEventListener("error", () => {
            reject(new Error("Không thể đọc ảnh layout để customize."));
        });
        image.src = url;
    });
}

export async function renderCustomizedLayout(
    baseImageUrl: string,
    actions: readonly CustomizerAction[],
    options?: {
        layoutId?: string;
        textColor?: string;
        themeId?: string;
    },
): Promise<Blob> {
    const image = await loadImageFromUrl(baseImageUrl);
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;

    const context = canvas.getContext("2d");

    if (!context) {
        throw new Error("Không thể tạo canvas customize.");
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const layoutId = options?.layoutId || "2x2";
    const cellRects = getPhotoCellRects(layoutId, canvas.width, canvas.height);

    actions.forEach((action) => {
        if (action.type === "sticker") {
            context.save();
            context.font = `${Math.round(canvas.width * 0.08)}px sans-serif`;
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.fillText(
                action.sticker,
                action.x * canvas.width,
                action.y * canvas.height,
            );
            context.restore();
            return;
        }

        if (action.type === "text") {
            context.save();
            const fontFamily = options?.themeId === "party" ? "Georgia, serif" : "system-ui, sans-serif";
            const fontSize = Math.round(canvas.height * 0.032);
            context.font = `900 ${fontSize}px ${fontFamily}`;
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.fillStyle = options?.textColor || "#111827";
            const displayText = action.text.toUpperCase();
            context.fillText(
                displayText,
                action.x * canvas.width,
                action.y * canvas.height,
            );
            context.restore();
            return;
        }

        if (action.points.length < 2) {
            return;
        }

        context.save();
        // Clip canvas so strokes ONLY draw on frame border / margin and NEVER inside photo cells
        context.beginPath();
        context.rect(0, 0, canvas.width, canvas.height);
        cellRects.forEach((r) => {
            context.rect(r.x, r.y, r.width, r.height);
        });
        context.clip("evenodd");

        context.strokeStyle = action.color;
        context.lineWidth = Math.max(4, action.width * canvas.width);
        context.lineCap = "round";
        context.lineJoin = "round";
        context.beginPath();
        context.moveTo(
            action.points[0].x * canvas.width,
            action.points[0].y * canvas.height,
        );
        action.points.slice(1).forEach((point) => {
            context.lineTo(
                point.x * canvas.width,
                point.y * canvas.height,
            );
        });
        context.stroke();
        context.restore();
    });

    return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (!blob) {
                    reject(new Error("Không thể xuất ảnh đã customize."));
                    return;
                }

                resolve(blob);
            },
            "image/jpeg",
            0.94,
        );
    });
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
    selection?: BoothSelection;
    camera?: CameraController;
    onBackToSetup?: () => void;
}

export function CameraPreview({
    selection: propSelection,
    camera: propCamera,
    onBackToSetup,
}: CameraPreviewProps) {
    const context = useContext(BoothSessionContext);
    const selection = propSelection || context?.selection || defaultBoothSelection;
    const setSelection = context?.setSelection || (() => {});
    const camera = propCamera || context?.camera;

    const [localCapturedPhotos, setLocalCapturedPhotos] = useState<CapturedPhoto[]>([]);
    const capturedPhotos = context?.capturedPhotos || localCapturedPhotos;
    const setCapturedPhotos = context?.setCapturedPhotos || setLocalCapturedPhotos;
    const phase = context?.phase || "capture";
    const setPhase = context?.setPhase || (() => {});

    // Decoupled editor handles customize and result views. camera-preview serves strictly as a CaptureOverlay.

    const selectedTheme = resolveThemeConfig(selection.themeId);
    const resolvedFrame = resolveFrameConfig(selection.frameId);
    const currentFrame = useMemo(() => {
        return selection.frameColor && selection.frameId !== "none"
            ? { ...resolvedFrame, borderColor: selection.frameColor }
            : resolvedFrame;
    }, [resolvedFrame, selection.frameColor, selection.frameId]);
    const selectedStyle = resolveStyleConfig(selection.styleId);
    const selectedLayout = resolveBoothLayoutConfig(selection.layoutId);

    const videoRef =
        useRef<HTMLVideoElement>(null);

    const hasAutoConnectedRef =
        useRef(false);

    const retakeLockedRef = useRef(false);
    const retakeAwaitingReleaseRef =
        useRef(false);

    const photoUrlRef =
        useRef<string | null>(null);

    const finalLayoutUrlRef =
        useRef<string | null>(null);

    const customizedLayoutUrlRef =
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
    } = camera || {
        adapter: {
            connect: async () => true,
            disconnect: () => {},
            getStream: () => null,
            capture: async () => new Blob(),
        },
        stream: null,
        devices: [],
        error: null,
        status: "idle" as const,
        isConnecting: false,
        connect: async () => true,
        disconnect: () => {},
        loadDevices: async () => {},
    };

    const [
        selectedDeviceId,
        setSelectedDeviceId,
    ] = useState("");

    const [photoUrl, setPhotoUrl] =
        useState<string | null>(null);

    const [finalLayoutUrl, setFinalLayoutUrl] =
        useState<string | null>(null);

    const [layoutError, setLayoutError] =
        useState<string | null>(null);

    const [customizerActions, setCustomizerActions] =
        useState<CustomizerAction[]>(() => {
            const initialActions: CustomizerAction[] = [];
            if (selection.customization?.stickerItems) {
                selection.customization.stickerItems.forEach((st, idx) => {
                    const stickerObj = resolveStickerConfig(st.stickerId);
                    const emoji = stickerObj ? stickerObj.emoji : st.stickerId;
                    initialActions.push({
                        type: "sticker",
                        id: st.id || `setup-sticker-${idx}`,
                        sticker: emoji,
                        x: st.x ?? 0.5,
                        y: st.y ?? 0.5,
                    });
                });
            }
            if (selection.customization?.textLabels) {
                selection.customization.textLabels.forEach((tl, idx) => {
                    if (tl.text) {
                        initialActions.push({
                            type: "text",
                            id: tl.id || `setup-text-${idx}`,
                            text: tl.text,
                            x: tl.x ?? 0.5,
                            y: tl.y ?? 0.9,
                        });
                    }
                });
            }
            return initialActions;
        });

    const [selectedSticker, setSelectedSticker] =
        useState<(typeof stickerOptions)[number]>(() => {
            if (selection.stickerId && (stickerOptions as readonly string[]).includes(selection.stickerId)) {
                return selection.stickerId as (typeof stickerOptions)[number];
            }
            return stickerOptions[0];
        });
    const [customText, setCustomText] =
        useState(selection.textLabel || "MomentAI");
    const [penColor, setPenColor] =
        useState<string | null>(null);
    const [activeStroke, setActiveStroke] =
        useState<CustomizerAction | null>(null);
    const [customizedLayoutUrl, setCustomizedLayoutUrl] =
        useState<string | null>(null);
    const [customizerError, setCustomizerError] =
        useState<string | null>(null);

    const [captureError, setCaptureError] =
        useState<string | null>(null);

    useEffect(() => {
        if (stream && cameraStatus === "ready") {
            hasAutoConnectedRef.current = true;
            return;
        }

        if (!stream && cameraStatus !== "connecting" && cameraStatus !== "ready") {
            hasAutoConnectedRef.current = true;
            void connect();
        }
    }, [connect, stream, cameraStatus]);

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
        if (typeof window !== "undefined") {
            try {
                cleanupExpiredSharePhotos(window.localStorage, 120_000);
            } catch {
                // Ignore storage access errors
            }
        }

        return () => {
            revokeCapturedPhotoUrls(capturedPhotosRef.current);

            if (finalLayoutUrlRef.current) {
                URL.revokeObjectURL(finalLayoutUrlRef.current);
            }

            if (customizedLayoutUrlRef.current) {
                URL.revokeObjectURL(customizedLayoutUrlRef.current);
            }

            capturedPhotosRef.current = [];
            photoUrlRef.current = null;
            finalLayoutUrlRef.current = null;
            customizedLayoutUrlRef.current = null;
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
                            frame: currentFrame,
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
            currentFrame,
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
        totalShots: selectedLayout.shotCount,
        countdownSeconds: selection.countdownSeconds,
    });

    const boothState = booth.state;
    const boothCountdown = booth.countdown;
    const capturedShotCount = booth.capturedShotCount;
    const totalShots = booth.totalShots;
    const resetBooth = booth.reset;
    const captureManually = booth.captureManually;

    useEffect(() => {
        const video = videoRef.current;
        if (!video || !stream) return;
        if (video.srcObject !== stream) {
            video.srcObject = stream;
        }
        void video.play().catch(() => {});
    }, [stream, boothState, photoUrl]);

    useEffect(() => {
        if (boothState === "result") {
            if (onBackToSetup) {
                onBackToSetup();
            }
        }
    }, [boothState, onBackToSetup]);

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
            ? "unavailable"
            : gesture.isLoading
                ? "loading"
                : "active";

    const aiStatusLabel =
        aiStatus === "active"
            ? "Cử chỉ tay Sẵn sàng"
            : aiStatus === "loading"
                ? "Đang tải cử chỉ tay..."
                : aiStatus === "unavailable"
                    ? "Cử chỉ tay không khả dụng"
                    : "Cử chỉ tay đang tắt";

    const aiStatusDescription =
        aiStatus === "active"
            ? "Đưa tay ✋ để chuẩn bị, nắm tay ✊ để bắt đầu chụp."
            : "Chụp ảnh bằng cử chỉ tay không hoạt động; vui lòng chạm nút chụp thủ công.";

    const aiStatusClassName =
        aiStatus === "active"
            ? "border-emerald-400/30 bg-emerald-400/15 text-emerald-100"
            : aiStatus === "loading"
                ? "border-sky-400/30 bg-sky-400/15 text-sky-100"
                : aiStatus === "unavailable"
                    ? "border-amber-400/40 bg-amber-400/15 text-amber-100"
                    : "border-zinc-500/40 bg-zinc-700/60 text-zinc-100";

    const layoutGeometry = getLayoutGeometry(selectedLayout.id);
    const sheetAspectRatio = layoutGeometry.sheetAspectRatio;

    const bindStream = (el: HTMLVideoElement | null) => {
        if (!el) return;
        if (el.srcObject !== stream) {
            el.srcObject = stream;
            const playPromise = el.play();
            if (playPromise && typeof playPromise.catch === "function") {
                playPromise.catch((err) => {
                    if (err.name !== "AbortError") {
                        console.warn("Failed to play video in grid cell:", err);
                    }
                });
            }
        }
    };

    const getStyleFilter = (styleMode: string): string => {
        switch (styleMode) {
            case "grayscale":
                return "grayscale(1)";
            case "warm":
                return "sepia(0.28) saturate(1.2)";
            case "cool":
                return "saturate(1.05) hue-rotate(8deg)";
            case "contrast":
                return "contrast(1.18) saturate(1.05)";
            case "none":
            default:
                return "none";
        }
    };

    const styleFilter = getStyleFilter(selectedStyle.mode);

    const handleRetake = useCallback(
        async (reconnectCamera = false) => {
            setCaptureError(null);
            await performRetake({
                reconnectCamera,
                selectedDeviceId,
                connect,
                clearPhoto: () => {
                    revokeCapturedPhotoUrls(capturedPhotosRef.current);

                    if (finalLayoutUrlRef.current) {
                        URL.revokeObjectURL(finalLayoutUrlRef.current);
                    }

                    if (customizedLayoutUrlRef.current) {
                        URL.revokeObjectURL(customizedLayoutUrlRef.current);
                    }

                    capturedPhotosRef.current = [];
                    photoUrlRef.current = null;
                    finalLayoutUrlRef.current = null;
                    customizedLayoutUrlRef.current = null;
                    setCapturedPhotos([]);
                    setPhotoUrl(null);
                    setFinalLayoutUrl(null);
                    setCustomizedLayoutUrl(null);
                    setCustomizerActions([]);
                    setActiveStroke(null);
                    setLayoutError(null);
                    setCustomizerError(null);
                    setSelection(defaultBoothSelection);
                },
                reset: resetBooth,
            });
        },
        [
            resetBooth,
            connect,
            selectedDeviceId,
            currentFrame,
        ],
    );

    useEffect(() => {
        if (
            boothState !== "result" ||
            capturedPhotos.length < totalShots
        ) {
            return;
        }

        let cancelled = false;

        const composeLayout = async () => {
            const photoStorage = photoStorageRef.current;

            if (!photoStorage) {
                return;
            }

            try {
                setLayoutError(null);

                const orderedPhotos = capturedPhotos
                    .slice(0, totalShots)
                    .reverse();
                const renderedSources = orderedPhotos.map((photo) => ({
                    photoId: photo.id,
                    blob: photo.originalBlob,
                }));
                const renderConfig = createRenderConfig({
                    selection,
                    capturedPhotos: orderedPhotos,
                });

                if (cancelled) {
                    return;
                }

                const layoutOutput = await composePhotoLayout({
                    renderConfig,
                    sources: renderedSources,
                });

                if (cancelled) {
                    return;
                }

                const layoutUrlResult =
                    photoStorage.createObjectUrl(
                        layoutOutput.blob,
                    );

                if (!layoutUrlResult.ok) {
                    throw new Error(
                        layoutUrlResult.error.message,
                    );
                }

                if (finalLayoutUrlRef.current) {
                    URL.revokeObjectURL(
                        finalLayoutUrlRef.current,
                    );
                }

                finalLayoutUrlRef.current =
                    layoutUrlResult.value;

                try {
                    if (
                        typeof window !== "undefined" &&
                        captureSessionIdRef.current
                    ) {
                        const sessionId = captureSessionIdRef.current;
                        await saveFinalLayoutSharePhoto({
                            storage: window.localStorage,
                            sessionId,
                            blob: layoutOutput.blob,
                        });
                        scheduleSharePhotoCleanup(window.localStorage, sessionId, 120_000);
                    }
                } catch (shareErr) {
                    console.warn("[CameraPreview] Share photo storage skipped (QuotaExceededError):", shareErr);
                }

                setFinalLayoutUrl(layoutUrlResult.value);
                setPhotoUrl(layoutUrlResult.value);
                photoUrlRef.current = layoutUrlResult.value;
            } catch (cause) {
                if (cancelled) {
                    return;
                }

                const message =
                    cause instanceof Error
                        ? cause.message
                        : "Không thể ghép layout.";
                setLayoutError(message);
                console.warn("Layout composition failed:", message);
            }
        };

        void composeLayout();

        return () => {
            cancelled = true;
        };
    }, [
        boothState,
        capturedPhotos,
        selectedLayout.id,
        selection,
        totalShots,
    ]);

    useEffect(() => {
        if (!finalLayoutUrl) {
            return;
        }

        let cancelled = false;

        const renderCustomization = async () => {
            try {
                setCustomizerError(null);

                if (customizedLayoutUrlRef.current) {
                    URL.revokeObjectURL(customizedLayoutUrlRef.current);
                    customizedLayoutUrlRef.current = null;
                }

                setCustomizedLayoutUrl(null);

                const textColor = selection.frameColor && selection.frameId !== "none" ? "#111827" : selectedTheme.textColor;

                const customizedBlob = await renderCustomizedLayout(
                    finalLayoutUrl,
                    [],
                    {
                        layoutId: selectedLayout.id,
                        textColor,
                        themeId: selectedTheme.id,
                    },
                );
                const customizedUrl = URL.createObjectURL(customizedBlob);

                if (cancelled) {
                    URL.revokeObjectURL(customizedUrl);
                    return;
                }

                if (customizedLayoutUrlRef.current) {
                    URL.revokeObjectURL(customizedLayoutUrlRef.current);
                }

                customizedLayoutUrlRef.current = customizedUrl;
                setCustomizedLayoutUrl(customizedUrl);
            } catch (cause) {
                if (cancelled) {
                    return;
                }

                setCustomizerError(
                    cause instanceof Error
                        ? cause.message
                        : "Không thể áp dụng customize.",
                );
            }
        };

        void renderCustomization();

        return () => {
            cancelled = true;
        };
    }, [
        finalLayoutUrl,
        selectedLayout.id,
        selectedTheme.id,
        selectedTheme.textColor,
        selection.frameColor,
        selection.frameId,
    ]);

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

    const addSticker = (
        sticker: (typeof stickerOptions)[number],
        x = 0.5,
        y = 0.5,
    ) => {
        setCustomizerActions((currentActions) => [
            ...currentActions,
            createStickerCustomizationAction({
                sticker,
                id: crypto.randomUUID(),
                x,
                y,
            }),
        ]);
    };

    const addTextLabel = () => {
        const textAction = createTextCustomizationAction({
            text: customText,
            id: crypto.randomUUID(),
        });

        if (!textAction) {
            return;
        }

        setCustomizerActions((currentActions) => [
            ...currentActions,
            textAction,
        ]);
    };

    const getCanvasPoint = (event: PointerEvent<HTMLDivElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();

        return {
            x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
            y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
        };
    };

    const startDrawing = (event: PointerEvent<HTMLDivElement>) => {
        if (!finalLayoutUrl || !penColor) {
            return;
        }

        event.currentTarget.setPointerCapture(event.pointerId);
        const point = getCanvasPoint(event);
        setActiveStroke({
            type: "stroke",
            id: crypto.randomUUID(),
            color: penColor,
            width: 0.009,
            points: [point],
        });
    };

    const continueDrawing = (event: PointerEvent<HTMLDivElement>) => {
        if (!activeStroke || activeStroke.type !== "stroke") {
            return;
        }

        const point = getCanvasPoint(event);
        setActiveStroke({
            ...activeStroke,
            points: [...activeStroke.points, point],
        });
    };

    const finishDrawing = () => {
        if (
            activeStroke &&
            activeStroke.type === "stroke" &&
            activeStroke.points.length > 1
        ) {
            setCustomizerActions((currentActions) => [
                ...currentActions,
                activeStroke,
            ]);
        }

        setActiveStroke(null);
    };

    const undoCustomization = () => {
        setCustomizerActions((currentActions) =>
            undoCustomizationAction(currentActions),
        );
    };

    const clearCustomization = () => {
        setCustomizerActions([]);
        setActiveStroke(null);
    };

    const displayedFinalUrl = customizedLayoutUrl ?? finalLayoutUrl ?? photoUrl ?? "";

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



    return (
        <section className="mx-auto flex w-full max-w-6xl flex-col gap-4">
            
            <div className="relative flex-1 min-h-0 flex items-center justify-center overflow-hidden bg-neutral-900/40 rounded-3xl border border-white/10 h-[72vh] max-h-[72vh] w-full p-2">
                {/* Main live camera stream view */}
                <video
                    ref={videoRef}
                    className={`w-full h-full object-cover rounded-2xl -scale-x-100 transition-opacity duration-300 ${
                        stream && cameraStatus === "ready" ? "opacity-100" : "opacity-0"
                    }`}
                    style={{ filter: getStyleFilter(selectedStyle.mode) }}
                    muted
                    autoPlay
                    playsInline
                />

                {(!stream || cameraStatus !== "ready") && (
                    <LoadingLayer cameraStatus={cameraStatus} onRetry={() => void connect()} />
                )}

                {/* Overlays positioned relative to the parent workspace wrapper */}
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
                            <div className="font-medium text-xs">
                                {gestureLabel}
                            </div>

                            <div className="text-[10px] opacity-80">
                                {Math.round(
                                    gesture.result.confidence *
                                    100,
                                )}
                                % confidence
                            </div>

                            <div className="mt-1.5 h-1.5 w-32 overflow-hidden rounded-full bg-black/30">
                                <div
                                    className="h-full bg-emerald-300 transition-[width]"
                                    style={{
                                        width: `${holdProgress}%`,
                                    }}
                                />
                            </div>
                        </div>
                    ) : (
                        <p className="mt-1 text-xs leading-relaxed opacity-90">
                            {aiStatusDescription}
                        </p>
                    )}

                    {aiStatus === "unavailable" && gesture.error ? (
                        <p className="mt-1 text-[10px] leading-relaxed text-amber-50/80">
                            {gesture.error}
                        </p>
                    ) : null}
                </div>

                <div className="absolute right-5 top-5 space-y-2 text-right">
                    <div className="rounded-xl bg-black/70 px-4 py-2 text-xs">
                        Trạng thái: {boothState.toUpperCase()}
                    </div>
                    <div className="rounded-xl bg-emerald-400/90 px-4 py-2 font-semibold text-black text-xs">
                        Ảnh {Math.min(capturedShotCount + 1, totalShots)}/{totalShots}
                    </div>
                </div>

                {boothCountdown !== null ? (
                    <div className="absolute inset-0 grid place-items-center bg-black/60 backdrop-blur-sm z-30 transition-all duration-300">
                        <div className="flex flex-col items-center justify-center">
                            <span className="text-[14rem] font-black leading-none text-white drop-shadow-[0_0_60px_rgba(16,185,129,0.9)] animate-bounce">
                                {boothCountdown}
                            </span>
                            <span className="mt-4 text-2xl font-bold tracking-widest text-emerald-400 uppercase">
                                📸 Chuẩn bị tạo dáng!
                            </span>
                        </div>
                    </div>
                ) : null}

                {boothState === "between-shots" ? (
                    <div className="absolute inset-0 grid place-items-center bg-black/45 text-center z-10">
                        <div className="rounded-3xl bg-white px-8 py-6 text-black shadow-2xl">
                            <p className="text-xl font-medium font-bold">
                                Giữ nguyên nụ cười nhé
                            </p>
                            <p className="mt-2 text-4xl font-black">
                                Chuẩn bị ảnh {capturedShotCount + 1}/{totalShots}
                            </p>
                        </div>
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
                            boothState === "capturing" ||
                            boothState === "between-shots"
                        }
                        className="rounded-xl border px-5 py-3 disabled:opacity-40"
                        onClick={
                            captureManually
                        }
                    >
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
