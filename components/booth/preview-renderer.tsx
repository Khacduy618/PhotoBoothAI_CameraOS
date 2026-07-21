"use client";

import React from "react";
import { PreviewCell } from "@/components/booth/preview-cell";
import { resolveStickerConfig } from "@/config/sticker.config";
import { getLayoutGeometry } from "@/services/layout/layout-engine";
import type { BoothSelection, CapturedPhoto } from "@/types/theme";
import type { RenderConfig } from "@/types/render-config";
import { createRenderConfig } from "@/services/render/render-config.builder";
import type { OverlayItem, DrawingStrokePoint, DrawingOverlay } from "@/types/customization";

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
    selection?: BoothSelection;
    renderConfig?: RenderConfig;
    stream?: MediaStream | null;
    cameraStatus?: string;
    capturedPhotos?: CapturedPhoto[];
    showMetadata?: boolean;
    showDemoFallback?: boolean;
    onSelectionChange?: (selection: BoothSelection) => void;
    onRetry?: () => void;
    className?: string;
    sheetRef?: React.Ref<HTMLDivElement>;
    activeStrokePoints?: readonly DrawingStrokePoint[] | null;
    activePenColor?: string;
    children?: React.ReactNode;
}

export function PreviewRenderer({
    selection,
    renderConfig,
    stream = null,
    cameraStatus = "ready",
    capturedPhotos = [],
    showMetadata = true,
    showDemoFallback = true,
    onSelectionChange,
    onRetry,
    className = "",
    sheetRef,
    activeStrokePoints = null,
    activePenColor = "#ffffff",
    children,
}: PreviewRendererProps) {
    const config = renderConfig || (selection ? createRenderConfig(selection) : null);
    if (!config) return null;

    const { layout, theme, frame, style, overlays } = config;
    const geometry = getLayoutGeometry(layout.id);
    const sheetAspectRatio = geometry.sheetAspectRatio;

    // Reverse chronological order for captured photos
    const chronological = [...capturedPhotos].reverse();

    return (
        <section
            className={`relative w-full h-full flex items-center justify-center overflow-hidden ${className}`}
            aria-label="Preview renderer"
        >
            <div
                ref={sheetRef}
                className="relative h-full max-w-full rounded-none shadow-2xl flex flex-col p-[2.5%] transition-all duration-300 animate-fade-in touch-none select-none"
                style={{
                    aspectRatio: sheetAspectRatio,
                    boxSizing: "border-box",
                    maxHeight: "100%",
                    backgroundColor: frame.id !== "none" ? frame.borderColor : theme.backgroundColor,
                    backgroundImage: frame.patternUrl ? `url(${frame.patternUrl})` : undefined,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
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
                                 showDemoFallback={showDemoFallback}
                             />
                         );
                    })}
                </div>

                {/* SVG Drawing Strokes Overlay */}
                <svg
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    viewBox="0 0 1000 1500"
                    preserveAspectRatio="none"
                    style={{ zIndex: 5 }}
                >
                    {overlays
                        .filter((o): o is DrawingOverlay => o.type === "drawing" && Boolean(o.points && o.points.length >= 2))
                        .map((stroke) => (
                            <path
                                key={stroke.id}
                                d={stroke.points!.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x * 1000} ${p.y * 1500}`).join(" ")}
                                stroke={stroke.color || "#ffffff"}
                                strokeWidth={stroke.strokeWidth || 9}
                                fill="none"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        ))}
                    {activeStrokePoints && activeStrokePoints.length >= 2 && (
                        <path
                            d={activeStrokePoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x * 1000} ${p.y * 1500}`).join(" ")}
                            stroke={activePenColor}
                            strokeWidth={9}
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    )}
                </svg>

                {/* Unified Overlays */}
                {overlays
                    .filter((o) => o.type !== "drawing")
                    .map((item) => {
                        if (item.type === "sticker") {
                            const sticker = resolveStickerConfig(item.content);
                            const stickerScale = item.scale ?? 1;
                            const sizeCqw = ((item.baseWidth * stickerScale) / 1000) * 100;
                            const rotRad = item.rotationRadians ?? 0;
                            const flipX = item.flipX ? -1 : 1;
                            const flipY = item.flipY ? -1 : 1;

                            return (
                                <div
                                    key={item.id}
                                    className="absolute drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] select-none pointer-events-none"
                                    style={{
                                        left: `${item.x * 100}%`,
                                        top: `${item.y * 100}%`,
                                        fontSize: `${sizeCqw}cqw`,
                                        lineHeight: 1,
                                        opacity: item.opacity ?? 1,
                                        transform: `translate(-50%, -50%) rotate(${rotRad}rad) scale(${flipX}, ${flipY})`,
                                        zIndex: item.zIndex,
                                    }}
                                    aria-label={`Sticker preview ${sticker.name}`}
                                >
                                    {sticker.emoji}
                                </div>
                            );
                        } else if (item.type === "text") {
                            const isBranding = item.id === "setup-text-preset";
                            const textScale = item.scale ?? 1;
                            const sizeCqw = (((item.fontSize || 48) * textScale) / 1000) * 100;
                            const rotRad = item.rotationRadians ?? 0;
                            
                            // Align styles mapping
                            let textAlignStyle: React.CSSProperties = {
                                textAlign: item.align || "center",
                            };

                            const letterSpacingCqw = (((item.letterSpacing || 0) * textScale) / 1000) * 100;

                            // Outlines & Shadows Presets implementation
                            let textShadow = "";
                            const outlineColor = item.outlineColor || "#000000";
                            const outlineWidth = item.outlineWidth !== undefined ? item.outlineWidth : 2;
                            if (outlineWidth > 0) {
                                textShadow = `0 0 4px rgba(0,0,0,0.8), -1px -1px 0 ${outlineColor}, 1px -1px 0 ${outlineColor}, -1px 1px 0 ${outlineColor}, 1px 1px 0 ${outlineColor}`;
                            }

                            if (item.shadowPreset === "soft") {
                                textShadow = (textShadow ? textShadow + ", " : "") + "0 4px 8px rgba(0,0,0,0.3)";
                            } else if (item.shadowPreset === "hard") {
                                textShadow = (textShadow ? textShadow + ", " : "") + "4px 4px 0px rgba(0,0,0,0.8)";
                            } else if (item.shadowPreset === "neon") {
                                textShadow = (textShadow ? textShadow + ", " : "") + `0 0 5px #fff, 0 0 10px ${item.color}, 0 0 20px ${item.color}`;
                            } else if (!textShadow) {
                                textShadow = "0 2px 4px rgba(0,0,0,0.5)";
                            }

                            if (isBranding) {
                                const frameBg = frame.id !== "none" ? frame.borderColor : theme.backgroundColor;
                                const textColor = getContrastColor(frameBg);
                                return (
                                    <div
                                        key={item.id}
                                        className="absolute w-full text-center font-black tracking-widest uppercase transition-all duration-300 select-none pointer-events-none"
                                        style={{
                                            left: "50%",
                                            top: `${item.y * 100}%`,
                                            color: textColor,
                                            fontSize: `${sizeCqw}cqw`,
                                            transform: `translate(-50%, -50%) rotate(${rotRad}rad)`,
                                            fontFamily: theme.id === "party" ? "Georgia, serif" : "system-ui, sans-serif",
                                            opacity: item.opacity ?? 1,
                                            zIndex: item.zIndex,
                                        }}
                                    >
                                        {item.content}
                                    </div>
                                );
                            }

                            return (
                                <div
                                    key={item.id}
                                    className="absolute max-w-[95%] whitespace-nowrap font-black uppercase select-none pointer-events-none"
                                    style={{
                                        left: `${item.x * 100}%`,
                                        top: `${item.y * 100}%`,
                                        color: item.color || "#ffffff",
                                        fontSize: `${sizeCqw}cqw`,
                                        fontFamily: item.fontFamily || "system-ui, sans-serif",
                                        letterSpacing: `${letterSpacingCqw}cqw`,
                                        transform: `translate(-50%, -50%) rotate(${rotRad}rad)`,
                                        textShadow,
                                        opacity: item.opacity ?? 1,
                                        zIndex: item.zIndex,
                                        ...textAlignStyle,
                                    }}
                                >
                                    {item.content}
                                </div>
                            );
                        }
                        return null;
                    })}

                {/* Style preview badge */}
                {style.mode !== "none" && (
                    <div className="absolute right-4 top-4 rounded-xl bg-white/90 px-3 py-2 text-xs font-semibold text-black pointer-events-none select-none shadow-md">
                        Style preview: {style.name}
                    </div>
                )}
                {children}
            </div>
        </section>
    );
}
