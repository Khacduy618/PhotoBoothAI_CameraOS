"use client";

import React, { useContext } from "react";
import { AssetManager } from "@/services/platform/asset-manager";
import { BoothSessionContext } from "@/components/booth/booth-session-context";
import type { BoothOutputCustomization, StickerCustomization, StickerOverlay } from "@/types/customization";

interface StickerSelectorProps {
    stickerItems: BoothOutputCustomization["stickerItems"];
    onAddSticker?: (stickerId: string) => void;
    onSelectPresetSticker?: (stickerId: string | null) => void;
    onRemoveSticker: (id: string) => void;
    disabled?: boolean;
    compact?: boolean;
}

export function StickerSelector({
    stickerItems,
    onAddSticker,
    onSelectPresetSticker,
    onRemoveSticker,
    disabled = false,
    compact = false,
}: StickerSelectorProps) {
    const stickerConfigs = AssetManager.getStickerConfigs();
    
    // Safely consume BoothSessionContext
    const sessionContext = useContext(BoothSessionContext);

    const selectedOverlayId = sessionContext?.selectedOverlayId ?? null;
    const setSelectedOverlayId = sessionContext?.setSelectedOverlayId;
    const updateOverlay = sessionContext?.updateOverlay;
    const duplicateOverlay = sessionContext?.duplicateOverlay;
    const bringOverlayToFront = sessionContext?.bringOverlayToFront;
    const sendOverlayToBack = sessionContext?.sendOverlayToBack;
    const overlays = sessionContext?.selection?.customization?.overlays || [];
    
    const activeStickerItems = sessionContext?.selection?.customization?.stickerItems || stickerItems || [];
    const count = activeStickerItems.length;
    const isMaxReached = count >= 4;

    const handleAdd = (stickerId: string) => {
        if (isMaxReached) return;
        if (sessionContext?.addSticker) {
            sessionContext.addSticker(stickerId);
        } else if (onAddSticker) {
            onAddSticker(stickerId);
        } else if (onSelectPresetSticker) {
            onSelectPresetSticker(stickerId);
        }
    };

    const handleRemove = (id: string) => {
        if (sessionContext?.removeSticker) {
            sessionContext.removeSticker(id);
        } else {
            onRemoveSticker(id);
        }
    };

    // Find currently selected sticker overlay if any
    const selectedStickerOverlay = overlays.find(
        (o): o is StickerOverlay => o.id === selectedOverlayId && o.type === "sticker"
    );

    return (
        <fieldset className="space-y-4" disabled={disabled}>
            <div className="flex justify-between items-center">
                <legend className="text-sm font-extrabold text-pink-950 uppercase tracking-wider">
                    Chọn Nhãn dán Sticker
                </legend>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                    isMaxReached 
                        ? "bg-amber-100 text-amber-800 border-amber-300" 
                        : "bg-pink-100 text-pink-600 border-pink-200"
                }`}>
                    {count} đã chọn
                </span>
            </div>

            <div className={`grid gap-3 ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}>
                {stickerConfigs.map((sticker) => {
                    return (
                        <button
                            key={sticker.id}
                            type="button"
                            disabled={disabled || isMaxReached}
                            onClick={() => handleAdd(sticker.id)}
                            className={`rounded-2xl border p-3 text-left transition duration-300 shadow-sm flex flex-col justify-between gap-1 group ${
                                isMaxReached
                                    ? "opacity-50 cursor-not-allowed border-neutral-200 bg-neutral-100"
                                    : "border-pink-200/70 bg-white/75 hover:bg-white hover:border-pink-400 text-neutral-800 active:scale-95"
                            }`}
                        >
                            <div className="flex items-center justify-between w-full">
                                <span className="block font-black text-sm text-pink-950 group-hover:scale-105 transition-transform">
                                    {sticker.emoji} {sticker.name}
                                </span>
                                <span className="text-[10px] font-black bg-gradient-to-r from-pink-500 to-purple-500 text-white px-2 py-0.5 rounded-lg shrink-0 shadow-sm">
                                    + Thêm
                                </span>
                            </div>
                            <span className="block text-xs text-pink-900/70 font-medium truncate">
                                {sticker.description}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* List of added stickers */}
            {activeStickerItems.length > 0 && (
                <div className="space-y-2 pt-3 border-t border-pink-200/50">
                    <label className="text-xs font-extrabold text-pink-950 uppercase tracking-wider block">
                        Danh sách sticker trên khung:
                    </label>
                    <div className="flex flex-wrap gap-2">
                        {activeStickerItems.map((item: StickerCustomization) => {
                            const foundObj = stickerConfigs.find((s) => s.id === item.stickerId);
                            const emoji = foundObj ? foundObj.emoji : item.stickerId;
                            const isSelected = item.id === selectedOverlayId;

                            return (
                                <div
                                    key={item.id}
                                    onClick={() => setSelectedOverlayId?.(item.id)}
                                    className={`flex items-center gap-1.5 border rounded-full px-3 py-1 text-xs cursor-pointer transition shadow-sm ${
                                        isSelected
                                            ? "bg-pink-500 text-white border-pink-600 font-black ring-2 ring-pink-400/50"
                                            : "bg-white/90 border-pink-200 text-pink-950 font-bold hover:bg-pink-50"
                                    }`}
                                >
                                    <span className="font-extrabold">{emoji}</span>
                                    <button
                                        type="button"
                                        disabled={disabled}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemove(item.id);
                                        }}
                                        className={`ml-1 text-xs font-black ${isSelected ? "text-white/80 hover:text-white" : "text-pink-600 hover:text-red-600"}`}
                                        title="Xóa sticker"
                                    >
                                        ✕
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Selected Sticker Inspector Panel */}
            {selectedStickerOverlay && updateOverlay && (
                <div className="p-3.5 rounded-2xl bg-pink-500/10 border border-pink-300/80 space-y-3 shadow-md text-xs text-pink-950 animate-fade-in mt-3">
                    <div className="flex items-center justify-between border-b border-pink-200/60 pb-2">
                        <h4 className="font-black text-pink-800 uppercase tracking-wider flex items-center gap-1.5 text-xs">
                            ✨ Tùy chỉnh Sticker đã chọn
                        </h4>
                        <div className="flex flex-wrap gap-1">
                            {bringOverlayToFront && (
                                <button
                                    type="button"
                                    onClick={() => bringOverlayToFront(selectedStickerOverlay.id)}
                                    className="px-2 py-1 rounded-lg bg-white hover:bg-neutral-100 font-extrabold border border-pink-200 shadow-sm transition active:scale-95 text-[10px]"
                                    title="Lên trên cùng"
                                >
                                    🔼 Lên trên
                                </button>
                            )}
                            {sendOverlayToBack && (
                                <button
                                    type="button"
                                    onClick={() => sendOverlayToBack(selectedStickerOverlay.id)}
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
                                    onClick={() => duplicateOverlay(selectedStickerOverlay.id)}
                                    className="px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-extrabold border border-blue-200 shadow-sm transition active:scale-95 text-[10px] disabled:opacity-40"
                                    title="Nhân bản sticker"
                                >
                                    📋 Nhân bản
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => onRemoveSticker(selectedStickerOverlay.id)}
                                className="px-2 py-1 rounded-lg bg-red-500 hover:bg-red-600 text-white font-extrabold shadow-sm transition active:scale-95 text-[10px]"
                                title="Xóa sticker"
                            >
                                🗑️ Xóa
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5">
                        <div className="space-y-1">
                            <label className="font-bold text-pink-900/80 block text-[11px]">Kích thước</label>
                            <input
                                type="range"
                                min={0.3}
                                max={4.0}
                                step={0.1}
                                value={selectedStickerOverlay.scale ?? 1}
                                onChange={(e) => updateOverlay(selectedStickerOverlay.id, { scale: parseFloat(e.target.value) })}
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
                                value={selectedStickerOverlay.rotationDegrees || 0}
                                onChange={(e) => updateOverlay(selectedStickerOverlay.id, { rotationDegrees: parseInt(e.target.value) })}
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
                                value={selectedStickerOverlay.opacity ?? 1.0}
                                onChange={(e) => updateOverlay(selectedStickerOverlay.id, { opacity: parseFloat(e.target.value) })}
                                className="w-full accent-pink-600 cursor-pointer"
                            />
                        </div>
                    </div>

                    <div className="flex gap-2 pt-1 border-t border-pink-200/40">
                        <button
                            type="button"
                            onClick={() => updateOverlay(selectedStickerOverlay.id, { flipX: !selectedStickerOverlay.flipX })}
                            className={`px-3 py-1.5 rounded-xl border font-bold text-xs transition active:scale-95 ${
                                selectedStickerOverlay.flipX
                                    ? "bg-pink-500 text-white border-pink-600 shadow-sm"
                                    : "bg-white text-pink-950 border-pink-200 hover:bg-pink-50"
                            }`}
                        >
                            ↔️ Lật ngang (Flip X)
                        </button>
                        <button
                            type="button"
                            onClick={() => updateOverlay(selectedStickerOverlay.id, { flipY: !selectedStickerOverlay.flipY })}
                            className={`px-3 py-1.5 rounded-xl border font-bold text-xs transition active:scale-95 ${
                                selectedStickerOverlay.flipY
                                    ? "bg-pink-500 text-white border-pink-600 shadow-sm"
                                    : "bg-white text-pink-950 border-pink-200 hover:bg-pink-50"
                            }`}
                        >
                            ↕️ Lật dọc (Flip Y)
                        </button>
                    </div>
                </div>
            )}
        </fieldset>
    );
}
