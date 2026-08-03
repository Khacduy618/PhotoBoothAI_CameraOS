"use client";

import React, { useRef, useState } from "react";
import type { DetectedSlot, FrameImportResult, NormalizedBounds } from "@/services/frame-import/frame-import.types";

interface FrameSlotDebugPreviewProps {
    result: FrameImportResult;
    slots?: readonly DetectedSlot[];
    imageUrl?: string;
    className?: string;
    selectedSlotId?: string | null;
    onSelectSlot?: (slotId: string) => void;
    onUpdateSlotBounds?: (slotId: string, bounds: NormalizedBounds) => void;
}

type DragType = "move" | "top-left" | "top-right" | "bottom-left" | "bottom-right";

export function FrameSlotDebugPreview({
    result,
    slots: propSlots,
    imageUrl,
    className = "",
    selectedSlotId,
    onSelectSlot,
    onUpdateSlotBounds,
}: FrameSlotDebugPreviewProps) {
    const { image, status } = result;
    const slots = propSlots || result.slots;
    const aspectRatio = image.width / image.height;
    const containerRef = useRef<HTMLDivElement>(null);

    const [activeDrag, setActiveDrag] = useState<{
        slotId: string;
        type: DragType;
        startX: number;
        startY: number;
        initialBounds: NormalizedBounds;
    } | null>(null);

    const handleMouseDown = (
        e: React.MouseEvent,
        slot: DetectedSlot,
        type: DragType,
    ) => {
        e.preventDefault();
        e.stopPropagation();

        if (onSelectSlot) {
            onSelectSlot(slot.id);
        }

        if (!onUpdateSlotBounds) return;

        setActiveDrag({
            slotId: slot.id,
            type,
            startX: e.clientX,
            startY: e.clientY,
            initialBounds: { ...slot.normalizedBounds },
        });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!activeDrag || !containerRef.current || !onUpdateSlotBounds) return;

        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;

        const deltaX = (e.clientX - activeDrag.startX) / rect.width;
        const deltaY = (e.clientY - activeDrag.startY) / rect.height;

        const { x: initX, y: initY, width: initW, height: initH } = activeDrag.initialBounds;

        let newX = initX;
        let newY = initY;
        let newW = initW;
        let newH = initH;

        if (activeDrag.type === "move") {
            newX = Math.max(0, Math.min(1 - initW, initX + deltaX));
            newY = Math.max(0, Math.min(1 - initH, initY + deltaY));
        } else if (activeDrag.type === "top-left") {
            newX = Math.max(0, Math.min(initX + initW - 0.05, initX + deltaX));
            newY = Math.max(0, Math.min(initY + initH - 0.05, initY + deltaY));
            newW = initX + initW - newX;
            newH = initY + initH - newY;
        } else if (activeDrag.type === "top-right") {
            newY = Math.max(0, Math.min(initY + initH - 0.05, initY + deltaY));
            newW = Math.max(0.05, Math.min(1 - initX, initW + deltaX));
            newH = initY + initH - newY;
        } else if (activeDrag.type === "bottom-left") {
            newX = Math.max(0, Math.min(initX + initW - 0.05, initX + deltaX));
            newW = initX + initW - newX;
            newH = Math.max(0.05, Math.min(1 - initY, initH + deltaY));
        } else if (activeDrag.type === "bottom-right") {
            newW = Math.max(0.05, Math.min(1 - initX, initW + deltaX));
            newH = Math.max(0.05, Math.min(1 - initY, initH + deltaY));
        }

        onUpdateSlotBounds(activeDrag.slotId, {
            x: Number(newX.toFixed(4)),
            y: Number(newY.toFixed(4)),
            width: Number(newW.toFixed(4)),
            height: Number(newH.toFixed(4)),
        });
    };

    const handleMouseUp = () => {
        if (activeDrag) {
            setActiveDrag(null);
        }
    };

    return (
        <div
            className={`relative w-full overflow-hidden rounded-xl border border-neutral-200 bg-neutral-950/90 shadow-inner select-none ${className}`}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            <div
                ref={containerRef}
                className="relative w-full"
                style={{ paddingBottom: `${(1 / aspectRatio) * 100}%` }}
            >
                {imageUrl ? (
                    <img
                        src={imageUrl}
                        alt={result.sourceFileName}
                        className="absolute inset-0 h-full w-full object-contain pointer-events-none"
                    />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-neutral-500">
                        {image.width} × {image.height} px
                    </div>
                )}

                {/* Overlaid detected slot boxes */}
                {slots.map((slot) => {
                    const isSelected = selectedSlotId === slot.id;
                    const left = slot.normalizedBounds.x * 100;
                    const top = slot.normalizedBounds.y * 100;
                    const width = slot.normalizedBounds.width * 100;
                    const height = slot.normalizedBounds.height * 100;

                    const borderStyle = isSelected
                        ? "border-pink-500 bg-pink-500/20 text-pink-700 ring-2 ring-pink-400/80 z-30"
                        : status === "auto-approved"
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 z-20"
                        : status === "needs-review"
                        ? "border-amber-500 bg-amber-500/10 text-amber-700 z-20"
                        : "border-rose-500 bg-rose-500/10 text-rose-700 z-20";

                    return (
                        <div
                            key={slot.id}
                            onClick={() => onSelectSlot?.(slot.id)}
                            onMouseDown={(e) => handleMouseDown(e, slot, "move")}
                            className={`absolute border-2 transition-colors cursor-move group/slot ${
                                isSelected ? "border-solid" : "border-dashed"
                            } ${borderStyle}`}
                            style={{
                                left: `${left}%`,
                                top: `${top}%`,
                                width: `${width}%`,
                                height: `${height}%`,
                            }}
                        >
                            <div className="absolute left-1 top-1 flex items-center gap-1.5 rounded bg-black/80 px-2 py-0.5 text-[10px] font-black text-white shadow pointer-events-none">
                                <span>#{slot.order + 1}</span>
                                <span className="opacity-75 font-mono text-[9px]">
                                    {(slot.normalizedBounds.width * 100).toFixed(1)}%×
                                    {(slot.normalizedBounds.height * 100).toFixed(1)}%
                                </span>
                            </div>

                            {/* Corner Drag Handles when interactive */}
                            {onUpdateSlotBounds && (
                                <>
                                    <div
                                        onMouseDown={(e) => handleMouseDown(e, slot, "top-left")}
                                        className="absolute -left-1.5 -top-1.5 h-3.5 w-3.5 rounded-full bg-pink-600 border-2 border-white cursor-nwse-resize shadow-md hover:scale-125 z-40"
                                        title="Kéo chỉnh góc trên trái"
                                    />
                                    <div
                                        onMouseDown={(e) => handleMouseDown(e, slot, "top-right")}
                                        className="absolute -right-1.5 -top-1.5 h-3.5 w-3.5 rounded-full bg-pink-600 border-2 border-white cursor-nesw-resize shadow-md hover:scale-125 z-40"
                                        title="Kéo chỉnh góc trên phải"
                                    />
                                    <div
                                        onMouseDown={(e) => handleMouseDown(e, slot, "bottom-left")}
                                        className="absolute -left-1.5 -bottom-1.5 h-3.5 w-3.5 rounded-full bg-pink-600 border-2 border-white cursor-nesw-resize shadow-md hover:scale-125 z-40"
                                        title="Kéo chỉnh góc dưới trái"
                                    />
                                    <div
                                        onMouseDown={(e) => handleMouseDown(e, slot, "bottom-right")}
                                        className="absolute -right-1.5 -bottom-1.5 h-3.5 w-3.5 rounded-full bg-pink-600 border-2 border-white cursor-nwse-resize shadow-md hover:scale-125 z-40"
                                        title="Kéo chỉnh góc dưới phải"
                                    />
                                </>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
