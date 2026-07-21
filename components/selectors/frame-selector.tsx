"use client";

import React from "react";
import { AssetManager } from "@/services/platform/asset-manager";

interface FrameSelectorProps {
    frameId: string;
    frameColor?: string;
    onChangeFrame: (frameId: string, defaultColor?: string) => void;
    onChangeFrameColor: (color: string) => void;
    disabled?: boolean;
    compact?: boolean;
}

export function FrameSelector({
    frameId,
    frameColor,
    onChangeFrame,
    onChangeFrameColor,
    disabled = false,
    compact = false,
}: FrameSelectorProps) {
    const framePackages = AssetManager.getFramePackages();

    return (
        <div className="space-y-6">
            <fieldset className="space-y-3" disabled={disabled}>
                <legend className="text-sm font-extrabold text-pink-950 uppercase tracking-wider">
                    1. Thiết kế khung
                </legend>
                <div className={`grid gap-3 ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3 xl:grid-cols-4"}`}>
                    {framePackages.map((pkg) => {
                        const selected = frameId === pkg.id;
                        return (
                            <button
                                key={pkg.id}
                                type="button"
                                disabled={disabled}
                                onClick={() => {
                                    onChangeFrame(pkg.id, pkg.config.borderColor);
                                }}
                                className={`group cursor-pointer rounded-2xl border p-3 transition-all duration-300 flex flex-col items-center gap-2 ${
                                    selected
                                        ? "border-pink-500 bg-pink-500/15 ring-2 ring-pink-400/40 text-pink-950 font-bold shadow-md shadow-pink-200/50"
                                        : "border-pink-200/60 bg-white/75 hover:bg-white hover:border-pink-300 text-neutral-800 shadow-sm"
                                }`}
                            >
                                <div
                                    className={`w-full aspect-[3/5] rounded-xl ${pkg.thumbnailUrl} flex items-center justify-center overflow-hidden transition duration-500 group-hover:scale-[1.03] shadow-sm`}
                                >
                                    <div className="w-[50%] space-y-0.5">
                                        {Array.from({ length: 3 }).map((_, i) => (
                                            <div
                                                key={i}
                                                className="w-full aspect-[4/3] bg-neutral-600/30 rounded-sm"
                                            />
                                        ))}
                                    </div>
                                </div>
                                <span className="text-xs font-black text-center leading-tight text-pink-950">
                                    {pkg.metadata.name}
                                </span>
                                <span className="text-[9px] text-pink-900/60 uppercase tracking-widest font-extrabold">
                                    {pkg.metadata.category}
                                </span>
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
