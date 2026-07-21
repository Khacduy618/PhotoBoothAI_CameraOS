"use client";

import React from "react";
import { PreviewCell } from "@/components/booth/preview-cell";
import { resolveBoothLayoutConfig } from "@/config/layout.config";
import { resolveStickerConfig } from "@/config/sticker.config";
import {
    resolveFrameConfig,
    resolveStyleConfig,
    resolveThemeConfig,
} from "@/config/theme.config";
import { getLayoutGeometry } from "@/services/layout/layout-engine";
import type { BoothSelection, CapturedPhoto } from "@/types/theme";

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

interface PreviewRendererProps {
    selection: BoothSelection;
    stream: MediaStream | null;
    cameraStatus: string;
    capturedPhotos?: CapturedPhoto[];
    showMetadata?: boolean;
    onSelectionChange?: (selection: BoothSelection) => void;
    onRetry?: () => void;
}

export function PreviewRenderer({
    selection,
    stream,
    cameraStatus,
    capturedPhotos = [],
    showMetadata = true,
    onSelectionChange,
    onRetry,
}: PreviewRendererProps) {
    const layout = resolveBoothLayoutConfig(selection.layoutId);
    const theme = resolveThemeConfig(selection.themeId);
    const resolvedFrame = resolveFrameConfig(selection.frameId);
    const frame = selection.frameColor && selection.frameId !== "none"
        ? { ...resolvedFrame, borderColor: selection.frameColor }
        : resolvedFrame;
    const style = resolveStyleConfig(selection.styleId);
    const geometry = getLayoutGeometry(selection.layoutId);

    // Derive aspect ratio dynamically from the layout engine
    const sheetAspectRatio = geometry.sheetAspectRatio;

    // Reverse chronological order for captured photos
    const chronological = [...capturedPhotos].reverse();

    const selectionRef = React.useRef(selection);
    React.useEffect(() => {
        selectionRef.current = selection;
    }, [selection]);

    const handleDragStart = (
        e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>,
        itemId: string,
        type: "sticker" | "text",
    ) => {
        if (!onSelectionChange) return;
        e.preventDefault();

        const sheetEl = e.currentTarget.parentElement;
        if (!sheetEl) return;

        const rect = sheetEl.getBoundingClientRect();
        const isTouch = "touches" in e;

        // For pinch-to-zoom + rotation on touch
        let prevTouchDist: number | null = null;
        let prevTouchAngle: number | null = null;
        let initialScale = 1;
        let initialRotation = 0;

        // Get initial scale/rotation from current item
        const currentSel = selectionRef.current;
        if (type === "sticker") {
            const item = currentSel.customization.stickerItems.find((s) => s.id === itemId);
            if (item) { initialScale = item.scale; initialRotation = item.rotationDegrees; }
        } else {
            const item = currentSel.customization.textLabels.find((l) => l.id === itemId);
            if (item) { initialRotation = item.rotationDegrees; }
        }

        const getTouchDistAngle = (touches: ArrayLike<{ clientX: number; clientY: number }>) => {
            if (touches.length < 2) return null;
            const dx = touches[1].clientX - touches[0].clientX;
            const dy = touches[1].clientY - touches[0].clientY;
            return { dist: Math.hypot(dx, dy), angle: Math.atan2(dy, dx) * (180 / Math.PI) };
        };

        if (isTouch && (e as React.TouchEvent).touches.length >= 2) {
            const da = getTouchDistAngle((e as React.TouchEvent).touches);
            if (da) { prevTouchDist = da.dist; prevTouchAngle = da.angle; }
        }

        const handleDragMove = (moveEvent: MouseEvent | TouchEvent) => {
            const moveIsTouch = "touches" in moveEvent;
            const touches = moveIsTouch ? (moveEvent as TouchEvent).touches : null;

            // Multi-touch: pinch scale + rotation
            if (touches && touches.length >= 2) {
                moveEvent.preventDefault();
                const da = getTouchDistAngle(touches);
                if (da && prevTouchDist !== null && prevTouchAngle !== null) {
                    const scaleRatio = da.dist / prevTouchDist;
                    const angleDelta = da.angle - prevTouchAngle;

                    const sel = selectionRef.current;
                    const customization = { ...sel.customization };

                    if (type === "sticker") {
                        customization.stickerItems = customization.stickerItems.map((item) =>
                            item.id === itemId
                                ? {
                                    ...item,
                                    scale: Math.max(0.3, Math.min(4, initialScale * scaleRatio)),
                                    rotationDegrees: Math.round(initialRotation + angleDelta),
                                }
                                : item,
                        );
                    } else {
                        customization.textLabels = customization.textLabels.map((item) =>
                            item.id === itemId
                                ? {
                                    ...item,
                                    rotationDegrees: Math.round(initialRotation + angleDelta),
                                }
                                : item,
                        );
                    }

                    onSelectionChange({ ...sel, customization });
                }
                return;
            }

            // Single touch/mouse: drag position
            const currentX = moveIsTouch
                ? (moveEvent as TouchEvent).touches[0].clientX
                : (moveEvent as MouseEvent).clientX;
            const currentY = moveIsTouch
                ? (moveEvent as TouchEvent).touches[0].clientY
                : (moveEvent as MouseEvent).clientY;

            const x = Math.max(0.02, Math.min(0.98, (currentX - rect.left) / rect.width));
            const y = Math.max(0.02, Math.min(0.98, (currentY - rect.top) / rect.height));

            const currentSelection = selectionRef.current;
            const customization = { ...currentSelection.customization };
            if (type === "sticker") {
                customization.stickerItems = customization.stickerItems.map((item) =>
                    item.id === itemId ? { ...item, x, y } : item,
                );
            } else {
                customization.textLabels = customization.textLabels.map((item) =>
                    item.id === itemId ? { ...item, x, y } : item,
                );
            }

            onSelectionChange({
                ...currentSelection,
                customization,
            });
        };

        const handleDragEnd = () => {
            window.removeEventListener("mousemove", handleDragMove);
            window.removeEventListener("mouseup", handleDragEnd);
            window.removeEventListener("touchmove", handleDragMove);
            window.removeEventListener("touchend", handleDragEnd);
        };

        window.addEventListener("mousemove", handleDragMove);
        window.addEventListener("mouseup", handleDragEnd);
        window.addEventListener("touchmove", handleDragMove, { passive: false });
        window.addEventListener("touchend", handleDragEnd);
    };

    // Wheel gesture: scroll = scale, shift+scroll = rotate
    const handleWheelGesture = (
        e: React.WheelEvent<HTMLDivElement>,
        itemId: string,
        type: "sticker" | "text",
    ) => {
        if (!onSelectionChange) return;
        e.preventDefault();
        e.stopPropagation();

        const currentSelection = selectionRef.current;
        const customization = { ...currentSelection.customization };

        if (e.shiftKey) {
            // Rotate
            const rotDelta = e.deltaY > 0 ? 5 : -5;
            if (type === "sticker") {
                customization.stickerItems = customization.stickerItems.map((item) =>
                    item.id === itemId
                        ? { ...item, rotationDegrees: item.rotationDegrees + rotDelta }
                        : item,
                );
            } else {
                customization.textLabels = customization.textLabels.map((item) =>
                    item.id === itemId
                        ? { ...item, rotationDegrees: item.rotationDegrees + rotDelta }
                        : item,
                );
            }
        } else {
            // Scale
            const scaleDelta = e.deltaY > 0 ? -0.1 : 0.1;
            if (type === "sticker") {
                customization.stickerItems = customization.stickerItems.map((item) =>
                    item.id === itemId
                        ? { ...item, scale: Math.max(0.3, Math.min(4, item.scale + scaleDelta)) }
                        : item,
                );
            } else {
                // For text, scale the fontSize
                customization.textLabels = customization.textLabels.map((item) =>
                    item.id === itemId
                        ? { ...item, fontSize: Math.max(16, Math.min(120, item.fontSize + (e.deltaY > 0 ? -4 : 4))) }
                        : item,
                );
            }
        }

        onSelectionChange({ ...currentSelection, customization });
    };

    return (
        <section
            className="w-full flex-1 flex items-center justify-center overflow-hidden min-h-0"
            aria-label="Preview renderer"
        >
            <div
                className="relative h-full max-w-full rounded-none shadow-2xl flex flex-col p-[2.5%] transition-all duration-300 animate-fade-in"
                style={{
                    aspectRatio: sheetAspectRatio,
                    boxSizing: "border-box",
                    maxHeight: "100%",
                    backgroundColor: frame.id !== "none" ? frame.borderColor : theme.backgroundColor,
                    containerType: "inline-size",
                }}
            >
                <div
                    className="grid w-full"
                    style={{
                        height: `${(1 - geometry.brandingZoneRatio) * 100}%`,
                        gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))`,
                        gridTemplateRows: `repeat(${layout.rows}, minmax(0, 1fr))`,
                        gap: "2.5%",
                    }}
                    aria-label={`Layout preview ${layout.name}`}
                >
                    {Array.from({ length: layout.shotCount }).map((_, index) => {
                         const hasPhoto = index < chronological.length;
                         const cellPhoto = hasPhoto ? chronological[index] : null;
 
                         return (
                             <PreviewCell
                                 key={index}
                                 index={index}
                                 stream={stream}
                                 cameraStatus={cameraStatus}
                                 photoUrl={cellPhoto ? cellPhoto.outputUrl : null}
                                 theme={theme}
                                 frame={frame}
                                 style={style}
                                 onRetry={onRetry}
                             />
                         );
                    })}
                </div>
 
                {/* Sticker overlays */}
                {selection.customization.stickerItems.map((item) => {
                    const sticker = resolveStickerConfig(item.stickerId);
                    return (
                        <div
                            key={item.id}
                            className={`absolute drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] select-none ${
                                onSelectionChange
                                    ? "cursor-move hover:scale-110 active:scale-125 transition-transform touch-none"
                                    : "pointer-events-none"
                            }`}
                            style={{
                                left: `${item.x * 100}%`,
                                top: `${item.y * 100}%`,
                                fontSize: `${7.5 * item.scale}cqw`,
                                transform: `translate(-50%, -50%) rotate(${item.rotationDegrees}deg)`,
                            }}
                            onMouseDown={(e) => handleDragStart(e, item.id, "sticker")}
                            onTouchStart={(e) => handleDragStart(e, item.id, "sticker")}
                            onWheel={(e) => handleWheelGesture(e, item.id, "sticker")}
                            aria-label={`Sticker preview ${sticker.name}`}
                            title="Scroll: scale · Shift+Scroll: rotate"
                        >
                            {sticker.emoji}
                        </div>
                    );
                })}

                {/* Text overlays */}
                {selection.customization.textLabels.map((label) => {
                    const isBranding = label.id === "setup-text-preset";
                    if (isBranding) {
                        const frameBg = frame.id !== "none" ? frame.borderColor : theme.backgroundColor;
                        const textColor = getContrastColor(frameBg);
                        return (
                            <div
                                key={label.id}
                                className={`absolute w-full text-center font-black tracking-widest uppercase transition-all duration-300 select-none drop-shadow-sm ${
                                    onSelectionChange ? "cursor-move touch-none" : "pointer-events-none"
                                }`}
                                style={{
                                    left: "50%",
                                    top: `${label.y * 100}%`,
                                    color: textColor,
                                    fontSize: `${label.fontSize ? label.fontSize / 12 : 3.5}cqw`,
                                    transform: `translate(-50%, -50%) rotate(${label.rotationDegrees}deg)`,
                                    fontFamily: selection.themeId === "party" ? "Georgia, serif" : "system-ui, sans-serif",
                                }}
                                onMouseDown={(e) => handleDragStart(e, label.id, "text")}
                                onTouchStart={(e) => handleDragStart(e, label.id, "text")}
                                onWheel={(e) => handleWheelGesture(e, label.id, "text")}
                                title="Scroll: size · Shift+Scroll: rotate"
                            >
                                {label.text}
                            </div>
                        );
                    }
                    return (
                        <div
                            key={label.id}
                            className={`absolute max-w-[80%] whitespace-nowrap rounded-full bg-black/60 backdrop-blur px-[3cqw] py-[1cqw] text-center font-black uppercase tracking-wide text-white shadow-2xl select-none ${
                                onSelectionChange ? "cursor-move touch-none" : "pointer-events-none"
                            }`}
                            style={{
                                left: `${label.x * 100}%`,
                                top: `${label.y * 100}%`,
                                color: label.color,
                                fontSize: `${label.fontSize / 12}cqw`,
                                transform: `translate(-50%, -50%) rotate(${label.rotationDegrees}deg)`,
                            }}
                            onMouseDown={(e) => handleDragStart(e, label.id, "text")}
                            onTouchStart={(e) => handleDragStart(e, label.id, "text")}
                            onWheel={(e) => handleWheelGesture(e, label.id, "text")}
                            title="Scroll: size · Shift+Scroll: rotate"
                        >
                            {label.text}
                        </div>
                    );
                })}

                {/* Visual metadata overlay */}
                {/* {showMetadata && (
                    <div className="absolute top-4 left-4 max-w-[70%] rounded-xl bg-black/80 backdrop-blur border border-white/10 p-3 text-left text-[11px] text-white pointer-events-none select-none shadow-md leading-relaxed">
                        <div className="font-bold text-emerald-300 mb-0.5">
                            Realtime setup preview
                        </div>
                        <div className="text-neutral-300">
                            Layout: {layout.name} · {layout.shotCount} ảnh · Countdown: {selection.countdownSeconds}s
                        </div>
                        <div className="text-neutral-300">
                            Theme: {theme.name} · Khung: {frame.name} · Style: {style.name}
                        </div>
                        <div className="text-neutral-400 uppercase tracking-wider text-[9px] mt-0.5">
                            Camera: {cameraStatus.toUpperCase()}
                        </div>
                    </div>
                )} */}

                {/* Style preview badge */}
                {style.mode !== "none" && (
                    <div className="absolute right-4 top-4 rounded-xl bg-white/90 px-3 py-2 text-xs font-semibold text-black pointer-events-none select-none shadow-md">
                        Style preview: {style.name}
                    </div>
                )}
            </div>
        </section>
    );
}
