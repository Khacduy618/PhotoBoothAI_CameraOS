"use client";

import { useEffect, useRef, useState } from "react";

import { BoothSelectionFlow } from "@/components/booth/booth-selection-flow";
import { BoothSessionProvider, useBoothSession } from "@/components/booth/booth-session-context";
import { CameraPreview } from "@/components/camera/camera-preview";
import { frameConfigs, resolveFrameConfig } from "@/config/frame.config";
import { resolveBoothLayoutConfig } from "@/config/layout.config";
import {
    defaultBoothSelection,
    normalizeBoothSelection,
} from "@/config/theme.config";
import { getFrameCompatibility } from "@/services/frame/frame-compatibility.service";
import { SessionService } from "@/services/session/session.service";
import {
    createSessionStorageService,
    type SessionStorageService,
} from "@/services/storage/session-storage.service";
import { EditingWorkspace } from "@/components/editor/EditingWorkspace";
import { composePhotoLayout } from "@/services/render/layout-compositor.service";
import { createRenderConfig } from "@/services/render/render-config.builder";
import { listLocalSessionPhotos } from "@/services/storage/local-media-client.service";
import type { BoothSession } from "@/types/session";
import type { BoothSelection, CapturedPhoto } from "@/types/theme";

type RestoreStatus = "loading" | "ready";

export function resolvePostCaptureDefaultFramePatch(
    selection: BoothSelection,
    capturedPhotoCount: number,
): Pick<BoothSelection, "frameId" | "frameColor"> | null {
    const layout = resolveBoothLayoutConfig(selection.layoutId);
    if (capturedPhotoCount < layout.shotCount) {
        return null;
    }

    const currentFrameConfig = resolveFrameConfig(selection.frameId);
    if (currentFrameConfig.shotCount === layout.shotCount) {
        return null;
    }

    const matchingFrame = frameConfigs.find(
        (frame) => getFrameCompatibility(frame, layout).compatible,
    );

    if (!matchingFrame) {
        return null;
    }

    return {
        frameId: matchingFrame.id,
        frameColor: matchingFrame.borderColor || "#ffffff",
    };
}

export function BoothExperience() {
    const [initialSelection, setInitialSelection] =
        useState<BoothSelection | null>(null);
    const [restoreStatus, setRestoreStatus] =
        useState<RestoreStatus>("loading");
    const [restoredSession, setRestoredSession] =
        useState<BoothSession | null>(null);
    const [initialCapturedPhotos, setInitialCapturedPhotos] =
        useState<CapturedPhoto[]>([]);
    const sessionStorageRef =
        useRef<SessionStorageService | null>(null);
    const sessionServiceRef =
        useRef<SessionService | null>(null);

    useEffect(() => {
        const storageResult = createSessionStorageService();

        if (!storageResult.ok) {
            void Promise.resolve().then(() => {
                setInitialSelection(defaultBoothSelection);
                setRestoreStatus("ready");
            });
            return;
        }

        sessionStorageRef.current = storageResult.value;
        sessionServiceRef.current = new SessionService(
            storageResult.value,
        );

        let cancelled = false;

        const restore = async () => {
            const activeSession =
                await storageResult.value.getActiveSession();

            if (cancelled) {
                return;
            }

            let loadedSelection = defaultBoothSelection;
            if (activeSession.ok && activeSession.value) {
                setRestoredSession(activeSession.value);
                const localPhotos = await listLocalSessionPhotos(activeSession.value.id);
                if (localPhotos.ok) {
                    setInitialCapturedPhotos(
                        localPhotos.value.map((photo) => ({
                            id: photo.photoId,
                            sessionId: photo.sessionId,
                            originalBlob: new Blob([], { type: photo.mimeType }),
                            originalUrl: photo.mediaUrl,
                            outputUrl: photo.mediaUrl,
                            mediaUrl: photo.mediaUrl,
                            storageKey: photo.storageKey,
                            width: photo.width,
                            height: photo.height,
                            expiresAt: photo.expiresAt,
                            usedFallback: false,
                        })),
                    );
                }
                if (activeSession.value.selection) {
                    loadedSelection = normalizeBoothSelection(
                        activeSession.value.selection,
                    );
                }
            }

            setInitialSelection(loadedSelection);
            setRestoreStatus("ready");
        };

        void restore();

        return () => {
            cancelled = true;
        };
    }, []);

    const abandonSession = async () => {
        if (restoredSession) {
            await sessionServiceRef.current?.abandonActiveSession();
        }
        setRestoredSession(null);
    };

    if (restoreStatus === "loading" || !initialSelection) {
        return (
            <section className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center gap-4 text-center">
                <h1 className="text-4xl font-semibold">
                    Đang khôi phục session...
                </h1>
                <p className="text-neutral-400">
                    PhotoBoothAI đang kiểm tra session đang hoạt động trên thiết bị này.
                </p>
            </section>
        );
    }

    return (
        <BoothSessionProvider
            initialSelection={initialSelection}
            initialCapturedPhotos={initialCapturedPhotos}
        >
            <BoothInnerExperience
                restoredSession={restoredSession}
                onAbandonSession={abandonSession}
            />
        </BoothSessionProvider>
    );
}

