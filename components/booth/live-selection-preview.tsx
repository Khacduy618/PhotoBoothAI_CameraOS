"use client";

import { useEffect, useRef } from "react";

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

    const theme = resolveThemeConfig(selection.themeId);
    const frame = resolveFrameConfig(selection.frameId);
    const style = resolveStyleConfig(selection.styleId);

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

        video.srcObject = stream;

        const play = async () => {
            try {
                await video.play();
            } catch (cause) {
                console.warn(
                    "Không thể phát live preview setup:",
                    cause,
                );
            }
        };

        void play();

        return () => {
            video.pause();
            video.srcObject = null;
        };
    }, [stream]);

    return (
        <section className="overflow-hidden rounded-3xl border border-white/10 bg-black">
            <div className="relative aspect-video">
                <video
                    ref={videoRef}
                    className="h-full w-full -scale-x-100 object-cover"
                    muted
                    autoPlay
                    playsInline
                    aria-label="Live camera setup preview"
                />

                <div
                    className="pointer-events-none absolute inset-0 border-[18px]"
                    style={{
                        borderColor:
                            frame.borderWidth > 0
                                ? frame.borderColor
                                : theme.accentColor,
                        boxShadow: `inset 0 0 0 9999px ${theme.backgroundColor}10`,
                    }}
                    aria-hidden="true"
                />

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

                <div className="absolute left-4 top-4 rounded-2xl bg-black/70 px-4 py-3 text-sm backdrop-blur">
                    <div className="font-semibold text-white">
                        Live setup preview
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

                {!stream ? (
                    <div className="absolute inset-0 grid place-items-center bg-black/70 px-6 text-center text-sm text-white">
                        <div>
                            {isConnecting
                                ? "Đang mở camera preview..."
                                : error ||
                                  "Camera preview chưa sẵn sàng. Vui lòng kiểm tra quyền camera."}
                        </div>
                    </div>
                ) : null}
            </div>
        </section>
    );
}
