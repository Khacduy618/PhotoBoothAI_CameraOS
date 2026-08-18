"use client";

import React, { useContext } from "react";
import { BoothSessionContext } from "@/components/booth/booth-session-context";

export const PEN_COLORS = [
    "#ffffff",
    "#f59e0b",
    "#34d399",
    "#60a5fa",
    "#f472b6",
    "#ef4444",
    "#a855f7",
] as const;

interface DrawingToolsProps {
    activePenColor: string | null;
    onSelectPenColor: (color: string | null) => void;
    activePenWidth?: number;
    onSelectPenWidth?: (width: number) => void;
}

export const STROKE_WIDTH_OPTIONS = [
    { label: "Mảnh (5px)", value: 5 },
    { label: "Vừa (9px)", value: 9 },
    { label: "Dày (15px)", value: 15 },
    { label: "Rất dày (24px)", value: 24 },
] as const;

export function DrawingTools({
    activePenColor,
    onSelectPenColor,
    activePenWidth = 9,
    onSelectPenWidth,
}: DrawingToolsProps) {
    const context = useContext(BoothSessionContext);
    const undoDrawingStroke = context?.undoDrawingStroke || (() => {});
    const clearDrawingStrokes = context?.clearDrawingStrokes || (() => {});
    const drawingStrokes = context?.selection.customization.drawingStrokes || [];

    return (
        <fieldset className="space-y-4 p-4 rounded-2xl bg-white/70 backdrop-blur-md border border-pink-200/60 shadow-sm font-sans text-neutral-900">
            <legend className="text-sm font-black tracking-wide text-pink-950 uppercase border-b border-pink-200/50 pb-2 w-full flex items-center justify-between">
                <span>✏️ BÚT VẼ CANVAS (DRAWING)</span>
                {activePenColor ? (
                    <span className="text-xs font-bold text-emerald-600">✓ Đang bật</span>
                ) : (
                    <span className="text-xs text-neutral-400 font-normal">Đang tắt cọ</span>
                )}
            </legend>

            <div className="space-y-2">
                <p className="text-xs font-semibold text-pink-950">Chọn màu bút:</p>
                <div className="flex flex-wrap gap-2.5">
                    {PEN_COLORS.map((color) => {
                        const isSelected = activePenColor === color;
                        return (
                            <button
                                key={color}
                                type="button"
                                aria-label={`Chọn màu cọ ${color}`}
                                className={`relative flex h-9 w-9 items-center justify-center rounded-full border-2 transition ${
                                    isSelected
                                        ? "border-pink-500 scale-110 shadow-md ring-2 ring-pink-300"
                                        : "border-pink-200 hover:border-pink-400"
                                }`}
                                style={{ backgroundColor: color }}
                                onClick={() => {
                                    onSelectPenColor(isSelected ? null : color);
                                }}
                            >
                                {isSelected && (
                                    <span className="text-xs font-extrabold text-black drop-shadow-[0_1px_2px_rgba(255,255,255,0.8)]">
                                        ✓
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Stroke Width Selector */}
            <div className="space-y-2 pt-1 border-t border-pink-200/40">
                <p className="text-xs font-semibold text-pink-950">Kích thước nét cọ (Stroke width):</p>
                <div className="grid grid-cols-2 gap-2">
                    {STROKE_WIDTH_OPTIONS.map((option) => {
                        const isSelected = activePenWidth === option.value;
                        return (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => onSelectPenWidth && onSelectPenWidth(option.value)}
                                className={`py-1.5 px-2.5 text-xs font-bold rounded-xl border transition-all flex items-center justify-between ${
                                    isSelected
                                        ? "bg-pink-500 text-white border-pink-600 shadow-sm"
                                        : "bg-white/80 hover:bg-white text-pink-950 border-pink-200"
                                }`}
                            >
                                <span>{option.label}</span>
                                <span
                                    className="rounded-full bg-current inline-block"
                                    style={{
                                        width: Math.min(14, Math.max(4, option.value / 2)),
                                        height: Math.min(14, Math.max(4, option.value / 2)),
                                    }}
                                />
                            </button>
                        );
                    })}
                </div>
                <p className="text-[11px] text-pink-900/70 leading-relaxed pt-1">
                    {activePenColor
                        ? "Nhấp và kéo trực tiếp trên ảnh preview để vẽ. Chọn lại màu để tắt cọ."
                        : "Nhấp vào 1 màu để bật cọ vẽ. Đã vẽ: " + drawingStrokes.length + " nét."}
                </p>
            </div>

            {/* Drawing Actions Toolbar: Undo & Clear */}
            <div className="flex gap-2.5 pt-2 border-t border-pink-200/50">
                <button
                    type="button"
                    disabled={drawingStrokes.length === 0}
                    onClick={undoDrawingStroke}
                    className="flex-1 py-2 px-3 rounded-xl border border-pink-300/80 bg-white/80 hover:bg-white text-pink-950 text-xs font-extrabold shadow-sm active:scale-95 transition disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-1.5"
                >
                    <span>↩️</span> Undo Nét Vẽ
                </button>
                <button
                    type="button"
                    disabled={drawingStrokes.length === 0}
                    onClick={clearDrawingStrokes}
                    className="flex-1 py-2 px-3 rounded-xl border border-pink-300/80 bg-white/80 hover:bg-white text-rose-700 text-xs font-extrabold shadow-sm active:scale-95 transition disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-1.5"
                >
                    <span>🗑️</span> Xóa Tất Cả Nét
                </button>
            </div>
        </fieldset>
    );
}