function BoothInnerExperience({
    restoredSession,
    onAbandonSession,
}: {
    restoredSession: BoothSession | null;
    onAbandonSession: () => Promise<void>;
}) {
    const {
        selection,
        updateSelection,
        selectionComplete,
        setSelectionComplete,
        capturedPhotos,
        setCapturedPhotos,
        camera,
        phase,
        setPhase,
        setActiveStep,
    } = useBoothSession();

    const [showRecovery, setShowRecovery] = useState(Boolean(restoredSession));
    const [isExporting, setIsExporting] = useState(false);
    const postCaptureDefaultFrameAppliedRef = useRef(false);

    useEffect(() => {
        if (phase === "setup" || phase === "capture") {
            postCaptureDefaultFrameAppliedRef.current = false;
            return;
        }

        if (postCaptureDefaultFrameAppliedRef.current || capturedPhotos.length === 0) {
            return;
        }

        const defaultFramePatch = resolvePostCaptureDefaultFramePatch(
            selection,
            capturedPhotos.length,
        );
        if (!defaultFramePatch) {
            postCaptureDefaultFrameAppliedRef.current = true;
            return;
        }

        postCaptureDefaultFrameAppliedRef.current = true;
        updateSelection(defaultFramePatch);
    }, [capturedPhotos.length, phase, selection, updateSelection]);

    const handleStartNew = async () => {
        await onAbandonSession();
        setShowRecovery(false);
        setSelectionComplete(false);
        setPhase("setup");
    };

    const handleContinue = () => {
        setShowRecovery(false);
        if (!camera.stream || camera.status !== "ready") {
            void camera.connect();
        }
        setSelectionComplete(true);
        setPhase("capture");
    };

    const handleStartCapture = () => {
        if (!camera.stream || camera.status !== "ready") {
            void camera.connect();
        }
        setSelectionComplete(true);
        setPhase("capture");
    };

    const handleExportPhoto = async () => {
        if (isExporting) return;
        setIsExporting(true);
        try {
            const chronologicalPhotos = capturedPhotos.slice().reverse();
            const sources = await Promise.all(
                chronologicalPhotos.map(async (p) => {
                    if (p.originalBlob.size > 0) {
                        return { photoId: p.id, blob: p.originalBlob };
                    }

                    const response = await fetch(p.mediaUrl || p.originalUrl);
                    if (!response.ok) {
                        throw new Error("Không thể tải ảnh gốc đã lưu để xuất file.");
                    }

                    return { photoId: p.id, blob: await response.blob() };
                }),
            );
            const result = await composePhotoLayout({
                sources: sources.length > 0 ? sources : [],
                renderConfig: createRenderConfig(selection),
            });
            const downloadUrl = URL.createObjectURL(result.blob);
            const a = document.createElement("a");
            a.href = downloadUrl;
            a.download = `photoboothai-customized-${Date.now()}.jpg`;
            a.click();
            URL.revokeObjectURL(downloadUrl);
        } catch (err) {
            console.error("Lỗi xuất ảnh:", err);
        } finally {
            setIsExporting(false);
        }
    };

    const handleRetake = () => {
        setCapturedPhotos([]);
        updateSelection(defaultBoothSelection);
        setSelectionComplete(false);
        setActiveStep("layout");
        setPhase("setup");
    };

    if (showRecovery && restoredSession) {
        return (
            <section className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center gap-8 text-center">
                <div className="space-y-4">
                    <p className="text-sm uppercase tracking-[0.3em] text-amber-300">
                        Session recovery
                    </p>
                    <h1 className="text-5xl font-bold">
                        Tiếp tục phiên chụp trước?
                    </h1>
                    <p className="text-lg leading-relaxed text-neutral-400">
                        Tìm thấy session đang hoạt động với {restoredSession.photoIds.length} ảnh đã liên kết. Bạn có thể tiếp tục hoặc bắt đầu session mới.
                    </p>
                </div>

                <div className="flex flex-col gap-4 sm:flex-row">
                    <button
                        type="button"
                        className="rounded-full bg-white px-8 py-5 text-xl font-semibold text-black"
                        onClick={handleContinue}
                    >
                        Tiếp tục
                    </button>
                    <button
                        type="button"
                        className="rounded-full border border-white/30 px-8 py-5 text-xl font-semibold"
                        onClick={handleStartNew}
                    >
                        Bắt đầu mới
                    </button>
                </div>
            </section>
        );
    }

    if (!selectionComplete) {
        return (
            <BoothSelectionFlow
                selection={selection}
                camera={camera}
                onComplete={handleStartCapture}
            />
        );
    }

    return (
        <div className="relative w-full h-full min-h-screen">
            {/* Post-capture EditingWorkspace Shell. Hidden during active capture so frame tools appear only after capture. */}
            {phase !== "capture" && (
                <EditingWorkspace
                    selection={selection}
                    updateSelection={updateSelection}
                    capturedPhotos={capturedPhotos}
                    onStartCapture={handleStartCapture}
                    onExportPhoto={() => {
                        void handleExportPhoto();
                    }}
                    onRetake={handleRetake}
                    isExporting={isExporting}
                />
            )}

            {/* Temporary Sibling CaptureOverlay during active camera capture */}
            {phase === "capture" && (
                <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-4">
                    <CameraPreview
                        selection={selection}
                        camera={camera}
                        onBackToSetup={() => {
                            if (capturedPhotos.length > 0) {
                                setPhase("customize");
                            } else {
                                setSelectionComplete(false);
                                setPhase("setup");
                            }
                        }}
                    />
                </div>
            )}
        </div>
    );
}
