"use client";

import React, { useContext, useEffect, useRef, useState } from "react";

import { BoothSessionContext } from "@/components/booth/booth-session-context";
import { SetupStepShell } from "@/components/wizard/setup-step-shell";
import {
    resolveBoothLayoutConfig,
    resolveDefaultLayoutIdForShotCount,
    supportedShotCounts,
    type BoothShotCount,
} from "@/config/layout.config";
import {
    defaultBoothSelection,
    isBoothSelectionComplete,
} from "@/config/theme.config";
import type { CameraController } from "@/hooks/use-camera";
import type { CameraStatus } from "@/types/camera";
import type { BoothSelection } from "@/types/theme";

const SETUP_STEPS = [
    { id: "shots", title: "📸 Chọn số lượng shots", shortLabel: "Shots" },
];

interface BoothSelectionFlowProps {
    selection?: BoothSelection;
    camera?: CameraController;
    onSelectionChange?: (selection: BoothSelection) => void;
    onComplete: () => void;
}

function getShotCountFromSelection(selection: BoothSelection): BoothShotCount {
    const layout = resolveBoothLayoutConfig(selection.layoutId);
    return supportedShotCounts.includes(layout.shotCount as BoothShotCount)
        ? layout.shotCount as BoothShotCount
        : 1;
}

function buildShotCountSelection(
    selection: BoothSelection,
    shotCount: BoothShotCount,
): BoothSelection {
    return {
        ...selection,
        layoutId: resolveDefaultLayoutIdForShotCount(shotCount),
        countdownSeconds: 8,
        frameId: "white-border",
        frameColor: undefined,
        styleId: "none",
        customization: {
            stickerItems: [],
            textLabels: [],
            drawingStrokes: selection.customization.drawingStrokes ?? [],
            overlays: selection.customization.overlays?.filter((item) => item.type === "drawing") ?? [],
        },
    };
}

const cameraStatusCopy: Record<CameraStatus, { label: string; detail: string; tone: string }> = {
    idle: {
        label: "Cần bật camera",
        detail: "Nhấn thử lại để trình duyệt hỏi quyền camera trước khi bắt đầu.",
        tone: "bg-amber-400 text-amber-950",
    },
    "requesting-permission": {
        label: "Đang xin quyền camera",
        detail: "Chọn Allow/Cho phép trên trình duyệt để hiện live preview.",
        tone: "bg-sky-400 text-sky-950",
    },
    connecting: {
        label: "Đang kết nối camera",
        detail: "CameraOS đang mở thiết bị preview. Vui lòng chờ trong giây lát.",
        tone: "bg-sky-400 text-sky-950",
    },
    initializing: {
        label: "Đang khởi tạo preview",
        detail: "Đang kiểm tra luồng hình ảnh và chuẩn bị capture.",
        tone: "bg-violet-400 text-violet-950",
    },
    ready: {
        label: "Camera sẵn sàng",
        detail: "Live preview đang hoạt động. Có thể bắt đầu phiên chụp.",
        tone: "bg-emerald-400 text-emerald-950",
    },
    disconnected: {
        label: "Camera bị ngắt",
        detail: "Kiểm tra cáp/capture card, đóng app đang dùng camera rồi thử lại.",
        tone: "bg-orange-400 text-orange-950",
    },
    error: {
        label: "Không mở được camera",
        detail: "Cho phép camera trong trình duyệt hoặc kiểm tra thiết bị đang bị app khác chiếm dụng.",
        tone: "bg-rose-400 text-rose-950",
    },
};

