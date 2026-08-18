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

function getFrameOrientation(frameConfig: FrameConfig): "portrait" | "landscape" {
    return frameConfig.photoViewportOrientation ?? frameConfig.orientation ?? ((frameConfig.outputWidth || 1800) >= (frameConfig.outputHeight || 1200) ? "landscape" : "portrait");
}

function getFrameAspectLabel(frameConfig: FrameConfig): string {
    if (frameConfig.photoAspectRatio) return frameConfig.photoAspectRatio;
    return getFrameOrientation(frameConfig) === "landscape" ? "3:2" : "2:3";
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

    const groupedFramePackages = [
        {
            id: "portrait",
            title: "Khung dọc / Portrait",
            description: "Dành cho ảnh dọc, ưu tiên slot 2:3 hoặc 3:4, luôn contain để không crop mặt/người.",
            items: framePackages.filter((pkg) => getFrameOrientation(AssetManager.resolveFrameConfig(pkg.id)) === "portrait"),
        },
        {
            id: "landscape",
            title: "Khung ngang / Landscape 3:2",
            description: "Dành cho ảnh ngang Canon 6D 3:2, export/download giữ full image bằng contain.",
            items: framePackages.filter((pkg) => getFrameOrientation(AssetManager.resolveFrameConfig(pkg.id)) === "landscape"),
        },
    ].filter((group) => group.items.length > 0);

    return (
        <div className="space-y-6">
            <fieldset className="space-y-3" disabled={disabled}>
                <legend className="text-sm font-extrabold text-pink-950 uppercase tracking-wider">
                    1. Thiết kế khung ({framePackages.length} mẫu cho {activeShotCount || 4} shots)
                </legend>

                <div className="space-y-5">
                    {groupedFramePackages.map((group) => (
                        <div key={group.id} className="space-y-2.5">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h3 className="text-xs font-black uppercase tracking-wider text-pink-950">
                                        {group.title}
                                    </h3>
                                    <p className="text-[11px] font-medium text-pink-900/65 leading-snug">
                                        {group.description}
                                    </p>
                                </div>
                                <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-black text-pink-700 border border-pink-200">
                                    {group.items.length} mẫu
                                </span>
                            </div>
                            <div className={`grid gap-3.5 ${compact ? "grid-cols-2" : "grid-cols-2 md:grid-cols-3"}`}>
                                {group.items.map((pkg) => {
                                    const selected = frameId === pkg.id;
                                    const frameConfig = AssetManager.resolveFrameConfig(pkg.id);
                                    const isPngOverlay = frameConfig.kind === "png-overlay";
                                    const slotCount = frameConfig.slots?.length || frameConfig.shotCount || 4;
                                    const width = frameConfig.outputWidth || 1800;
                                    const height = frameConfig.outputHeight || 1200;
                                    const frameOrientation = getFrameOrientation(frameConfig);
                                    const aspectLabel = getFrameAspectLabel(frameConfig);

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
                                            <div className="w-full flex items-center justify-between gap-1 text-[9px] font-black z-10 px-0.5">
                                                <span className={`px-2 py-0.5 rounded-full border shadow-2xs uppercase tracking-wider ${
                                                    frameOrientation === "landscape"
                                                        ? "bg-amber-100 text-amber-900 border-amber-300"
                                                        : "bg-purple-100 text-purple-900 border-purple-300"
                                                }`}>
                                                    {frameOrientation === "landscape" ? `Ngang ${aspectLabel}` : `Dọc ${aspectLabel}`}
                                                </span>
                                                {isPngOverlay && (
                                                    <span className="rounded bg-pink-600 px-1.5 py-0.5 text-[8px] text-white font-bold tracking-wider">
                                                        PNG
                                                    </span>
                                                )}
                                            </div>

                                            <div className="w-full flex items-center justify-center p-1 rounded-xl bg-neutral-100/50 overflow-hidden">
                                                <div
                                                    className="w-full relative rounded-lg shadow-sm overflow-hidden transition-all duration-300 group-hover:scale-[1.03] flex flex-col items-center justify-center"
                                                    style={{
                                                        aspectRatio: `${width} / ${height}`,
                                                        backgroundColor: isPngOverlay
                                                            ? "transparent"
                                                            : pkg.config.borderColor !== "transparent"
                                                                ? pkg.config.borderColor
                                                                : "#ffffff",
                                                        borderWidth: isPngOverlay ? 0 : frameConfig.borderWidth ? `${Math.max(2, Math.min(8, frameConfig.borderWidth / 5))}px` : "0px",
                                                        borderStyle: "solid",
                                                        borderColor: isPngOverlay ? "transparent" : pkg.config.borderColor,
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
                                                                        left: `${(slot.x / width) * 100}%`,
                                                                        top: `${(slot.y / height) * 100}%`,
                                                                        width: `${(slot.width / width) * 100}%`,
                                                                        height: `${(slot.height / height) * 100}%`,
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
                        </div>
                    ))}
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
