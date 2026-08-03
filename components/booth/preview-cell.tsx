"use client";

import React, { useState, useEffect } from "react";
import type { ThemeConfig, FrameConfig, StyleConfig } from "@/types/theme";

// Helper function to resolve filter style matching the compositor
export function getStyleFilter(styleMode: string): string {
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

export function ThemeLayer({ theme, children }: { theme: ThemeConfig; children: React.ReactNode }) {
    return (
        <div className="w-full h-full" style={{ backgroundColor: theme.backgroundColor }}>
            {children}
        </div>
    );
}

export function LiveVideoLayer({
    stream,
    styleFilter,
    cameraStatus,
}: {
    stream: MediaStream | null;
    styleFilter: string;
    cameraStatus: string;
}) {
    const videoRef = React.useRef<HTMLVideoElement | null>(null);

    React.useEffect(() => {
        const video = videoRef.current;
        console.log("[LiveVideoLayer] rendering. stream:", stream?.id, "cameraStatus:", cameraStatus);
        if (!video || !stream) {
            console.log("[LiveVideoLayer] Skipping video attach - video or stream missing. video:", !!video, "stream:", !!stream);
            return;
        }

        let cancelled = false;
        if (video.srcObject !== stream) {
            console.log("[LiveVideoLayer] Attaching stream to video.srcObject:", stream.id);
            video.srcObject = stream;
        }

        const startVideo = async () => {
            try {
                await video.play();
                console.log("[LiveVideoLayer] video.play() SUCCESS! videoWidth:", video.videoWidth, "videoHeight:", video.videoHeight);
            } catch (err) {
                const isAbort = err instanceof DOMException && err.name === "AbortError";
                if (!cancelled && !isAbort) {
                    console.warn("[LiveVideoLayer] Failed to play video in cell:", err);
                }
            }
        };

        void startVideo();

        return () => {
            cancelled = true;
            if (video && video.srcObject === stream) {
                video.pause();
                video.srcObject = null;
            }
        };
    }, [stream]);

    return (
        <video
            ref={videoRef}
            className={`w-full h-full object-cover -scale-x-100 transition-opacity duration-500 ${
                stream && cameraStatus === "ready" ? "opacity-100" : "opacity-0"
            }`}
            style={{ filter: styleFilter }}
            muted
            autoPlay
            playsInline
        />
    );
}

export function LoadingLayer({ cameraStatus, onRetry }: { cameraStatus: string; onRetry?: () => void }) {
    const [showTip, setShowTip] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setShowTip(true);
        }, 3000);
        return () => clearTimeout(timer);
    }, [cameraStatus]);

    const isCameraRelated =
        cameraStatus === "requesting-permission" ||
        cameraStatus === "connecting" ||
        cameraStatus === "initializing" ||
        cameraStatus === "error";

    return (
        <div className="absolute inset-0 bg-neutral-900 flex flex-col items-center justify-center text-center p-4 z-10">
            <div className="w-5 h-5 border-2 border-neutral-700 border-t-emerald-400 rounded-full animate-spin mb-2" />
            <span className="text-xs uppercase tracking-wider text-neutral-300 font-semibold select-none">
                {cameraStatus === "requesting-permission" ? "Vui lòng bấm 'Cho phép' Camera..." :
                 cameraStatus === "connecting" ? "Đang kết nối Camera..." :
                 cameraStatus === "initializing" ? "Đang khởi tạo Stream..." :
                 cameraStatus === "error" ? "Lỗi kết nối Camera" : "Đang tải ảnh..."}
            </span>
            
            {showTip && isCameraRelated && (
                <div className="mt-3 space-y-2 max-w-[220px]">
                    <p className="text-[11px] text-neutral-400 leading-relaxed select-none">
                        Nhớ nhấn <strong>&quot;Cho phép&quot; (Allow)</strong> trên trình duyệt và kiểm tra xem có ứng dụng khác (Zoom, FaceTime) đang dùng camera không.
                    </p>
                    {onRetry && (
                        <button
                            type="button"
                            onClick={onRetry}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-medium hover:bg-emerald-500/30 transition-all active:scale-95"
                        >
                            🔄 Thử kết nối lại
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

const SVG_SAMPLE_RAW = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800"><defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#fda4af"/><stop offset="50%" stop-color="#f472b6"/><stop offset="100%" stop-color="#c084fc"/></linearGradient><linearGradient id="avatar" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#ffffff" stop-opacity="0.95"/><stop offset="100%" stop-color="#fbcfe8" stop-opacity="0.85"/></linearGradient></defs><rect width="600" height="800" fill="url(#bg)"/><circle cx="120" cy="150" r="8" fill="#fff" opacity="0.6"/><circle cx="480" cy="220" r="12" fill="#fff" opacity="0.7"/><circle cx="500" cy="650" r="10" fill="#fff" opacity="0.5"/><circle cx="100" cy="600" r="6" fill="#fff" opacity="0.8"/><g transform="translate(300, 420)"><circle cx="0" cy="-90" r="75" fill="url(#avatar)"/><path d="M -120 120 C -120 10 -80 -10 0 -10 C 80 -10 120 10 120 120 Z" fill="url(#avatar)"/><path d="M -25 -75 Q 0 -50 25 -75" stroke="#ec4899" stroke-width="5" stroke-linecap="round" fill="none"/><circle cx="-25" cy="-100" r="7" fill="#831843"/><circle cx="25" cy="-100" r="7" fill="#831843"/><circle cx="-42" cy="-82" r="12" fill="#f43f5e" opacity="0.4"/><circle cx="42" cy="-82" r="12" fill="#f43f5e" opacity="0.4"/></g><text x="300" y="740" font-family="system-ui, sans-serif" font-size="24" font-weight="800" fill="#ffffff" text-anchor="middle" letter-spacing="2" opacity="0.95">PHOTOBOOTH DEMO 📸</text></svg>`;

const DEFAULT_SAMPLE_PHOTO = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(SVG_SAMPLE_RAW)}`;

interface PreviewCellProps {
    index: number;
    stream: MediaStream | null;
    cameraStatus: string;
    photoUrl?: string | null;
    theme: ThemeConfig;
    frame: FrameConfig;
    style: StyleConfig;
    onRetry?: () => void;
    showDemoFallback?: boolean;
}

export function PreviewCell({
    index,
    stream,
    cameraStatus,
    photoUrl,
    style,
    onRetry,
    showDemoFallback = true,
}: PreviewCellProps) {
    const styleFilter = getStyleFilter(style.mode);
    const [failedPhotoUrl, setFailedPhotoUrl] = useState<string | null>(null);

    const isLiveCameraMode = !!stream || cameraStatus === "connecting" || cameraStatus === "requesting-permission";
    const capturedPhotoFailed = !!photoUrl && failedPhotoUrl === photoUrl;
    const displayPhoto =
        (!capturedPhotoFailed && photoUrl)
            ? photoUrl
            : (!isLiveCameraMode && showDemoFallback && !capturedPhotoFailed ? DEFAULT_SAMPLE_PHOTO : null);

    return (
        <div
            className="relative overflow-hidden w-full h-full flex flex-col rounded-none transition-all duration-300"
            aria-label={`Grid cell ${index + 1}`}
        >
            {/* Main content slot */}
            <div className="relative flex-1 w-full h-full overflow-hidden rounded-none">
                {displayPhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={displayPhoto}
                        alt={`Captured cell ${index + 1}`}
                        className="w-full h-full object-cover transition-all duration-300"
                        style={{ filter: photoUrl && !capturedPhotoFailed ? "none" : styleFilter }}
                        onError={() => {
                            if (photoUrl) {
                                setFailedPhotoUrl(photoUrl);
                            }
                        }}
                        draggable={false}
                    />
                ) : (
                    <>
                        <LiveVideoLayer
                            stream={stream}
                            styleFilter={styleFilter}
                            cameraStatus={cameraStatus}
                        />
                        {(!stream || cameraStatus !== "ready") && (
                            <LoadingLayer cameraStatus={cameraStatus} onRetry={onRetry} />
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
