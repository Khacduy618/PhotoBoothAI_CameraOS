"use client";

import React, { useState, useContext } from "react";
import { AssetManager } from "@/services/platform/asset-manager";
import { BoothSessionContext } from "@/components/booth/booth-session-context";
import type { BoothOutputCustomization, TextLabelCustomization, TextOverlay } from "@/types/customization";

interface TextSelectorProps {
    textLabels: BoothOutputCustomization["textLabels"];
    onAddText?: (text: string) => void;
    onSelectPresetText?: (text: string | null) => void;
    onRemoveText: (id: string) => void;
    disabled?: boolean;
    compact?: boolean;
}

export function TextSelector({
    textLabels,
    onAddText,
    onSelectPresetText,
    onRemoveText,
    disabled = false,
    compact = false,
}: TextSelectorProps) {
    const [inputText, setInputText] = useState("");
    const textLabelPresetConfigs = AssetManager.getTextLabelPresets();

    const sessionContext = useContext(BoothSessionContext);

    const selectedOverlayId = sessionContext?.selectedOverlayId ?? null;
    const setSelectedOverlayId = sessionContext?.setSelectedOverlayId;
    const updateOverlay = sessionContext?.updateOverlay;
    const duplicateOverlay = sessionContext?.duplicateOverlay;
    const bringOverlayToFront = sessionContext?.bringOverlayToFront;
    const sendOverlayToBack = sessionContext?.sendOverlayToBack;
    const overlays = sessionContext?.selection?.customization?.overlays || [];

    const activeTextLabels = sessionContext?.selection?.customization?.textLabels || textLabels || [];
    const count = activeTextLabels.length;
    const isMaxReached = count >= 4;

    const handleAdd = (text: string) => {
        if (isMaxReached || !text.trim()) return;
        if (sessionContext?.addTextLabel) {
            sessionContext.addTextLabel(text.trim());
        } else if (onAddText) {
            onAddText(text.trim());
        } else if (onSelectPresetText) {
            onSelectPresetText(text.trim());
        }
    };

    const handleRemove = (id: string) => {
        if (sessionContext?.removeTextLabel) {
            sessionContext.removeTextLabel(id);
        } else {
            onRemoveText(id);
        }
    };

    const handleAddCustom = () => {
        if (inputText.trim()) {
            handleAdd(inputText);
            setInputText("");
        }
    };

    const selectedTextOverlay = overlays.find(
        (o): o is TextOverlay => o.id === selectedOverlayId && o.type === "text"
    );

    return (
        <fieldset className="space-y-4" disabled={disabled}>
            <div className="flex justify-between items-center">
                <legend className="text-sm font-extrabold text-pink-950 uppercase tracking-wider">
                    Thêm Nhãn chữ kỷ niệm (Text)
                </legend>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                    isMaxReached 
                        ? "bg-amber-100 text-amber-800 border-amber-300" 
                        : "bg-pink-100 text-pink-600 border-pink-200"
                }`}>
                    {count} nhãn chữ đã thêm
                </span>
            </div>

            {/* Custom text input */}
            <div className="flex gap-2">
                <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Nhập nội dung nhãn chữ..."
                    disabled={disabled || isMaxReached}
                    className="flex-1 rounded-xl border border-pink-200 bg-white/90 px-3 py-2 text-xs font-bold text-pink-950 placeholder:text-pink-950/40 focus:border-pink-500 focus:outline-none shadow-sm disabled:opacity-50"
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddCustom();
                        }
                    }}
                />
                <button
                    type="button"
                    disabled={disabled || isMaxReached || !inputText.trim()}
                    onClick={handleAddCustom}
                    className="rounded-xl border border-pink-200/70 bg-gradient-to-r from-pink-500 to-rose-500 px-4 py-2 text-xs font-black text-white hover:brightness-105 active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all shadow-sm shrink-0"
                >
                    + Thêm Chữ
                </button>
            </div>

            {/* Presets */}
            <div className="space-y-2">
                <label className="text-xs font-extrabold text-pink-900/70 block">
                    Gợi ý mẫu chữ phổ biến:
                </label>
                <div className="flex flex-wrap gap-2">
                    {textLabelPresetConfigs.map((preset) => {
                        return (
                            <button
                                key={preset.id}
                                type="button"
                                disabled={disabled || isMaxReached}
                                onClick={() => handleAdd(preset.text)}
                                className={`rounded-xl border px-3 py-1.5 text-xs font-extrabold shadow-sm transition ${
                                    isMaxReached
                                        ? "opacity-40 cursor-not-allowed border-neutral-200 bg-neutral-100 text-neutral-400"
                                        : "border-pink-200/80 bg-white/70 hover:bg-white hover:border-pink-400 text-pink-950 active:scale-95"
                                }`}
                            >
                                <span className="text-pink-500 font-bold mr-1">+</span>{preset.text}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* List of added text labels */}
            {activeTextLabels.length > 0 && (
                <div className="space-y-2 pt-3 border-t border-pink-200/50">
                    <label className="text-xs font-extrabold text-pink-950 uppercase tracking-wider block">
                        Danh sách chữ đã thêm:
                    </label>
                    <div className="space-y-2">
                        {activeTextLabels.map((item: TextLabelCustomization, idx: number) => {
                            const isSelected = item.id === selectedOverlayId;

                            return (
                                <div
                                    key={item.id}
                                    onClick={() => setSelectedOverlayId?.(item.id)}
                                    className={`flex items-center justify-between border rounded-xl px-3 py-2 text-xs font-bold cursor-pointer transition shadow-sm ${
                                        isSelected
                                            ? "bg-pink-500 text-white border-pink-600 font-black ring-2 ring-pink-400/50"
                                            : "bg-white/80 border-pink-200 text-pink-950 hover:bg-pink-50"
                                    }`}
                                >
                                    <span className="truncate max-w-[80%]">
                                        {idx + 1}. "{item.text}"
                                    </span>
                                    <button
                                        type="button"
                                        disabled={disabled}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemove(item.id);
                                        }}
                                        className={`font-extrabold px-2 py-0.5 rounded-lg shrink-0 text-xs ${
                                            isSelected 
                                                ? "bg-white/20 text-white hover:bg-white/30" 
                                                : "bg-pink-100 text-pink-600 hover:text-red-600"
                                        }`}
                                    >
                                        Xóa
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Selected Text Inspector Panel */}
            {selectedTextOverlay && updateOverlay && (
                <div className="p-3.5 rounded-2xl bg-pink-500/10 border border-pink-300/80 space-y-3 shadow-md text-xs text-pink-950 animate-fade-in mt-3">
                    <div className="flex items-center justify-between border-b border-pink-200/60 pb-2">
                        <h4 className="font-black text-pink-800 uppercase tracking-wider flex items-center gap-1.5 text-xs">
                            ✍️ Tùy chỉnh Nhãn chữ đã chọn
                        </h4>
                        <div className="flex flex-wrap gap-1">
                            {bringOverlayToFront && (
                                <button
                                    type="button"
                                    onClick={() => bringOverlayToFront(selectedTextOverlay.id)}
                                    className="px-2 py-1 rounded-lg bg-white hover:bg-neutral-100 font-extrabold border border-pink-200 shadow-sm transition active:scale-95 text-[10px]"
                                    title="Lên trên cùng"
                                >
                                    🔼 Lên trên
                                </button>
                            )}
                            {sendOverlayToBack && (
                                <button
                                    type="button"
                                    onClick={() => sendOverlayToBack(selectedTextOverlay.id)}
                                    className="px-2 py-1 rounded-lg bg-white hover:bg-neutral-100 font-extrabold border border-pink-200 shadow-sm transition active:scale-95 text-[10px]"
                                    title="Xuống dưới cùng"
                                >
                                    🔽 Xuống dưới
                                </button>
                            )}
                            {duplicateOverlay && (
                                <button
                                    type="button"
                                    disabled={isMaxReached}
                                    onClick={() => duplicateOverlay(selectedTextOverlay.id)}
                                    className="px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-extrabold border border-blue-200 shadow-sm transition active:scale-95 text-[10px] disabled:opacity-40"
                                    title="Nhân bản chữ"
                                >
                                    📋 Nhân bản
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => onRemoveText(selectedTextOverlay.id)}
                                className="px-2 py-1 rounded-lg bg-red-500 hover:bg-red-600 text-white font-extrabold shadow-sm transition active:scale-95 text-[10px]"
                                title="Xóa chữ"
                            >
                                🗑️ Xóa
                            </button>
                        </div>
                    </div>

                    {/* Content Input */}
                    <div className="space-y-1">
                        <label className="font-bold text-pink-900/80 block text-[11px]">Nội dung chữ</label>
                        <input
                            type="text"
                            maxLength={32}
                            value={selectedTextOverlay.content}
                            onChange={(e) => updateOverlay(selectedTextOverlay.id, { content: e.target.value.slice(0, 32) })}
                            className="w-full rounded-xl border border-pink-300 bg-white px-3 py-1.5 text-pink-950 font-bold focus:outline-none focus:ring-2 focus:ring-pink-400 shadow-sm"
                        />
                    </div>

                    {/* Typography: Font Family & Shadow Preset */}
                    <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-1">
                            <label className="font-bold text-pink-900/80 block text-[11px]">Font chữ</label>
                            <select
                                value={selectedTextOverlay.fontFamily || "sans-serif"}
                                onChange={(e) => updateOverlay(selectedTextOverlay.id, { fontFamily: e.target.value })}
                                className="w-full rounded-xl border border-pink-300 bg-white px-2.5 py-1.5 font-bold text-pink-950 focus:outline-none focus:ring-2 focus:ring-pink-400"
                            >
                                <option value="sans-serif">Sans-Serif (Hiện đại)</option>
                                <option value="serif">Serif (Cổ điển)</option>
                                <option value="cursive">Cursive (Nghệ thuật)</option>
                                <option value="monospace">Monospace (Độc đáo)</option>
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="font-bold text-pink-900/80 block text-[11px]">Bóng đổ (Shadow)</label>
                            <select
                                value={selectedTextOverlay.shadowPreset || "none"}
                                onChange={(e) => updateOverlay(selectedTextOverlay.id, { shadowPreset: e.target.value as any })}
                                className="w-full rounded-xl border border-pink-300 bg-white px-2.5 py-1.5 font-bold text-pink-950 focus:outline-none focus:ring-2 focus:ring-pink-400"
                            >
                                <option value="none">Không bóng</option>
                                <option value="soft">Mềm mại (Soft)</option>
                                <option value="hard">Đậm nét (Hard)</option>
                                <option value="neon">Neon Rực rỡ</option>
                            </select>
                        </div>
                    </div>

                    {/* Color Palette */}
                    <div className="space-y-1 pt-1 border-t border-pink-200/40">
                        <label className="font-bold text-pink-900/80 block text-[11px]">Màu chữ:</label>
                        <div className="flex gap-2 items-center flex-wrap">
                            {["#ffffff", "#000000", "#ff4081", "#ffeb3b", "#4caf50", "#00bcd4", "#9c27b0"].map((c) => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => updateOverlay(selectedTextOverlay.id, { color: c })}
                                    className={`w-6 h-6 rounded-full border border-black/20 transition ${
                                        selectedTextOverlay.color === c ? "ring-2 ring-pink-500 scale-110 shadow-sm" : ""
                                    }`}
                                    style={{ backgroundColor: c }}
                                />
                            ))}
                            <input
                                type="color"
                                value={selectedTextOverlay.color || "#ffffff"}
                                onChange={(e) => updateOverlay(selectedTextOverlay.id, { color: e.target.value })}
                                className="w-7 h-7 rounded-lg border border-pink-300 cursor-pointer bg-white p-0.5"
                                title="Màu tùy chỉnh"
                            />
                        </div>
                    </div>

                    {/* Outline Controls */}
                    <div className="grid grid-cols-2 gap-2.5 pt-1 border-t border-pink-200/40">
                        <div className="space-y-1">
                            <label className="font-bold text-pink-900/80 block text-[11px]">Độ dày viền (Outline)</label>
                            <input
                                type="range"
                                min={0}
                                max={8}
                                step={1}
                                value={selectedTextOverlay.outlineWidth ?? 0}
                                onChange={(e) => updateOverlay(selectedTextOverlay.id, { outlineWidth: parseInt(e.target.value) })}
                                className="w-full accent-pink-600 cursor-pointer"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="font-bold text-pink-900/80 block text-[11px]">Màu viền</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="color"
                                    value={selectedTextOverlay.outlineColor || "#000000"}
                                    onChange={(e) => updateOverlay(selectedTextOverlay.id, { outlineColor: e.target.value })}
                                    className="w-7 h-7 rounded-lg border border-pink-300 cursor-pointer bg-white p-0.5"
                                />
                                <span className="text-[10px] font-mono text-pink-950 font-bold">{selectedTextOverlay.outlineColor || "#000000"}</span>
                            </div>
                        </div>
                    </div>

                    {/* Size, Rotation, Opacity Sliders */}
                    <div className="grid grid-cols-3 gap-2.5 pt-1 border-t border-pink-200/40">
                        <div className="space-y-1">
                            <label className="font-bold text-pink-900/80 block text-[11px]">Kích thước font</label>
                            <input
                                type="range"
                                min={16}
                                max={120}
                                step={2}
                                value={selectedTextOverlay.fontSize || 48}
                                onChange={(e) => updateOverlay(selectedTextOverlay.id, { fontSize: parseInt(e.target.value) })}
                                className="w-full accent-pink-600 cursor-pointer"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="font-bold text-pink-900/80 block text-[11px]">Xoay (°)</label>
                            <input
                                type="range"
                                min={-180}
                                max={180}
                                step={5}
                                value={selectedTextOverlay.rotationDegrees || 0}
                                onChange={(e) => updateOverlay(selectedTextOverlay.id, { rotationDegrees: parseInt(e.target.value) })}
                                className="w-full accent-pink-600 cursor-pointer"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="font-bold text-pink-900/80 block text-[11px]">Độ trong suốt</label>
                            <input
                                type="range"
                                min={0.1}
                                max={1.0}
                                step={0.05}
                                value={selectedTextOverlay.opacity ?? 1.0}
                                onChange={(e) => updateOverlay(selectedTextOverlay.id, { opacity: parseFloat(e.target.value) })}
                                className="w-full accent-pink-600 cursor-pointer"
                            />
                        </div>
                    </div>
                </div>
            )}
        </fieldset>
    );
}
