"use client";

import React, { useRef, useState } from "react";
import type { DetectedSlot, FrameImportResult, FramePoint, NormalizedBounds } from "@/services/frame-import/frame-import.types";

interface FrameSlotDebugPreviewProps {
    result: FrameImportResult;
    slots?: readonly DetectedSlot[];
    imageUrl?: string;
    className?: string;
    selectedSlotId?: string | null;
    onSelectSlot?: (slotId: string) => void;
    onUpdateSlotBounds?: (slotId: string, bounds: NormalizedBounds) => void;
    onUpdateSlotPoints?: (slotId: string, points: readonly FramePoint[]) => void;
    selectedPointIndex?: number | null;
    onSelectPoint?: (pointIndex: number | null) => void;
}

type DragType = "move" | "top-left" | "top-right" | "bottom-left" | "bottom-right" | "point" | "in-handle" | "out-handle";

export function FrameSlotDebugPreview({
    result,
    slots: propSlots,
    imageUrl,
    className = "",
    selectedSlotId,
    onSelectSlot,
    onUpdateSlotBounds,
    onUpdateSlotPoints,
    selectedPointIndex = null,
    onSelectPoint,
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
        pointIndex?: number;
        initialPoints?: readonly FramePoint[];
    } | null>(null);

    const handleMouseDown = (
        e: React.MouseEvent,
        slot: DetectedSlot,
        type: DragType,
        pointIndex?: number,
    ) => {
        e.preventDefault();
        e.stopPropagation();

        if (onSelectSlot) {
            onSelectSlot(slot.id);
        }
        if ((type === "point" || type === "in-handle" || type === "out-handle") && typeof pointIndex === "number") {
            onSelectPoint?.(pointIndex);
        } else if (type !== "point") {
            onSelectPoint?.(null);
        }

        if (type !== "point" && !onUpdateSlotBounds) return;
        if (type === "point" && !onUpdateSlotPoints) return;

        setActiveDrag({
            slotId: slot.id,
            type,
            startX: e.clientX,
            startY: e.clientY,
            initialBounds: { ...slot.normalizedBounds },
            pointIndex,
            initialPoints: slot.points ? [...slot.points] : undefined,
        });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!activeDrag || !containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;

        const deltaX = (e.clientX - activeDrag.startX) / rect.width;
        const deltaY = (e.clientY - activeDrag.startY) / rect.height;

        if (activeDrag.type === "point" || activeDrag.type === "in-handle" || activeDrag.type === "out-handle") {
            if (!onUpdateSlotPoints || typeof activeDrag.pointIndex !== "number" || !activeDrag.initialPoints) return;
            const nextPoints = activeDrag.initialPoints.map((point, index) => {
                if (index !== activeDrag.pointIndex) return point;
                if (activeDrag.type === "in-handle") {
                    const base = point.inHandle ?? point;
                    return { ...point, inHandle: { x: Number(Math.max(0, Math.min(1, base.x + deltaX)).toFixed(4)), y: Number(Math.max(0, Math.min(1, base.y + deltaY)).toFixed(4)) } };
                }
                if (activeDrag.type === "out-handle") {
                    const base = point.outHandle ?? point;
                    return { ...point, outHandle: { x: Number(Math.max(0, Math.min(1, base.x + deltaX)).toFixed(4)), y: Number(Math.max(0, Math.min(1, base.y + deltaY)).toFixed(4)) } };
                }
                return {
                    ...point,
                    x: Number(Math.max(0, Math.min(1, point.x + deltaX)).toFixed(4)),
                    y: Number(Math.max(0, Math.min(1, point.y + deltaY)).toFixed(4)),
                    inHandle: point.inHandle ? {
                        x: Number(Math.max(0, Math.min(1, point.inHandle.x + deltaX)).toFixed(4)),
                        y: Number(Math.max(0, Math.min(1, point.inHandle.y + deltaY)).toFixed(4)),
                    } : undefined,
                    outHandle: point.outHandle ? {
                        x: Number(Math.max(0, Math.min(1, point.outHandle.x + deltaX)).toFixed(4)),
                        y: Number(Math.max(0, Math.min(1, point.outHandle.y + deltaY)).toFixed(4)),
                    } : undefined,
                };
            });
            onUpdateSlotPoints(activeDrag.slotId, nextPoints);
            return;
        }

        if (!onUpdateSlotBounds) return;

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
            className={`relative mx-auto overflow-hidden rounded-xl border border-neutral-300 shadow-md select-none transition-all flex items-center justify-center ${className}`}
            style={{
                backgroundImage: "conic-gradient(#cbd5e1 90deg, #f1f5f9 90deg 180deg, #cbd5e1 180deg 270deg, #f1f5f9 270deg)",
                backgroundSize: "24px 24px",
                maxHeight: "56vh",
                aspectRatio: `${image.width} / ${image.height}`,
            }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            <div
                ref={containerRef}
                className="relative w-full h-full"
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

                    const polygonClip = slot.shape === "polygon" && slot.points && slot.points.length >= 3
                        ? `polygon(${slot.points.map((point) => {
                            const localX = ((point.x - slot.normalizedBounds.x) / slot.normalizedBounds.width) * 100;
                            const localY = ((point.y - slot.normalizedBounds.y) / slot.normalizedBounds.height) * 100;
                            return `${localX}% ${localY}%`;
                        }).join(", ")})`
                        : undefined;

                    const borderStyle = isSelected
                        ? "border-pink-500 bg-pink-500/10 text-pink-700 ring-2 ring-pink-400/80 z-30"
                        : status === "auto-approved"
                        ? "border-emerald-500 bg-transparent text-emerald-700 z-20"
                        : status === "needs-review"
                        ? "border-amber-500 bg-transparent text-amber-700 z-20"
                        : "border-rose-500 bg-transparent text-rose-700 z-20";

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
                            {polygonClip && (
                                <div
                                    className="absolute inset-0 bg-purple-500/25 pointer-events-none"
                                    style={{ clipPath: polygonClip }}
                                />
                            )}
                            <div className="absolute left-1 top-1 flex items-center gap-1.5 rounded bg-black/80 px-2 py-0.5 text-[10px] font-black text-white shadow pointer-events-none">
                                <span>#{slot.order + 1}{slot.shape === "polygon" ? " cong" : ""}</span>
                                {(slot as { slotSource?: string }).slotSource && (
                                    <span className={`px-1 py-0.2 rounded text-[8px] uppercase font-bold ${
                                        (slot as { slotSource?: string }).slotSource === "fallback"
                                            ? "bg-amber-600 text-white"
                                            : (slot as { slotSource?: string }).slotSource === "manual"
                                            ? "bg-blue-600 text-white"
                                            : "bg-emerald-600 text-white"
                                    }`}>
                                        {(slot as { slotSource?: string }).slotSource}
                                    </span>
                                )}
                                <span className="opacity-75 font-mono text-[9px]">
                                    {(slot.normalizedBounds.width * 100).toFixed(1)}%×
                                    {(slot.normalizedBounds.height * 100).toFixed(1)}%
                                </span>
                            </div>

                            {(slot.shape === "polygon" || slot.shape === "bezier") && slot.points && slot.points.length >= 3 && onUpdateSlotPoints && (
                                <>
                                    {slot.points.map((point, pointIndex) => {
                                        const localLeft = ((point.x - slot.normalizedBounds.x) / slot.normalizedBounds.width) * 100;
                                        const localTop = ((point.y - slot.normalizedBounds.y) / slot.normalizedBounds.height) * 100;
                                        const selectedPoint = isSelected && selectedPointIndex === pointIndex;
                                        return (
                                            <button
                                                key={`${slot.id}-point-${pointIndex}`}
                                                type="button"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    onSelectSlot?.(slot.id);
                                                    onSelectPoint?.(pointIndex);
                                                }}
                                                onMouseDown={(e) => handleMouseDown(e, slot, "point", pointIndex)}
                                                className={`absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md z-50 cursor-grab active:cursor-grabbing ${selectedPoint ? "bg-purple-700 ring-2 ring-white" : "bg-purple-500 hover:bg-purple-600"}`}
                                                style={{ left: `${localLeft}%`, top: `${localTop}%` }}
                                                title={`Kéo điểm cong #${pointIndex + 1}`}
                                                aria-label={`Kéo điểm cong #${pointIndex + 1}`}
                                            />
                                        );
                                    })}
                                    {slot.shape === "bezier" && selectedPointIndex !== null && slot.points[selectedPointIndex] && (() => {
                                        const point = slot.points[selectedPointIndex];
                                        const handles = [
                                            { kind: "in-handle" as const, point: point.inHandle, label: "In" },
                                            { kind: "out-handle" as const, point: point.outHandle, label: "Out" },
                                        ].filter((item): item is { kind: "in-handle" | "out-handle"; point: { x: number; y: number }; label: string } => Boolean(item.point));
                                        return handles.map((handle) => {
                                            const localLeft = ((handle.point.x - slot.normalizedBounds.x) / slot.normalizedBounds.width) * 100;
                                            const localTop = ((handle.point.y - slot.normalizedBounds.y) / slot.normalizedBounds.height) * 100;
                                            return (
                                                <button
                                                    key={`${slot.id}-${selectedPointIndex}-${handle.kind}`}
                                                    type="button"
                                                    onMouseDown={(e) => handleMouseDown(e, slot, handle.kind, selectedPointIndex)}
                                                    className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-fuchsia-500 shadow-md z-50 cursor-crosshair hover:bg-fuchsia-600"
                                                    style={{ left: `${localLeft}%`, top: `${localTop}%` }}
                                                    title={`Kéo Bezier ${handle.label} handle`}
                                                    aria-label={`Kéo Bezier ${handle.label} handle`}
                                                />
                                            );
                                        });
                                    })()}
                                </>
                            )}

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
