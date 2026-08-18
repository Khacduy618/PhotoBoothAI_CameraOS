"use client";

import React, { useRef, useEffect, useCallback, useContext } from "react";
import { PreviewRenderer } from "@/components/booth/preview-renderer";
import { BoothSessionContext, useBoothSession } from "@/components/booth/booth-session-context";
import { OVERLAY_REFERENCE_SIZE } from "@/types/customization";
import type { OverlayItem, DrawingStrokePoint } from "@/types/customization";
import type { BoothSelection, CapturedPhoto } from "@/types/theme";
import { createRenderConfig } from "@/services/render/render-config.builder";
import { mapPointerToSheetCoordinates } from "@/utils/pointer-mapping";

interface EditablePreviewProps {
    selection?: BoothSelection;
    stream?: MediaStream | null;
    cameraStatus?: string;
    capturedPhotos?: CapturedPhoto[];
    showMetadata?: boolean;
    className?: string;
    enableDrawing?: boolean;
    activePenColor?: string;
    activePenWidth?: number;
    showSelectionHandles?: boolean;
}

export function EditablePreview({
    selection: propSelection,
    stream = null,
    cameraStatus = "ready",
    capturedPhotos: propCapturedPhotos,
    showMetadata = true,
    className = "",
    enableDrawing = false,
    activePenColor = "#ffffff",
    activePenWidth = 9,
    showSelectionHandles = true,
}: EditablePreviewProps) {
    const context = useContext(BoothSessionContext);
    const selection = propSelection || context?.selection || {
        themeId: "classic",
        frameId: "white-border-portrait",
        styleId: "none",
        layoutId: "2x2",
        countdownSeconds: 3,
        customization: { stickerItems: [], textLabels: [], drawingStrokes: [], overlays: [] },
    };
    const updateOverlay = context?.updateOverlay || (() => {});
    const removeOverlay = context?.removeOverlay || (() => {});
    const duplicateOverlay = context?.duplicateOverlay || (() => {});
    const addDrawingStroke = context?.addDrawingStroke || (() => {});
    const selectedOverlayId = context?.selectedOverlayId ?? null;
    const setSelectedOverlayId = context?.setSelectedOverlayId || (() => {});
    const capturedPhotos = propCapturedPhotos || context?.capturedPhotos || [];

    const sheetRef = useRef<HTMLDivElement | null>(null);
    const activePointerIdRef = useRef<number | null>(null);
    const [activeStrokePoints, setActiveStrokePoints] = React.useState<readonly DrawingStrokePoint[] | null>(null);

    const overlays = selection ? createRenderConfig(selection).overlays : [];
    const selectedItem = overlays.find((o) => o.id === selectedOverlayId);

    // Delete keyboard handler
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!selectedOverlayId) return;

            // Do not delete if typing inside input / textarea
            const target = e.target as HTMLElement;
            if (
                target.tagName === "INPUT" ||
                target.tagName === "TEXTAREA" ||
                target.isContentEditable
            ) {
                return;
            }

            if (e.key === "Backspace" || e.key === "Delete") {
                e.preventDefault();
                removeOverlay(selectedOverlayId);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [selectedOverlayId, removeOverlay]);

    // Handle background pointer down (select deselect / start drawing)
    const handleBackgroundPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement;
        if (target.closest("[data-overlay-item]") || target.closest("[data-handle]")) {
            return;
        }

        if (enableDrawing) {
            if (activePointerIdRef.current !== null && activePointerIdRef.current !== e.pointerId) {
                return;
            }
            activePointerIdRef.current = e.pointerId;

            if (typeof e.currentTarget.setPointerCapture === "function") {
                try {
                    e.currentTarget.setPointerCapture(e.pointerId);
                } catch {
                    // Ignore capture errors on unsupported browsers
                }
            }

            const pt = mapPointerToSheetCoordinates(e, sheetRef.current, { clamp: true });
            if (pt) {
                setActiveStrokePoints([pt]);
            }
            return;
        }

        setSelectedOverlayId(null);
    }, [enableDrawing, setSelectedOverlayId]);

    const handleBackgroundPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (!enableDrawing || !activeStrokePoints) return;
        if (activePointerIdRef.current !== null && activePointerIdRef.current !== e.pointerId) return;

        const pt = mapPointerToSheetCoordinates(e, sheetRef.current, { clamp: true });
        if (pt) {
            setActiveStrokePoints((prev) => (prev ? [...prev, pt] : [pt]));
        }
    }, [enableDrawing, activeStrokePoints]);

    const handleBackgroundPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (!enableDrawing || !activeStrokePoints) return;
        if (activePointerIdRef.current !== null && activePointerIdRef.current !== e.pointerId) return;

        if (typeof e.currentTarget.hasPointerCapture === "function" && e.currentTarget.hasPointerCapture(e.pointerId)) {
            try {
                e.currentTarget.releasePointerCapture(e.pointerId);
            } catch {
                // Ignore release capture errors
            }
        }
        activePointerIdRef.current = null;

        if (activeStrokePoints.length >= 2) {
            addDrawingStroke(activeStrokePoints, activePenColor, activePenWidth);
        }
        setActiveStrokePoints(null);
    }, [enableDrawing, activeStrokePoints, activePenColor, activePenWidth, addDrawingStroke]);

    const handleBackgroundPointerCancel = useCallback(() => {
        activePointerIdRef.current = null;
        if (!enableDrawing) return;
        setActiveStrokePoints(null);
    }, [enableDrawing]);

    // Mouse wheel scale & rotation gesture handler
    const handleWheelGesture = useCallback((e: React.WheelEvent<HTMLDivElement>, item: OverlayItem) => {
        e.preventDefault();
        e.stopPropagation();

        if (e.shiftKey) {
            // Shift + Scroll: Rotate in radians
            const rotDelta = e.deltaY > 0 ? (5 * Math.PI) / 180 : (-5 * Math.PI) / 180;
            let nextRot = (item.rotationRadians || 0) + rotDelta;
            if (nextRot < 0) nextRot += 2 * Math.PI;
            if (nextRot > 2 * Math.PI) nextRot -= 2 * Math.PI;

            updateOverlay(item.id, { rotationRadians: nextRot });
        } else {
            // Scroll: Scale
            if (item.type === "sticker") {
                const scaleDelta = e.deltaY > 0 ? -0.1 : 0.1;
                const nextScale = Math.max(0.3, Math.min(4, item.scale + scaleDelta));
                updateOverlay(item.id, { scale: nextScale });
            } else if (item.type === "text") {
                const sizeDelta = e.deltaY > 0 ? -2 : 2;
                const nextSize = Math.max(16, Math.min(120, (item.fontSize || 48) + sizeDelta));
                updateOverlay(item.id, { fontSize: nextSize });
            }
        }
    }, [updateOverlay]);

    // Move drag handler using unclamped pointer mapping & initial offset
    const startMoveDrag = useCallback((e: React.PointerEvent<HTMLDivElement>, item: OverlayItem) => {
        e.preventDefault();
        e.stopPropagation();

        setSelectedOverlayId(item.id);

        const sheetEl = sheetRef.current;
        if (!sheetEl) return;

        const startPointer = mapPointerToSheetCoordinates(e, sheetEl, { clamp: false });
        if (!startPointer) return;

        const initialX = item.x;
        const initialY = item.y;

        const handlePointerMove = (moveEvent: PointerEvent) => {
            const currentPointer = mapPointerToSheetCoordinates(moveEvent, sheetEl, { clamp: false });
            if (!currentPointer) return;

            const deltaX = currentPointer.x - startPointer.x;
            const deltaY = currentPointer.y - startPointer.y;

            updateOverlay(item.id, {
                x: initialX + deltaX,
                y: initialY + deltaY,
            });
        };

        const handlePointerUp = () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerUp);
            window.removeEventListener("pointercancel", handlePointerUp);
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerUp);
        window.addEventListener("pointercancel", handlePointerUp);
    }, [setSelectedOverlayId, updateOverlay]);

    // Resize handle drag handler in design space units
    const startResizeDrag = useCallback((e: React.PointerEvent<HTMLDivElement>, item: OverlayItem) => {
        e.preventDefault();
        e.stopPropagation();

        const sheetEl = sheetRef.current;
        if (!sheetEl) return;

        const handlePointerMove = (moveEvent: PointerEvent) => {
            const norm = mapPointerToSheetCoordinates(moveEvent, sheetEl, { clamp: false });
            if (!norm) return;

            // Vector from center to pointer in design space units
            const dx = (norm.x - item.x) * OVERLAY_REFERENCE_SIZE.width;
            const dy = (norm.y - item.y) * OVERLAY_REFERENCE_SIZE.height;

            // Rotate back into unrotated coordinate space
            const angle = -(item.rotationRadians || 0);
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const localX = dx * cos - dy * sin;
            const localY = dx * sin + dy * cos;

            // Estimate scale factor relative to unrotated half-extents
            const scaleX = Math.abs(localX) / (item.baseWidth / 2);
            const scaleY = Math.abs(localY) / (item.baseHeight / 2);
            const targetScale = Math.max(scaleX, scaleY);

            const nextScale = Math.max(0.3, Math.min(4, targetScale));
            updateOverlay(item.id, { scale: nextScale });
        };

        const handlePointerUp = () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerUp);
            window.removeEventListener("pointercancel", handlePointerUp);
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerUp);
        window.addEventListener("pointercancel", handlePointerUp);
    }, [updateOverlay]);

    // Rotation handle drag handler around object center in viewport coordinates
    const startRotateDrag = useCallback((e: React.PointerEvent<HTMLDivElement>, item: OverlayItem) => {
        e.preventDefault();
        e.stopPropagation();

        const sheetEl = sheetRef.current;
        if (!sheetEl) return;

        const rect = sheetEl.getBoundingClientRect();
        const centerClientX = rect.left + item.x * rect.width;
        const centerClientY = rect.top + item.y * rect.height;

        const handlePointerMove = (moveEvent: PointerEvent) => {
            const dx = moveEvent.clientX - centerClientX;
            const dy = moveEvent.clientY - centerClientY;

            // Angle of rotation (offset by +PI/2 since rotation handle is at the top)
            let nextRot = Math.atan2(dy, dx) + Math.PI / 2;
            
            // Normalize to [0, 2pi]
            if (nextRot < 0) nextRot += 2 * Math.PI;
            if (nextRot > 2 * Math.PI) nextRot -= 2 * Math.PI;

            updateOverlay(item.id, { rotationRadians: nextRot });
        };

        const handlePointerUp = () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerUp);
            window.removeEventListener("pointercancel", handlePointerUp);
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerUp);
        window.addEventListener("pointercancel", handlePointerUp);
    }, [updateOverlay]);

    return (
        <div 
            className={`relative w-full h-full ${className}`}
            onPointerDown={handleBackgroundPointerDown}
            onPointerMove={handleBackgroundPointerMove}
            onPointerUp={handleBackgroundPointerUp}
            onPointerCancel={handleBackgroundPointerCancel}
            onLostPointerCapture={handleBackgroundPointerCancel}
        >
            {/* Standard Pure Visual Renderer */}
            <PreviewRenderer
                sheetRef={sheetRef}
                selection={selection}
                stream={stream}
                cameraStatus={cameraStatus}
                capturedPhotos={capturedPhotos}
                showMetadata={showMetadata}
                activeStrokePoints={activeStrokePoints}
                activePenColor={activePenColor}
                activePenWidth={activePenWidth}
            >
                {/* Pointer-interception layer overlay with touch-none */}
                <div className="absolute inset-0 pointer-events-none touch-none" style={{ zIndex: 10 }}>
                {overlays
                    .filter((item) => item.type !== "drawing")
                    .map((item) => {
                        const isSelected = showSelectionHandles && item.id === selectedOverlayId;
                        const wPercent = ((item.baseWidth * item.scale) / OVERLAY_REFERENCE_SIZE.width) * 100;
                        const hPercent = ((item.baseHeight * item.scale) / OVERLAY_REFERENCE_SIZE.height) * 100;

                        return (
                            <div
                                key={item.id}
                                data-overlay-item="true"
                                data-overlay-id={item.id}
                                className={`absolute select-none touch-none ${
                                    showSelectionHandles ? "pointer-events-auto cursor-move" : "pointer-events-none"
                                }`}
                                style={{
                                    left: `${item.x * 100}%`,
                                    top: `${item.y * 100}%`,
                                    width: `${wPercent}%`,
                                    height: `${hPercent}%`,
                                    transform: `translate(-50%, -50%) rotate(${item.rotationRadians}rad)`,
                                    zIndex: isSelected ? 1000 + (item.zIndex || 0) : (item.zIndex || 10),
                                }}
                                onPointerDown={(e) => showSelectionHandles && startMoveDrag(e, item)}
                                onWheel={(e) => showSelectionHandles && handleWheelGesture(e, item)}
                            >
                                {isSelected && (
                                    <>
                                        {/* Bounding Box Ring */}
                                        <div className="absolute inset-0 border-2 border-dashed border-pink-500 rounded-lg pointer-events-none" />

                                        {/* Corner Resize Handles */}
                                        <div 
                                            data-handle="resize-tl"
                                            className="absolute w-3 h-3 bg-white border border-pink-500 rounded-full cursor-nwse-resize -left-1.5 -top-1.5 pointer-events-auto touch-none"
                                            onPointerDown={(e) => startResizeDrag(e, item)}
                                        />
                                        <div 
                                            data-handle="resize-tr"
                                            className="absolute w-3 h-3 bg-white border border-pink-500 rounded-full cursor-nesw-resize -right-1.5 -top-1.5 pointer-events-auto touch-none"
                                            onPointerDown={(e) => startResizeDrag(e, item)}
                                        />
                                        <div 
                                            data-handle="resize-bl"
                                            className="absolute w-3 h-3 bg-white border border-pink-500 rounded-full cursor-nesw-resize -left-1.5 -bottom-1.5 pointer-events-auto touch-none"
                                            onPointerDown={(e) => startResizeDrag(e, item)}
                                        />
                                        <div 
                                            data-handle="resize-br"
                                            className="absolute w-3 h-3 bg-white border border-pink-500 rounded-full cursor-nwse-resize -right-1.5 -bottom-1.5 pointer-events-auto touch-none"
                                            onPointerDown={(e) => startResizeDrag(e, item)}
                                        />

                                        {/* Rotation Handle */}
                                        <div className="absolute w-0.5 h-4 bg-pink-500 -top-4 left-1/2 -translate-x-1/2 pointer-events-none" />
                                        <div 
                                            data-handle="rotate"
                                            className="absolute w-4 h-4 bg-white border-2 border-pink-500 rounded-full cursor-grab active:cursor-grabbing -top-8 left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-auto shadow-sm touch-none"
                                            onPointerDown={(e) => startRotateDrag(e, item)}
                                            title="Drag to rotate"
                                        >
                                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-pink-500">
                                                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                                            </svg>
                                        </div>

                                        {/* Quick Delete / Duplicate UI Overlay Actions below item */}
                                        <div className="absolute flex gap-2 -bottom-10 left-1/2 -translate-x-1/2 pointer-events-auto z-30 touch-none">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    duplicateOverlay(item.id);
                                                }}
                                                className="bg-blue-500 text-white rounded-full p-1.5 shadow-lg hover:bg-blue-600 hover:scale-105 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
                                                title="Duplicate"
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                                </svg>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    removeOverlay(item.id);
                                                }}
                                                className="bg-red-500 text-white rounded-full p-1.5 shadow-lg hover:bg-red-600 hover:scale-105 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
                                                title="Delete"
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                    <polyline points="3 6 5 6 21 6" />
                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                </svg>
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        );
                    })}
            </div>
            </PreviewRenderer>
        </div>
    );
}
