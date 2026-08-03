"use client";

import React from "react";
import { AssetManager } from "@/services/platform/asset-manager";
import { getFrameCompatibility } from "@/services/frame/frame-compatibility.service";
import { LocalFrameRegistry } from "@/services/frame/local-frame-registry";
import type { BoothLayoutConfig } from "@/types/customization";

import type { FrameConfig } from "@/types/theme";

interface FrameSelectorProps {
    frameId: string;
    frameColor?: string;
    onChangeFrame: (frameId: string, defaultColor?: string) => void;
    onChangeFrameColor: (color: string) => void;
    disabled?: boolean;
    compact?: boolean;
    compatibleLayout?: BoothLayoutConfig;
}

function getGridColsClass(frameConfig: FrameConfig): string {
    const layoutFamily = frameConfig.layoutFamily;
    const isLandscape = (frameConfig.outputWidth || 1800) >= (frameConfig.outputHeight || 1200);

    if (layoutFamily === "single") return "grid-cols-1";
    if (layoutFamily === "1x4") return isLandscape ? "grid-cols-4" : "grid-cols-1";
    if (layoutFamily === "1x2") return isLandscape ? "grid-cols-2" : "grid-cols-1";
    if (layoutFamily === "2x3") return isLandscape ? "grid-cols-3" : "grid-cols-2";
    if (layoutFamily === "2x4") return isLandscape ? "grid-cols-4" : "grid-cols-2";
    return "grid-cols-2";
}

