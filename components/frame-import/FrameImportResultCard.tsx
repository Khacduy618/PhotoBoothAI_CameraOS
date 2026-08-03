"use client";

import React, { useState } from "react";
import type { DetectedSlot, FrameDefinition, FrameImportResult } from "@/services/frame-import/frame-import.types";
import { FrameSlotDebugPreview } from "./FrameSlotDebugPreview";
import { punchOutFrameSlots } from "@/services/frame-import/transparent-punchout.service";

interface FrameImportResultCardProps {
    result: FrameImportResult;
    imageUrl?: string;
    onPublish: (definition: FrameDefinition) => void;
    onReject: (importId: string) => void;
    isPublished?: boolean;
}

export function FrameImportResultCard({
    result,
    imageUrl,
    onPublish,
    onReject,
    isPublished = false,
}: FrameImportResultCardProps) {
    const { importId, sourceFileName, status, analysis, slots, image } = result;

    const defaultName = sourceFileName
        .replace(/\.[^/.]+$/, "")
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());

    const [frameName, setFrameName] = useState(defaultName);
    const [frameDescription, setFrameDescription] = useState("Canva imported frame overlay");
    const [editableSlots, setEditableSlots] = useState<readonly DetectedSlot[]>(result.slots);
    const [selectedSlotId, setSelectedSlotId] = useState<string | null>(result.slots[0]?.id || null);

    const handleSyncSlotsToRef = (refSlotId: string) => {
        const refSlot = editableSlots.find((s) => s.id === refSlotId);
        if (!refSlot) return;

        const refW = refSlot.normalizedBounds.width;
        const refH = refSlot.normalizedBounds.height;

        setEditableSlots((prevSlots) =>
            prevSlots.map((slot) => {
                const currentCenterX = slot.normalizedBounds.x + slot.normalizedBounds.width / 2;
                const currentCenterY = slot.normalizedBounds.y + slot.normalizedBounds.height / 2;

                let newX = currentCenterX - refW / 2;
                let newY = currentCenterY - refH / 2;

                newX = Math.max(0, Math.min(1 - refW, newX));
                newY = Math.max(0, Math.min(1 - refH, newY));

                const normalizedBounds = {
                    x: Number(newX.toFixed(4)),
                    y: Number(newY.toFixed(4)),
                    width: Number(refW.toFixed(4)),
                    height: Number(refH.toFixed(4)),
                };

                const pixelBounds = {
                    x: Math.round(newX * image.width),
                    y: Math.round(newY * image.height),
                    width: Math.round(refW * image.width),
                    height: Math.round(refH * image.height),
                };

                return {
                    ...slot,
                    normalizedBounds,
                    pixelBounds,
                };
            }),
        );
    };

    const handleResetSlots = () => {
        setEditableSlots(result.slots);
    };

    const handleUpdateSlotBounds = (slotId: string, bounds: { x: number; y: number; width: number; height: number }) => {
        setEditableSlots((prevSlots) =>
            prevSlots.map((slot) => {
                if (slot.id !== slotId) return slot;

                const pixelBounds = {
                    x: Math.round(bounds.x * image.width),
                    y: Math.round(bounds.y * image.height),
                    width: Math.round(bounds.width * image.width),
                    height: Math.round(bounds.height * image.height),
                };

                return {
                    ...slot,
                    normalizedBounds: bounds,
                    pixelBounds,
                };
            }),
        );
    };

    const selectedSlot = editableSlots.find((s) => s.id === selectedSlotId);

    const statusBadge =
        status === "auto-approved" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-black text-emerald-800 border border-emerald-300">
                ✓ Auto-approved
            </span>
        ) : status === "needs-review" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-black text-amber-800 border border-amber-300">
                ⚠ Needs review
            </span>
        ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-black text-rose-800 border border-rose-300">
                ✕ Rejected
            </span>
        );

    const handlePublish = async () => {
        const detectedShotCount = analysis.detectedShotCount ?? 4;
        const photoViewportOrientation: "portrait" | "landscape" =
            image.width > image.height ? "landscape" : "portrait";

        const definitionSlots = editableSlots.map((s) => ({
            id: s.id,
            index: s.order,
            x: s.normalizedBounds.x,
            y: s.normalizedBounds.y,
            width: s.normalizedBounds.width,
            height: s.normalizedBounds.height,
            photoViewportOrientation,
        }));

        // Automatically punch out (clear) slot regions to 100% transparent cutouts
        const transparentAssetUrl = imageUrl ? await punchOutFrameSlots(imageUrl, definitionSlots) : imageUrl;

        const definition: FrameDefinition = {
            id: `imported-${importId}`,
            name: frameName || defaultName,
            description: frameDescription,
            kind: "png-overlay",
            source: "canva",
            assetUrl: transparentAssetUrl,
            borderColor: "#ffffff",
            borderWidth: 0,
            shotCount: detectedShotCount,
            photoViewportOrientation,
            outputWidth: image.width,
            outputHeight: image.height,
            slots: definitionSlots,
        };

        onPublish(definition);
    };

    return (
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition-all hover:shadow-md space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 pb-3">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-neutral-900 truncate max-w-[220px]">
                        {sourceFileName}
                    </span>
                    {statusBadge}
                </div>
                <span className="text-xs font-bold text-neutral-500 font-mono">
                    Score: {(analysis.confidence * 100).toFixed(0)}%
                </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                    <FrameSlotDebugPreview
                        result={result}
                        slots={editableSlots}
                        imageUrl={imageUrl}
                        selectedSlotId={selectedSlotId}
                        onSelectSlot={setSelectedSlotId}
                        onUpdateSlotBounds={handleUpdateSlotBounds}
                    />

                    {/* One-Click Slot Size Sync Toolbar */}
                    <div className="space-y-2 pt-2 border-t border-neutral-100">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black uppercase tracking-wider text-pink-950">
                                ⚡ Đồng bộ kích thước ô (One-Click Sync)
                            </span>
                            <button
                                type="button"
                                onClick={handleResetSlots}
                                className="text-[10px] font-bold text-neutral-500 hover:text-neutral-800 underline cursor-pointer"
                            >
                                Khôi phục ban đầu
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {editableSlots.map((slot) => (
                                <button
                                    key={slot.id}
                                    type="button"
                                    onClick={() => handleSyncSlotsToRef(slot.id)}
                                    className="rounded-lg border border-pink-200 bg-pink-50 px-2 py-1 text-[10px] font-bold text-pink-900 hover:bg-pink-100 active:scale-95 transition-all shadow-2xs cursor-pointer"
                                >
                                    Chép cỡ Ô #{slot.order + 1} ({(slot.normalizedBounds.width * 100).toFixed(0)}%×{(slot.normalizedBounds.height * 100).toFixed(0)}%)
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="space-y-3 text-xs">
                    <div className="space-y-1 bg-neutral-50 p-3 rounded-xl border border-neutral-100">
                        <div className="flex justify-between text-neutral-600 font-medium">
                            <span>Shot Count:</span>
                            <span className="font-bold text-neutral-900">
                                {analysis.detectedShotCount ?? "Uncertain"}
                            </span>
                        </div>
                        <div className="flex justify-between text-neutral-600 font-medium">
                            <span>Detected Slots:</span>
                            <span className="font-bold text-neutral-900">{editableSlots.length}</span>
                        </div>
                        <div className="flex justify-between text-neutral-600 font-medium">
                            <span>Transparent Ratio:</span>
                            <span className="font-bold text-neutral-900">
                                {(analysis.transparentPixelRatio * 100).toFixed(1)}%
                            </span>
                        </div>
                        <div className="flex justify-between text-neutral-600 font-medium">
                            <span>Image Size:</span>
                            <span className="font-bold text-neutral-900">
                                {image.width} × {image.height} px
                            </span>
                        </div>
                    </div>

                    {/* Manual Slot Controls for Selected Slot */}
                    {selectedSlot && (
                        <div className="space-y-1.5 bg-pink-50/60 p-3 rounded-xl border border-pink-200/60">
                            <span className="text-[11px] font-black text-pink-950 uppercase tracking-wider block">
                                Hiệu chỉnh Ô #{selectedSlot.order + 1} (Kéo trực tiếp trên hình hoặc nhập %):
                            </span>
                            <div className="grid grid-cols-4 gap-1.5 text-[10px]">
                                <div>
                                    <label className="text-neutral-600 font-bold block mb-0.5">X (%)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        max="100"
                                        value={Number((selectedSlot.normalizedBounds.x * 100).toFixed(1))}
                                        onChange={(e) => {
                                            const val = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) / 100;
                                            handleUpdateSlotBounds(selectedSlot.id, {
                                                ...selectedSlot.normalizedBounds,
                                                x: Number(val.toFixed(4)),
                                            });
                                        }}
                                        className="w-full rounded border border-neutral-300 px-1.5 py-1 font-mono text-neutral-900 bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="text-neutral-600 font-bold block mb-0.5">Y (%)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        max="100"
                                        value={Number((selectedSlot.normalizedBounds.y * 100).toFixed(1))}
                                        onChange={(e) => {
                                            const val = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) / 100;
                                            handleUpdateSlotBounds(selectedSlot.id, {
                                                ...selectedSlot.normalizedBounds,
                                                y: Number(val.toFixed(4)),
                                            });
                                        }}
                                        className="w-full rounded border border-neutral-300 px-1.5 py-1 font-mono text-neutral-900 bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="text-neutral-600 font-bold block mb-0.5">Rộng (%)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="1"
                                        max="100"
                                        value={Number((selectedSlot.normalizedBounds.width * 100).toFixed(1))}
                                        onChange={(e) => {
                                            const val = Math.max(0.01, Math.min(1, parseFloat(e.target.value) || 0)) / 100;
                                            handleUpdateSlotBounds(selectedSlot.id, {
                                                ...selectedSlot.normalizedBounds,
                                                width: Number(val.toFixed(4)),
                                            });
                                        }}
                                        className="w-full rounded border border-neutral-300 px-1.5 py-1 font-mono text-neutral-900 bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="text-neutral-600 font-bold block mb-0.5">Cao (%)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="1"
                                        max="100"
                                        value={Number((selectedSlot.normalizedBounds.height * 100).toFixed(1))}
                                        onChange={(e) => {
                                            const val = Math.max(0.01, Math.min(1, parseFloat(e.target.value) || 0)) / 100;
                                            handleUpdateSlotBounds(selectedSlot.id, {
                                                ...selectedSlot.normalizedBounds,
                                                height: Number(val.toFixed(4)),
                                            });
                                        }}
                                        className="w-full rounded border border-neutral-300 px-1.5 py-1 font-mono text-neutral-900 bg-white"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {analysis.warnings.length > 0 && (
                        <div className="space-y-1">
                            <span className="font-bold text-amber-900 text-[11px] uppercase tracking-wider">
                                Warnings
                            </span>
                            <div className="flex flex-wrap gap-1">
                                {analysis.warnings.map((w) => (
                                    <span
                                        key={w}
                                        className="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 border border-amber-200"
                                    >
                                        {w}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="space-y-2 pt-2">
                        <div>
                            <label className="block text-[11px] font-bold text-neutral-700 uppercase tracking-wider mb-1">
                                Frame Name
                            </label>
                            <input
                                type="text"
                                value={frameName}
                                onChange={(e) => setFrameName(e.target.value)}
                                className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-xs text-neutral-900 focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-neutral-700 uppercase tracking-wider mb-1">
                                Description
                            </label>
                            <input
                                type="text"
                                value={frameDescription}
                                onChange={(e) => setFrameDescription(e.target.value)}
                                className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-xs text-neutral-900 focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2 pt-3">
                        {isPublished ? (
                            <span className="w-full rounded-xl bg-emerald-50 px-4 py-2 text-center text-xs font-extrabold text-emerald-700 border border-emerald-200">
                                ✓ Published to Registry
                            </span>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    onClick={handlePublish}
                                    disabled={status === "rejected"}
                                    className={`flex-1 rounded-xl px-4 py-2 text-xs font-black transition-all ${
                                        status === "rejected"
                                            ? "bg-neutral-100 text-neutral-400 cursor-not-allowed"
                                            : "bg-pink-600 hover:bg-pink-700 text-white shadow-sm shadow-pink-200 active:scale-95 cursor-pointer"
                                    }`}
                                >
                                    Publish Frame
                                </button>

                                <button
                                    type="button"
                                    onClick={() => onReject(importId)}
                                    className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-bold text-neutral-700 hover:bg-neutral-50 active:scale-95 cursor-pointer"
                                >
                                    Dismiss
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
