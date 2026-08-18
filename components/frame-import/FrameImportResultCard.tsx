"use client";

import React, { useState } from "react";
import type { DetectedSlot, FrameDefinition, FrameImportResult, FrameOutputPaper, FramePoint, FrameTargetProduct } from "@/services/frame-import/frame-import.types";
import { FrameSlotDebugPreview } from "./FrameSlotDebugPreview";
import { punchOutFrameSlots } from "@/services/frame-import/transparent-punchout.service";

interface FrameImportResultCardProps {
    result: FrameImportResult;
    imageUrl?: string;
    events?: readonly { eventId: string; name: string }[];
    selectedEventId?: string;
    onPublish: (definition: FrameDefinition, targetEventId?: string) => void | Promise<void>;
    onReject: (importId: string) => void;
    isPublished?: boolean;
}

export function FrameImportResultCard({
    result,
    imageUrl,
    events,
    selectedEventId,
    onPublish,
    onReject,
    isPublished = false,
}: FrameImportResultCardProps) {
    const { importId, sourceFileName, status, analysis, slots, image } = result;

    const defaultName = sourceFileName
        .replace(/\.[^/.]+$/, "")
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());

    const [cardEventId, setCardEventId] = useState(selectedEventId || events?.[0]?.eventId || "event_hoi_an_heritage");
    const [frameName, setFrameName] = useState(defaultName);
    const [frameDescription, setFrameDescription] = useState("Canva imported frame overlay");
    const [allowDraw, setAllowDraw] = useState(false);
    const [editableSlots, setEditableSlots] = useState<readonly DetectedSlot[]>(result.slots);
    const [selectedSlotId, setSelectedSlotId] = useState<string | null>(result.slots[0]?.id || null);
    const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);

    const inferProductFromSlotsAndName = (): FrameTargetProduct => {
        const lowerName = sourceFileName.toLowerCase();
        if (result.slots.length === 1) return "PREMIUM_POSTCARD";
        if (result.slots.length === 2) return "STRIP_2";
        if (result.slots.length === 6) return "SHEET_6";
        if (result.slots.length === 4) {
            const hasMultipleColumns = result.slots.some((s) => s.normalizedBounds.x >= 0.35);
            if (lowerName.includes("sheet") || hasMultipleColumns) {
                return "SHEET_4";
            }
            return "STRIP_4";
        }
        return "STRIP_4";
    };

    const inferOrientationFromSlots = (): "portrait" | "landscape" => {
        if (result.slots.length > 0) {
            const firstSlot = result.slots[0];
            const slotWidth = firstSlot.normalizedBounds.width * image.width;
            const slotHeight = firstSlot.normalizedBounds.height * image.height;
            return slotWidth >= slotHeight ? "landscape" : "portrait";
        }
        return image.width > image.height ? "landscape" : "portrait";
    };

    const initialProduct: FrameTargetProduct = inferProductFromSlotsAndName();

    const [targetProduct, setTargetProduct] = useState<FrameTargetProduct>(initialProduct);
    const [frameOrientation, setFrameOrientation] = useState<"portrait" | "landscape">(
        inferOrientationFromSlots()
    );

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
        setSelectedSlotId(result.slots[0]?.id || null);
    };

    const createSlotFromBounds = (bounds: { x: number; y: number; width: number; height: number }, shape: "rect" | "polygon" | "bezier" = "rect"): DetectedSlot => {
        const order = editableSlots.length;
        return {
            id: `manual-slot-${Date.now()}-${order + 1}`,
            order,
            normalizedBounds: bounds,
            pixelBounds: {
                x: Math.round(bounds.x * image.width),
                y: Math.round(bounds.y * image.height),
                width: Math.round(bounds.width * image.width),
                height: Math.round(bounds.height * image.height),
            },
            areaRatio: bounds.width * bounds.height,
            fillRatio: 1,
            touchesCanvasEdge: false,
            shape,
            points: shape === "polygon" || shape === "bezier" ? [
                { x: bounds.x + bounds.width * 0.08, y: bounds.y, outHandle: shape === "bezier" ? { x: bounds.x + bounds.width * 0.28, y: bounds.y } : undefined },
                { x: bounds.x + bounds.width * 0.92, y: bounds.y, inHandle: shape === "bezier" ? { x: bounds.x + bounds.width * 0.72, y: bounds.y } : undefined, outHandle: shape === "bezier" ? { x: bounds.x + bounds.width, y: bounds.y + bounds.height * 0.22 } : undefined },
                { x: bounds.x + bounds.width, y: bounds.y + bounds.height * 0.5, inHandle: shape === "bezier" ? { x: bounds.x + bounds.width, y: bounds.y + bounds.height * 0.28 } : undefined, outHandle: shape === "bezier" ? { x: bounds.x + bounds.width, y: bounds.y + bounds.height * 0.72 } : undefined },
                { x: bounds.x + bounds.width * 0.92, y: bounds.y + bounds.height, inHandle: shape === "bezier" ? { x: bounds.x + bounds.width, y: bounds.y + bounds.height * 0.78 } : undefined, outHandle: shape === "bezier" ? { x: bounds.x + bounds.width * 0.72, y: bounds.y + bounds.height } : undefined },
                { x: bounds.x + bounds.width * 0.08, y: bounds.y + bounds.height, inHandle: shape === "bezier" ? { x: bounds.x + bounds.width * 0.28, y: bounds.y + bounds.height } : undefined, outHandle: shape === "bezier" ? { x: bounds.x, y: bounds.y + bounds.height * 0.78 } : undefined },
                { x: bounds.x, y: bounds.y + bounds.height * 0.5, inHandle: shape === "bezier" ? { x: bounds.x, y: bounds.y + bounds.height * 0.72 } : undefined, outHandle: shape === "bezier" ? { x: bounds.x, y: bounds.y + bounds.height * 0.28 } : undefined },
            ] : undefined,
        };
    };

    const handleAddManualSlot = (shape: "rect" | "polygon" | "bezier" = "rect") => {
        const photoViewportOrientation: "portrait" | "landscape" = image.width > image.height ? "landscape" : "portrait";
        const aspect = photoViewportOrientation === "landscape" ? 3 / 2 : 2 / 3;
        const maxWidth = 0.62;
        const maxHeight = 0.62;
        let slotWidth = maxWidth;
        let slotHeight = slotWidth / aspect;
        if (slotHeight > maxHeight) {
            slotHeight = maxHeight;
            slotWidth = slotHeight * aspect;
        }
        const slot = createSlotFromBounds({
            x: Number(((1 - slotWidth) / 2).toFixed(4)),
            y: Number(((1 - slotHeight) / 2).toFixed(4)),
            width: Number(slotWidth.toFixed(4)),
            height: Number(slotHeight.toFixed(4)),
        }, shape);
        setEditableSlots((prev) => [...prev, slot].map((item, index) => ({ ...item, order: index })));
        setSelectedSlotId(slot.id);
    };

    const handleDeleteSelectedSlot = () => {
        if (!selectedSlotId) return;
        setEditableSlots((prev) => prev.filter((slot) => slot.id !== selectedSlotId).map((slot, index) => ({ ...slot, order: index })));
        setSelectedSlotId(null);
        setSelectedPointIndex(null);
    };

    const handleCreateManualGrid = (count: 4 | 6) => {
        const columns = count === 6 ? 2 : 2;
        const rows = count === 6 ? 3 : 2;
        const marginX = 0.08;
        const marginY = 0.08;
        const gap = 0.035;
        const slotWidth = (1 - marginX * 2 - gap * (columns - 1)) / columns;
        const slotHeight = (1 - marginY * 2 - gap * (rows - 1)) / rows;
        const nextSlots: DetectedSlot[] = [];

        for (let row = 0; row < rows; row += 1) {
            for (let column = 0; column < columns; column += 1) {
                nextSlots.push(createSlotFromBounds({
                    x: Number((marginX + column * (slotWidth + gap)).toFixed(4)),
                    y: Number((marginY + row * (slotHeight + gap)).toFixed(4)),
                    width: Number(slotWidth.toFixed(4)),
                    height: Number(slotHeight.toFixed(4)),
                }, "rect"));
            }
        }

        setEditableSlots(nextSlots.map((slot, index) => ({ ...slot, id: `manual-grid-${count}-${index + 1}`, order: index })));
        setSelectedSlotId("manual-grid-" + count + "-1");
        setSelectedPointIndex(null);
    };

    const handleConvertSelectedToPolygon = () => {
        if (!selectedSlotId) return;
        setEditableSlots((prev) => prev.map((slot) => {
            if (slot.id !== selectedSlotId) return slot;
            const polygonSlot = createSlotFromBounds(slot.normalizedBounds, "polygon");
            return { ...polygonSlot, id: slot.id, order: slot.order };
        }));
        setSelectedPointIndex(0);
    };



    const handleConvertSelectedToBezier = () => {
        if (!selectedSlotId) return;
        setEditableSlots((prev) => prev.map((slot) => {
            if (slot.id !== selectedSlotId) return slot;
            const bezierSlot = createSlotFromBounds(slot.normalizedBounds, "bezier");
            return { ...bezierSlot, id: slot.id, order: slot.order };
        }));
        setSelectedPointIndex(0);
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

                const transformPoint = (point: FramePoint): FramePoint => {
                    const localX = (point.x - slot.normalizedBounds.x) / slot.normalizedBounds.width;
                    const localY = (point.y - slot.normalizedBounds.y) / slot.normalizedBounds.height;
                    const transformHandle = (handle: { x: number; y: number } | undefined) => {
                        if (!handle) return undefined;
                        const handleLocalX = (handle.x - slot.normalizedBounds.x) / slot.normalizedBounds.width;
                        const handleLocalY = (handle.y - slot.normalizedBounds.y) / slot.normalizedBounds.height;
                        return {
                            x: Number((bounds.x + handleLocalX * bounds.width).toFixed(4)),
                            y: Number((bounds.y + handleLocalY * bounds.height).toFixed(4)),
                        };
                    };
                    return {
                        x: Number((bounds.x + localX * bounds.width).toFixed(4)),
                        y: Number((bounds.y + localY * bounds.height).toFixed(4)),
                        inHandle: transformHandle(point.inHandle),
                        outHandle: transformHandle(point.outHandle),
                    };
                };
                const transformedPoints = (slot.shape === "polygon" || slot.shape === "bezier") && slot.points
                    ? slot.points.map(transformPoint)
                    : slot.points;
                return {
                    ...slot,
                    normalizedBounds: bounds,
                    pixelBounds,
                    points: transformedPoints,
                };
            }),
        );
    };

    const selectedSlot = editableSlots.find((s) => s.id === selectedSlotId);

    const computeBoundsFromPoints = (points: readonly FramePoint[]) => {
        const minX = Math.min(...points.map((point) => point.x));
        const minY = Math.min(...points.map((point) => point.y));
        const maxX = Math.max(...points.map((point) => point.x));
        const maxY = Math.max(...points.map((point) => point.y));
        return {
            x: Number(Math.max(0, minX).toFixed(4)),
            y: Number(Math.max(0, minY).toFixed(4)),
            width: Number(Math.max(0.01, Math.min(1, maxX) - Math.max(0, minX)).toFixed(4)),
            height: Number(Math.max(0.01, Math.min(1, maxY) - Math.max(0, minY)).toFixed(4)),
        };
    };

    const handleUpdateSlotPoints = (slotId: string, points: readonly FramePoint[]) => {
        if (points.length < 3) return;
        const bounds = computeBoundsFromPoints(points);
        setEditableSlots((prevSlots) =>
            prevSlots.map((slot) => {
                if (slot.id !== slotId) return slot;
                return {
                    ...slot,
                    shape: "polygon",
                    points,
                    normalizedBounds: bounds,
                    pixelBounds: {
                        x: Math.round(bounds.x * image.width),
                        y: Math.round(bounds.y * image.height),
                        width: Math.round(bounds.width * image.width),
                        height: Math.round(bounds.height * image.height),
                    },
                    areaRatio: bounds.width * bounds.height,
                };
            }),
        );
    };

    const handleAddPointAfterSelected = () => {
        if (!selectedSlot || (selectedSlot.shape !== "polygon" && selectedSlot.shape !== "bezier") || !selectedSlot.points || selectedSlot.points.length < 3) return;
        const insertAfter = selectedPointIndex ?? selectedSlot.points.length - 1;
        const nextIndex = (insertAfter + 1) % selectedSlot.points.length;
        const a = selectedSlot.points[insertAfter];
        const b = selectedSlot.points[nextIndex];
        const midpoint = {
            x: Number(((a.x + b.x) / 2).toFixed(4)),
            y: Number(((a.y + b.y) / 2).toFixed(4)),
        };
        const nextPoints = [
            ...selectedSlot.points.slice(0, insertAfter + 1),
            midpoint,
            ...selectedSlot.points.slice(insertAfter + 1),
        ];
        handleUpdateSlotPoints(selectedSlot.id, nextPoints);
        setSelectedPointIndex(insertAfter + 1);
    };

    const handleDeleteSelectedPoint = () => {
        if (!selectedSlot || (selectedSlot.shape !== "polygon" && selectedSlot.shape !== "bezier") || !selectedSlot.points || selectedPointIndex === null || selectedSlot.points.length <= 3) return;
        const nextPoints = selectedSlot.points.filter((_, index) => index !== selectedPointIndex);
        handleUpdateSlotPoints(selectedSlot.id, nextPoints);
        setSelectedPointIndex(Math.min(selectedPointIndex, nextPoints.length - 1));
    };

    const handleUpdateSelectedPointRadius = (cornerRadius: number) => {
        if (!selectedSlot || !selectedSlot.points || selectedPointIndex === null) return;
        const nextPoints = selectedSlot.points.map((point, index) => index === selectedPointIndex
            ? { ...point, cornerRadius: Number(cornerRadius.toFixed(4)), inHandle: undefined, outHandle: undefined }
            : point);
        handleUpdateSlotPoints(selectedSlot.id, nextPoints);
    };

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
        const supportedShotCounts = [1, 2, 4, 6, 8] as const;
        const detectedShotCount = supportedShotCounts.find((count) => count === editableSlots.length);
        if (!detectedShotCount) {
            window.alert("Số slot hiện tại chưa hỗ trợ. Hãy chỉnh về 1, 2, 4, 6 hoặc 8 slots trước khi publish.");
            return;
        }

        const outputPaper: FrameOutputPaper =
            targetProduct === "STRIP_2" || targetProduct === "STRIP_4" ? "5x15" : "10x15";

        const definitionSlots = editableSlots.map((s) => ({
            id: s.id,
            index: s.order,
            x: s.normalizedBounds.x,
            y: s.normalizedBounds.y,
            width: s.normalizedBounds.width,
            height: s.normalizedBounds.height,
            photoViewportOrientation: frameOrientation,
            shape: s.shape ?? "rect",
            points: s.points,
        }));

        let finalOverlayUrl = imageUrl;
        // Mode A vs Mode B Architecture:
        // Mode A (PRE-TRANSPARENT PNG): Original PNG already contains transparent photo openings.
        // In Mode A, finalOverlayUrl MUST BE imageUrl directly without modification. Slots are used ONLY for captured-photo positioning.
        // Mode B (GENERATED PUNCHOUT): Image is opaque or requires generated cutout.
        const isPreTransparentPng = image.hasAlpha && analysis.transparentPixelRatio > 0;
        if (imageUrl && definitionSlots.length > 0 && !isPreTransparentPng) {
            finalOverlayUrl = await punchOutFrameSlots(imageUrl, definitionSlots);
        }

        const safeImportId = importId.replace(/[^a-zA-Z0-9_-]/g, "_");
        const definition: FrameDefinition = {
            id: `imported_${safeImportId}`,
            name: frameName || defaultName,
            description: frameDescription,
            kind: "png-overlay",
            source: "canva",
            assetUrl: finalOverlayUrl,
            assets: {
                overlay: finalOverlayUrl,
                background: "#ffffff",
            },
            shotCount: detectedShotCount,
            targetProduct,
            outputPaper,
            orientation: frameOrientation,
            photoViewportOrientation: frameOrientation,
            photoAspectRatio: frameOrientation === "landscape" ? "3:2" : "2:3",
            photoFit: "contain",
            allowDraw,
            outputWidth: image.width,
            outputHeight: image.height,
            slots: definitionSlots,
            status: "published",
        };

        await onPublish(definition, cardEventId);
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

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
                <div className="lg:col-span-7 space-y-4">
                    <FrameSlotDebugPreview
                        result={result}
                        slots={editableSlots}
                        imageUrl={imageUrl}
                        selectedSlotId={selectedSlotId}
                        onSelectSlot={(slotId) => {
                            setSelectedSlotId(slotId);
                            setSelectedPointIndex(null);
                        }}
                        onUpdateSlotBounds={handleUpdateSlotBounds}
                        onUpdateSlotPoints={handleUpdateSlotPoints}
                        selectedPointIndex={selectedPointIndex}
                        onSelectPoint={setSelectedPointIndex}
                    />

                    {/* Manual Slot Creation Toolbar */}
                    <div className="space-y-2 pt-2 border-t border-neutral-100">
                        <span className="text-[11px] font-black uppercase tracking-wider text-pink-950">
                            ✍️ Chỉnh tay vùng xoá nền
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                            <button
                                type="button"
                                onClick={() => handleAddManualSlot("rect")}
                                className="rounded-lg bg-pink-600 px-2.5 py-1.5 text-[10px] font-black text-white shadow-sm hover:bg-pink-700 active:scale-95 cursor-pointer"
                            >
                                + Kéo vùng chữ nhật
                            </button>
                            <button
                                type="button"
                                onClick={() => handleAddManualSlot("polygon")}
                                className="rounded-lg bg-purple-600 px-2.5 py-1.5 text-[10px] font-black text-white shadow-sm hover:bg-purple-700 active:scale-95 cursor-pointer"
                            >
                                + Vùng cong 6 điểm
                            </button>
                            <button
                                type="button"
                                onClick={() => handleAddManualSlot("bezier")}
                                className="rounded-lg bg-fuchsia-600 px-2.5 py-1.5 text-[10px] font-black text-white shadow-sm hover:bg-fuchsia-700 active:scale-95 cursor-pointer"
                            >
                                + Bezier CS6
                            </button>
                            <button
                                type="button"
                                onClick={() => handleCreateManualGrid(4)}
                                className="rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-[10px] font-bold text-sky-900 hover:bg-sky-100 active:scale-95 cursor-pointer"
                            >
                                Preset thủ công: 4 slots
                            </button>
                            <button
                                type="button"
                                onClick={() => handleCreateManualGrid(6)}
                                className="rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-[10px] font-bold text-sky-900 hover:bg-sky-100 active:scale-95 cursor-pointer"
                            >
                                Preset thủ công: 6 slots
                            </button>
                            <button
                                type="button"
                                onClick={handleConvertSelectedToPolygon}
                                disabled={!selectedSlotId}
                                className="rounded-lg border border-purple-200 bg-purple-50 px-2.5 py-1.5 text-[10px] font-bold text-purple-900 hover:bg-purple-100 disabled:opacity-40 active:scale-95 cursor-pointer"
                            >
                                Chuyển slot sang cong
                            </button>
                            <button
                                type="button"
                                onClick={handleResetSlots}
                                className="rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1 text-[10px] font-bold text-neutral-700 hover:bg-neutral-100 active:scale-95 transition-all shadow-2xs cursor-pointer ml-auto"
                            >
                                Khôi phục ban đầu
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            <button
                                type="button"
                                onClick={handleConvertSelectedToBezier}
                                disabled={!selectedSlotId}
                                className="rounded-lg border border-fuchsia-200 bg-fuchsia-50 px-2.5 py-1.5 text-[10px] font-bold text-fuchsia-900 hover:bg-fuchsia-100 disabled:opacity-40 active:scale-95 cursor-pointer"
                            >
                                Chuyển sang Bezier
                            </button>
                            <button
                                type="button"
                                onClick={handleAddPointAfterSelected}
                                disabled={!selectedSlot || (selectedSlot.shape !== "polygon" && selectedSlot.shape !== "bezier")}
                                className="rounded-lg border border-purple-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-purple-900 hover:bg-purple-50 disabled:opacity-40 active:scale-95 cursor-pointer"
                            >
                                + Thêm điểm cong
                            </button>
                            <button
                                type="button"
                                onClick={handleDeleteSelectedPoint}
                                disabled={!selectedSlot || (selectedSlot.shape !== "polygon" && selectedSlot.shape !== "bezier") || selectedPointIndex === null || !selectedSlot.points || selectedSlot.points.length <= 3}
                                className="rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-rose-900 hover:bg-rose-50 disabled:opacity-40 active:scale-95 cursor-pointer"
                            >
                                Xoá điểm chọn
                            </button>
                            <button
                                type="button"
                                onClick={handleDeleteSelectedSlot}
                                disabled={!selectedSlotId}
                                className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[10px] font-bold text-rose-900 hover:bg-rose-100 disabled:opacity-40 active:scale-95 cursor-pointer"
                            >
                                Xoá slot chọn
                            </button>
                        </div>
                        <p className="text-[10px] font-medium leading-snug text-neutral-500">
                            Dùng chữ nhật cho khung thường; dùng vùng cong/Bezier khi sticker/decoration che cạnh slot. Publish sẽ xoá nền theo vùng này nhưng vẫn giữ ảnh ở chế độ contain.
                        </p>
                        {selectedSlot?.points && selectedPointIndex !== null && selectedSlot.points[selectedPointIndex] && (
                            <div className="rounded-xl border border-fuchsia-200 bg-fuchsia-50/70 p-2.5 space-y-1.5">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-fuchsia-950">
                                        Bo góc điểm #{selectedPointIndex + 1}
                                    </span>
                                    <span className="font-mono text-[10px] font-bold text-fuchsia-800">
                                        {Math.round((selectedSlot.points[selectedPointIndex].cornerRadius ?? 0) * 100)}%
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min={0}
                                    max={0.18}
                                    step={0.005}
                                    value={selectedSlot.points[selectedPointIndex].cornerRadius ?? 0}
                                    onChange={(event) => handleUpdateSelectedPointRadius(Number(event.target.value))}
                                    className="w-full accent-fuchsia-600"
                                    aria-label={`Bo góc điểm ${selectedPointIndex + 1}`}
                                />
                            </div>
                        )}
                    </div>

                    {/* One-Click Slot Size Sync Toolbar */}
                    <div className="space-y-2 pt-2 border-t border-neutral-100">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black uppercase tracking-wider text-pink-950">
                                ⚡ Đồng bộ kích thước ô (One-Click Sync)
                            </span>
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

                <div className="lg:col-span-5 space-y-4 text-xs">
                    <div className="space-y-1 bg-neutral-50 p-3 rounded-xl border border-neutral-100">
                        <div className="flex justify-between text-neutral-600 font-medium">
                            <span>Shot Count (Số dáng chụp):</span>
                            <span className="font-bold text-pink-700">
                                {editableSlots.length} shots ({editableSlots.length} ô)
                            </span>
                        </div>
                        <div className="flex justify-between text-neutral-600 font-medium">
                            <span>Detected Slots (Số ô trên khung):</span>
                            <span className="font-bold text-neutral-900">{editableSlots.length} ô</span>
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
                                            handleUpdateSlotBounds(selectedSlot.id, { ...selectedSlot.normalizedBounds, x: val });
                                        }}
                                        className="w-full rounded border border-neutral-300 px-1.5 py-1 text-center font-bold text-neutral-900"
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
                                            handleUpdateSlotBounds(selectedSlot.id, { ...selectedSlot.normalizedBounds, y: val });
                                        }}
                                        className="w-full rounded border border-neutral-300 px-1.5 py-1 text-center font-bold text-neutral-900"
                                    />
                                </div>
                                <div>
                                    <label className="text-neutral-600 font-bold block mb-0.5">Rộng (%)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="0.1"
                                        max="100"
                                        value={Number((selectedSlot.normalizedBounds.width * 100).toFixed(1))}
                                        onChange={(e) => {
                                            const val = Math.max(0.01, Math.min(1, parseFloat(e.target.value) || 0.1)) / 100;
                                            handleUpdateSlotBounds(selectedSlot.id, { ...selectedSlot.normalizedBounds, width: val });
                                        }}
                                        className="w-full rounded border border-neutral-300 px-1.5 py-1 text-center font-bold text-neutral-900"
                                    />
                                </div>
                                <div>
                                    <label className="text-neutral-600 font-bold block mb-0.5">Cao (%)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="0.1"
                                        max="100"
                                        value={Number((selectedSlot.normalizedBounds.height * 100).toFixed(1))}
                                        onChange={(e) => {
                                            const val = Math.max(0.01, Math.min(1, parseFloat(e.target.value) || 0.1)) / 100;
                                            handleUpdateSlotBounds(selectedSlot.id, { ...selectedSlot.normalizedBounds, height: val });
                                        }}
                                        className="w-full rounded border border-neutral-300 px-1.5 py-1 text-center font-bold text-neutral-900"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-1 border-t border-pink-200/40 mt-1">
                                <span className="text-[10px] font-bold text-pink-900">
                                    Vùng: {(selectedSlot.normalizedBounds.width * 100).toFixed(1)}% × {(selectedSlot.normalizedBounds.height * 100).toFixed(1)}%
                                </span>
                                <button
                                    type="button"
                                    onClick={() => handleDeleteSelectedSlot()}
                                    className="rounded bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-rose-700 active:scale-95 transition-all cursor-pointer"
                                >
                                    🗑 Xoá Ô này
                                </button>
                            </div>
                        </div>
                    )}

                    {analysis.warnings.length > 0 && (
                        <div className="space-y-1">
                            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
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

                    <div className="space-y-2 pt-2 border-t border-neutral-100">
                        {events && events.length > 0 && (
                            <div>
                                <label className="block text-[11px] font-bold text-pink-950 uppercase tracking-wider mb-1">
                                    🏷️ Gán Khung Cho Event
                                </label>
                                <select
                                    value={cardEventId}
                                    onChange={(e) => setCardEventId(e.target.value)}
                                    className="w-full rounded-lg border border-pink-300 bg-pink-50/50 px-3 py-1.5 text-xs font-bold text-pink-950 focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
                                >
                                    {events.map((ev) => (
                                        <option key={ev.eventId} value={ev.eventId}>
                                            {ev.name} ({ev.eventId})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div>
                            <label className="block text-[11px] font-bold text-pink-950 uppercase tracking-wider mb-1">
                                📸 Loại Sản Phẩm Đích (Target Product)
                            </label>
                            <select
                                value={targetProduct}
                                onChange={(e) => setTargetProduct(e.target.value as FrameTargetProduct)}
                                className="w-full rounded-lg border border-pink-300 bg-pink-50/50 px-3 py-1.5 text-xs font-bold text-pink-950 focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
                            >
                                <option value="STRIP_2">⚡ Photo Strip 2 ô (Chuẩn 5x15 cm)</option>
                                <option value="STRIP_4">⚡ Photo Strip 4 ô (Chuẩn 5x15 cm)</option>
                                <option value="SHEET_4">📄 Photo Sheet 4 ô (Chuẩn 10x15 cm)</option>
                                <option value="SHEET_6">📄 Photo Sheet 6 ô (Chuẩn 10x15 cm)</option>
                                <option value="PREMIUM_POSTCARD">🖼️ Premium Postcard 1 ô (Chuẩn 10x15 cm)</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-pink-950 uppercase tracking-wider mb-1">
                                📐 Hướng Khung Ảnh (Orientation)
                            </label>
                            <select
                                value={frameOrientation}
                                onChange={(e) => setFrameOrientation(e.target.value as "portrait" | "landscape")}
                                className="w-full rounded-lg border border-pink-300 bg-pink-50/50 px-3 py-1.5 text-xs font-bold text-pink-950 focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
                            >
                                <option value="portrait">📱 Khung Dọc (Portrait)</option>
                                <option value="landscape">🖥️ Khung Ngang (Landscape)</option>
                            </select>
                        </div>

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

                        <label className="flex items-start gap-3 rounded-xl border border-fuchsia-200 bg-fuchsia-50/70 p-3 text-fuchsia-950 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={allowDraw}
                                onChange={(event) => setAllowDraw(event.target.checked)}
                                className="mt-0.5 h-4 w-4 accent-fuchsia-600"
                            />
                            <span>
                                <span className="block text-[11px] font-black uppercase tracking-wider">Bật điều kiện Draw cho khung này</span>
                                <span className="mt-0.5 block text-[10px] font-medium leading-snug text-fuchsia-900/75">
                                    Khi guest chọn khung này, flow sẽ mở màn vẽ tay trước khi render thành phẩm.
                                </span>
                            </span>
                        </label>
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