export function FrameSelector({
    frameId,
    frameColor,
    onChangeFrame,
    onChangeFrameColor,
    disabled = false,
    compact = false,
    compatibleLayout,
}: FrameSelectorProps) {
    const [, setRegistryTick] = React.useState(0);

    React.useEffect(() => {
        return LocalFrameRegistry.subscribe(() => {
            setRegistryTick((tick) => tick + 1);
        });
    }, []);

    const activeShotCount = compatibleLayout?.shotCount;

    const framePackages = AssetManager.getFramePackages().filter((pkg) => {
        const frameConfig = AssetManager.resolveFrameConfig(pkg.id);
        if (frameConfig.kind === "none") {
            return false;
        }
        if (!activeShotCount || !frameConfig.shotCount) {
            return true;
        }
        return frameConfig.shotCount === activeShotCount;
    });

    return (
        <div className="space-y-6">
            <fieldset className="space-y-3" disabled={disabled}>
                <legend className="text-sm font-extrabold text-pink-950 uppercase tracking-wider">
                    1. Thiết kế khung ({framePackages.length} mẫu cho {activeShotCount || 4} shots)
                </legend>

                <div className={`grid gap-3.5 ${compact ? "grid-cols-2" : "grid-cols-2 md:grid-cols-3"}`}>
                    {framePackages.map((pkg) => {
                        const selected = frameId === pkg.id;
                        const frameConfig = AssetManager.resolveFrameConfig(pkg.id);
                        const isPngOverlay = frameConfig.kind === "png-overlay";
                        const slotCount = frameConfig.slots?.length || frameConfig.shotCount || 4;
                        const width = frameConfig.outputWidth || 1800;
                        const height = frameConfig.outputHeight || 1200;
                        const isLandscape = width >= height;

                        const frameAssetUrl = frameConfig.assetUrl || pkg.config.assetUrl;

                        return (
                            <button
                                key={pkg.id}
                                type="button"
                                disabled={disabled}
                                onClick={() => {
                                    onChangeFrame(pkg.id, pkg.config.borderColor);
                                }}
                                className={`group cursor-pointer rounded-2xl border p-2.5 transition-all duration-300 flex flex-col items-center gap-2 relative ${
                                    selected
                                        ? "border-pink-500 bg-pink-500/15 ring-2 ring-pink-400/40 text-pink-950 font-bold shadow-md shadow-pink-200/50 scale-[1.01]"
                                        : "border-pink-200/60 bg-white/80 hover:bg-white hover:border-pink-300 text-neutral-800 shadow-sm hover:shadow-md"
                                }`}
                            >
                                {/* Header Badge Bar */}
                                <div className="w-full flex items-center justify-between gap-1 text-[9px] font-black z-10 px-0.5">
                                    <span className={`px-2 py-0.5 rounded-full border shadow-2xs uppercase tracking-wider ${
                                        isLandscape
                                            ? "bg-amber-100 text-amber-900 border-amber-300"
                                            : "bg-purple-100 text-purple-900 border-purple-300"
                                    }`}>
                                        {isLandscape ? "Ngang 1800x1200" : "Dọc 1200x1800"}
                                    </span>
                                    {isPngOverlay && (
                                        <span className="rounded bg-pink-600 px-1.5 py-0.5 text-[8px] text-white font-bold tracking-wider">
                                            PNG
                                        </span>
                                    )}
                                </div>

                                {/* Dynamic Responsive Preview Box matching exact aspect ratio */}
                                <div className="w-full flex items-center justify-center p-1 rounded-xl bg-neutral-100/50 border border-neutral-200/40 overflow-hidden">
                                    <div
                                        className="w-full relative rounded-lg shadow-sm overflow-hidden transition-all duration-300 group-hover:scale-[1.03] p-1.5 flex flex-col items-center justify-center"
                                        style={{
                                            aspectRatio: `${width} / ${height}`,
                                            borderColor: pkg.config.borderColor !== "transparent" ? pkg.config.borderColor : "#ffffff",
                                            backgroundColor: pkg.config.borderColor !== "transparent" ? pkg.config.borderColor : "#ffffff",
                                            borderWidth: frameConfig.borderWidth ? `${Math.max(2, Math.min(8, frameConfig.borderWidth / 5))}px` : "3px",
                                            borderStyle: "solid",
                                        }}
                                    >
                                        {frameAssetUrl ? (
                                            <img
                                                src={frameAssetUrl}
                                                alt={pkg.metadata.name}
                                                className="h-full w-full object-contain"
                                            />
                                        ) : frameConfig.slots && frameConfig.slots.length > 0 ? (
                                            <div className="relative w-full h-full rounded bg-neutral-900/10 overflow-hidden">
                                                {frameConfig.slots.map((slot, idx) => (
                                                    <div
                                                        key={slot.id || idx}
                                                        className="absolute bg-sky-200/80 border border-sky-400/60 rounded-xs flex items-center justify-center"
                                                        style={{
                                                            left: `${slot.x * 100}%`,
                                                            top: `${slot.y * 100}%`,
                                                            width: `${slot.width * 100}%`,
                                                            height: `${slot.height * 100}%`,
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                        ) : (
                                            <div className={`w-full h-full rounded bg-neutral-900/10 p-1 grid gap-1 ${getGridColsClass(frameConfig)}`}>
                                                {Array.from({ length: Math.min(slotCount, 8) }).map((_, i) => (
                                                    <div
                                                        key={i}
                                                        className="w-full h-full bg-sky-200/80 border border-sky-400/60 rounded-xs"
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                            </button>
                        );
                    })}
                </div>
            </fieldset>

            {frameId !== "none" && (
                <div className="space-y-3 pt-4 border-t border-pink-200/50 animate-fade-in">
                    <label className="text-sm font-extrabold text-pink-950 uppercase tracking-wider block">
                        2. Tùy chỉnh màu khung
                    </label>
                    <div className="flex flex-wrap items-center gap-2.5">
                        {[
                            { name: "Trắng", value: "#ffffff" },
                            { name: "Đen", value: "#111827" },
                            { name: "Hồng", value: "#fbcfe8" },
                            { name: "Vàng", value: "#facc15" },
                            { name: "Xanh Matcha", value: "#d1fae5" },
                            { name: "Tím Lavender", value: "#e9d5ff" },
                            { name: "Đỏ Tinder", value: "#f43f5e" },
                            { name: "Xanh Cyan", value: "#06b6d4" },
                        ].map((color) => {
                            const active = frameColor === color.value;
                            return (
                                <button
                                    key={color.value}
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => onChangeFrameColor(color.value)}
                                    className={`w-8 h-8 rounded-full relative border transition-all duration-300 flex items-center justify-center hover:scale-110 shadow-sm ${
                                        active
                                            ? "border-pink-500 scale-105 ring-2 ring-pink-400/50"
                                            : "border-neutral-300"
                                    }`}
                                    style={{ backgroundColor: color.value }}
                                    title={color.name}
                                >
                                    {active && (
                                        <span className="w-2.5 h-2.5 rounded-full bg-pink-500 ring-1 ring-white" />
                                    )}
                                </button>
                            );
                        })}

                        <div className="flex items-center gap-2 ml-auto">
                            <span className="text-xs text-pink-900/70 font-bold">Màu tự chọn:</span>
                            <input
                                type="color"
                                disabled={disabled}
                                value={frameColor || "#ffffff"}
                                onChange={(e) => onChangeFrameColor(e.target.value)}
                                className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
