"use client";

import { useEffect, useRef } from "react";

import { resolveBoothLayoutConfig } from "@/config/layout.config";
import {
    resolveStickerConfig,
} from "@/config/sticker.config";
import {
    resolveFrameConfig,
    resolveStyleConfig,
    resolveThemeConfig,
} from "@/config/theme.config";
import type { CameraController } from "@/hooks/use-camera";
import type { BoothSelection } from "@/types/theme";

interface LiveSelectionPreviewProps {
    selection: BoothSelection;
    camera: CameraController;
}

function getStyleFilter(styleMode: string): string {
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
}

export function LiveSelectionPreview({
    selection,
    camera,
}: LiveSelectionPreviewProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const {
        stream,
        error,
        status,
        isConnecting,
        connect,
    } = camera;

    const layout = resolveBoothLayoutConfig(selection.layoutId);
    const theme = resolveThemeConfig(selection.themeId);
    const frame = resolveFrameConfig(selection.frameId);
    const style = resolveStyleConfig(selection.styleId);
    const styleFilter = getStyleFilter(style.mode);

    useEffect(() => {
        if (stream) {
            return;
        }

        void connect();
    }, [connect, stream]);

    useEffect(() => {
        const video = videoRef.current;

        if (!video || !stream) {
            return;
        }

        let cancelled = false;
        video.srcObject = stream;

        const play = async () => {
            try {
                await video.play();
            } catch (cause) {
                const wasInterrupted =
                    cause instanceof DOMException &&
                    cause.name === "AbortError";

                if (!cancelled && !wasInterrupted) {
                    console.warn(
                        "Không thể phát live preview setup:",
                        cause,
                    );
                }
            }
        };

        void play();

        return () => {
            cancelled = true;

            if (video.srcObject === stream) {
                video.pause();
                video.srcObject = null;
            }
        };
    }, [stream]);

    return (
        <section
            className="overflow-hidden rounded-3xl border border-white/10 bg-black shadow-2xl"
            aria-label="Realtime setup preview"
        >
            <div
                className="relative aspect-video overflow-hidden"
                style={{
                    backgroundColor: theme.backgroundColor,
                    color: theme.textColor,
                }}
            >
                <video
                    ref={videoRef}
                    className="absolute inset-0 h-full w-full -scale-x-100 object-cover opacity-70"
                    style={{ filter: styleFilter }}
                    muted
                    autoPlay
                    playsInline
                    aria-label="Live camera setup preview"
                />

                {!stream ? (
                    <div
                        className="absolute inset-0"
                        style={{
                            background: `radial-gradient(circle at 30% 20%, ${theme.accentColor}55, transparent 32%), linear-gradient(135deg, ${theme.backgroundColor}, #050505)`,
                            filter: styleFilter,
                        }}
                        aria-hidden="true"
                    />
                ) : null}

                <div className="absolute inset-0 p-8">
                    <div
                        className="grid h-full gap-3 rounded-[2rem] border-4 p-4 shadow-[inset_0_0_0_9999px_rgba(0,0,0,0.18)]"
                        style={{
                            borderColor:
                                frame.borderWidth > 0
                                    ? frame.borderColor
                                    : theme.accentColor,
                            gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))`,
                            gridTemplateRows: `repeat(${layout.rows}, minmax(0, 1fr))`,
                        }}
                        aria-label={`Layout preview ${layout.name}`}
                    >
                        {Array.from({ length: layout.shotCount }).map((_, index) => (
                            <div
                                key={index}
                                className="grid place-items-center rounded-2xl border border-white/45 bg-white/15 text-sm font-bold text-white shadow-inner backdrop-blur-[1px]"
                            >
                                {index + 1}
                            </div>
                        ))}
                    </div>
                </div>

                {selection.customization.stickerItems.map((item) => {
                    const sticker = resolveStickerConfig(item.stickerId);

                    return (
                        <div
                            key={item.id}
                            className="pointer-events-none absolute text-5xl drop-shadow-[0_4px_14px_rgba(0,0,0,0.55)]"
                            style={{
                                left: `${item.x * 100}%`,
                                top: `${item.y * 100}%`,
                                transform: `translate(-50%, -50%) scale(${item.scale}) rotate(${item.rotationDegrees}deg)`,
                            }}
                            aria-label={`Sticker preview ${sticker.name}`}
                        >
                            {sticker.emoji}
                        </div>
                    );
                })}

                {selection.customization.textLabels.map((label) => (
                    <div
                        key={label.id}
                        className="pointer-events-none absolute max-w-[80%] whitespace-nowrap rounded-full bg-black/55 px-5 py-2 text-center font-black uppercase tracking-wide text-white shadow-2xl"
                        style={{
                            left: `${label.x * 100}%`,
                            top: `${label.y * 100}%`,
                            color: label.color,
                            fontSize: `${Math.max(16, label.fontSize * 0.45)}px`,
                            transform: `translate(-50%, -50%) rotate(${label.rotationDegrees}deg)`,
                        }}
                    >
                        {label.text}
                    </div>
                ))}

                <div className="absolute left-4 top-4 max-w-[70%] rounded-2xl bg-black/72 px-4 py-3 text-sm text-white backdrop-blur">
                    <div className="font-semibold">
                        Realtime setup preview
                    </div>
                    <div className="text-neutral-200">
                        Layout: {layout.name} · {layout.shotCount} ảnh · Countdown: {selection.countdownSeconds}s
                    </div>
                    <div className="text-neutral-300">
                        Theme: {theme.name} · Khung: {frame.name} · Style: {style.name}
                    </div>
                    <div className="text-neutral-400">
                        Camera: {status.toUpperCase()}
                    </div>
                </div>

                {style.mode !== "none" ? (
                    <div className="absolute right-4 top-4 rounded-xl bg-white/90 px-3 py-2 text-xs font-semibold text-black">
                        Style preview: {style.name}
                    </div>
                ) : null}

                {frame.id !== "none" ? (
                    <div
                        className="pointer-events-none absolute bottom-0 left-0 right-0 px-5 py-3 text-center text-sm font-semibold"
                        style={{
                            backgroundColor: theme.backgroundColor,
                            color: theme.textColor,
                        }}
                    >
                        {frame.name}
                    </div>
                ) : null}

                {!stream ? (
                    <div className="absolute bottom-4 left-4 right-4 rounded-2xl border border-amber-300/30 bg-black/75 px-4 py-3 text-center text-sm text-amber-50 backdrop-blur">
                        {isConnecting
                            ? "Đang mở camera preview..."
                            : error ||
                              "Camera chưa sẵn sàng; preview tĩnh vẫn cho phép kiểm tra layout/theme/frame trước khi chụp."}
                    </div>
                ) : null}
            </div>
        </section>
    );
}