function SetupCameraViewport({
    camera,
}: {
    camera?: CameraController;
}) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const stream = camera?.stream ?? null;
    const status = camera?.status ?? "idle";
    const error = camera?.error ?? null;
    const isCameraReady = status === "ready" && !!stream;
    const isRecoverableCameraState = status === "idle" || status === "error" || status === "disconnected";
    const statusCopy = cameraStatusCopy[status];

    useEffect(() => {
        if (!stream && camera?.connect && status === "idle") {
            void camera.connect();
        }
    }, [camera, status, stream]);

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
            void videoRef.current.play?.();
        }
    }, [stream]);

    return (
        <section
            className="relative h-full w-full overflow-hidden rounded-[1.75rem] bg-neutral-950 text-white shadow-2xl shadow-pink-950/30"
            aria-label="Camera setup viewport"
        >
            {stream ? (
                <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="h-full w-full object-cover -scale-x-100"
                    aria-label="Live camera preview"
                />
            ) : (
                <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_30%_20%,rgba(244,114,182,0.25),transparent_34%),linear-gradient(145deg,#111827_0%,#2e1065_58%,#0f172a_100%)]">
                    <div className="grid place-items-center gap-4 text-center px-8">
                        <div className="grid h-24 w-24 place-items-center rounded-full bg-white/12 text-5xl ring-1 ring-white/20">
                            📷
                        </div>
                        <p className="text-2xl font-black">
                            Static setup preview
                        </p>
                        <p className="max-w-md text-sm font-semibold leading-relaxed text-white/70">
                            Không có live preview nhưng vẫn có thể chọn số ảnh. Capture sẽ bị khóa cho tới khi camera sẵn sàng.
                        </p>
                    </div>
                </div>
            )}

            <div className="absolute inset-x-4 bottom-4 rounded-[1.35rem] border border-white/15 bg-black/62 p-4 shadow-2xl backdrop-blur-xl">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                        <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] ${statusCopy.tone}`}>
                            {statusCopy.label}
                        </span>
                        <p className="max-w-xl text-sm font-semibold leading-relaxed text-white/82">
                            {error || statusCopy.detail}
                        </p>
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-200/90">
                            Touch capture fallback luôn sẵn sàng khi camera ready · AI gesture bật ở màn capture, không chạy inference trong setup
                        </p>
                    </div>
                    {isRecoverableCameraState && camera?.connect && (
                        <button
                            type="button"
                            onClick={() => void camera.connect()}
                            className="min-h-12 rounded-2xl border border-white/20 bg-white px-5 py-3 text-sm font-black text-neutral-950 shadow-lg shadow-white/10 transition active:scale-95"
                        >
                            Thử lại camera
                        </button>
                    )}
                </div>
                {!isCameraReady && (
                    <div className="mt-3 rounded-2xl border border-amber-300/30 bg-amber-300/12 px-4 py-3 text-sm font-bold text-amber-100">
                        Bắt đầu chụp đang khóa để tránh phiên lỗi. Hãy cho phép camera hoặc thử kết nối lại.
                    </div>
                )}
            </div>
        </section>
    );
}

export function BoothSelectionFlow({
    selection: propSelection,
    camera: propCamera,
    onSelectionChange: propOnSelectionChange,
    onComplete,
}: BoothSelectionFlowProps) {
    const context = useContext(BoothSessionContext);
    const selection = propSelection || context?.selection || defaultBoothSelection;
    const setSelection = propOnSelectionChange || context?.setSelection || (() => {});
    const camera = propCamera || context?.camera;
    const [localActiveStep, setLocalActiveStep] = useState("shots");
    const activeStep = context?.activeStep || localActiveStep;
    const safeActiveStep = SETUP_STEPS.some((step) => step.id === activeStep)
        ? activeStep
        : "shots";
    const setActiveStep = context?.setActiveStep || setLocalActiveStep;
    const selectedShotCount = getShotCountFromSelection(selection);
    const selectedLayout = resolveBoothLayoutConfig(selection.layoutId);
    const cameraReady = camera?.status === "ready" && !!camera.stream;

    return (
        <SetupStepShell
            steps={SETUP_STEPS}
            activeStep={safeActiveStep}
            onStepChange={setActiveStep}
            onComplete={onComplete}
            completeLabel="Bắt đầu chụp"
            canContinue={isBoothSelectionComplete(selection) && cameraReady}
            headerSlot={
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-tr from-pink-500 to-purple-500 text-xl font-black text-white shadow-lg shadow-pink-300/50">
                            📸
                        </div>
                        <div className="space-y-0.5">
                            <p className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-pink-600">
                                PhotoBoothAI · Shot setup
                            </p>
                            <h1 className="text-xl font-black tracking-tight text-pink-950">
                                Chọn số ảnh, chọn frame sau khi chụp
                            </h1>
                        </div>
                    </div>
                    <p className="rounded-full border border-pink-200/80 bg-white/75 px-4 py-2 text-xs font-extrabold text-pink-900 shadow-sm">
                        Countdown cố định 8s / ảnh
                    </p>
                </div>
            }
            previewSlot={<SetupCameraViewport camera={camera} />}
        >
            <div className={safeActiveStep === "shots" ? "space-y-5" : "hidden"}>
                <fieldset className="space-y-3">
                    <legend className="text-base font-extrabold text-pink-950">
                        Số lượng shots
                    </legend>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {supportedShotCounts.map((shotCount) => {
                            const selected = selectedShotCount === shotCount;
                            const layoutId = resolveDefaultLayoutIdForShotCount(shotCount);
                            const layout = resolveBoothLayoutConfig(layoutId);

                            return (
                                <button
                                    key={shotCount}
                                    type="button"
                                    aria-label={`${shotCount} shots`}
                                    aria-pressed={selected}
                                    onClick={() => {
                                        setSelection(buildShotCountSelection(selection, shotCount));
                                    }}
                                    className={`min-h-28 rounded-3xl border p-4 text-left transition duration-300 active:scale-[0.98] ${
                                        selected
                                            ? "border-pink-500 bg-pink-500/15 text-pink-950 shadow-lg shadow-pink-200/60 ring-2 ring-pink-400/40"
                                            : "border-pink-200/70 bg-white/75 text-neutral-800 shadow-sm hover:border-pink-300 hover:bg-white"
                                    }`}
                                >
                                    <span className="block text-4xl font-black leading-none text-pink-950">
                                        {shotCount}
                                    </span>
                                    <span className="mt-2 block text-xs font-black uppercase tracking-[0.18em] text-pink-600">
                                        shots
                                    </span>
                                    <span className="mt-2 block text-xs font-semibold leading-snug text-pink-900/70">
                                        {layout.name}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </fieldset>

                <div className="rounded-3xl border border-pink-200/70 bg-white/75 p-4 shadow-sm backdrop-blur-md">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.28em] text-pink-600">
                        Sau khi chụp
                    </p>
                    <h3 className="mt-2 text-xl font-black text-pink-950">
                        {selectedLayout.shotCount} ảnh · {selectedLayout.name}
                    </h3>
                    <p className="mt-2 text-sm font-medium leading-relaxed text-pink-900/75">
                        Frame chọn sau khi chụp.
                    </p>
                </div>
            </div>
        </SetupStepShell>
    );
}
