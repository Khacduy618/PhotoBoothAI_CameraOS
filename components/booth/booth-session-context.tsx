"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { CameraProvider, useCameraContext } from "@/components/camera/camera-provider";
import type { CameraController } from "@/hooks/use-camera";
import type { BoothSelection, CapturedPhoto } from "@/types/theme";
import type {
    StickerCustomization,
    TextLabelCustomization,
    OverlayItem,
    OverlayType,
    AddOverlayOptions,
    OverlayPatch,
    TextOverlay,
    StickerOverlay,
} from "@/types/customization";
import {
    OVERLAY_REFERENCE_SIZE,
    getRotatedHalfExtents,
    clampAxis,
    clampOverlayPosition,
    measureTextOverlay,
} from "@/types/customization";

export type SetupStep = string;

export type BoothPhase =
    | "idle"
    | "setup"
    | "capture"
    | "processing"
    | "customize"
    | "generating"
    | "result"
    | "printing"
    | "done";

interface BoothSessionContextValue {
    selection: BoothSelection;
    setSelection: React.Dispatch<React.SetStateAction<BoothSelection>>;
    updateSelection: (patch: Partial<BoothSelection>) => void;
    setTheme: (themeId: string) => void;
    setFrame: (frameId: string, defaultColor?: string) => void;
    setFrameColor: (color: string) => void;
    setStyle: (styleId: string) => void;
    addSticker: (stickerId: string, x?: number, y?: number) => void;
    updateSticker: (id: string, patch: Partial<StickerCustomization>) => void;
    removeSticker: (id: string) => void;
    addTextLabel: (text: string, color?: string) => void;
    updateTextLabel: (id: string, patch: Partial<TextLabelCustomization>) => void;
    removeTextLabel: (id: string) => void;
    addOverlay: (
        type: OverlayType,
        content: string,
        options?: AddOverlayOptions
    ) => void;
    updateOverlay: (id: string, patch: OverlayPatch) => void;
    removeOverlay: (id: string) => void;
    addDrawingStroke: (points: readonly DrawingStrokePoint[], color: string, strokeWidth?: number) => void;
    undoDrawingStroke: () => void;
    clearDrawingStrokes: () => void;
    selectedOverlayId: string | null;
    setSelectedOverlayId: (id: string | null) => void;
    duplicateOverlay: (id: string) => void;
    bringOverlayToFront: (id: string) => void;
    sendOverlayToBack: (id: string) => void;
    phase: BoothPhase;
    setPhase: (phase: BoothPhase) => void;
    activeStep: SetupStep;
    setActiveStep: (step: SetupStep) => void;
    selectionComplete: boolean;
    setSelectionComplete: (complete: boolean) => void;
    capturedPhotos: CapturedPhoto[];
    setCapturedPhotos: React.Dispatch<React.SetStateAction<CapturedPhoto[]>>;
    camera: CameraController;
}

export const BoothSessionContext = createContext<BoothSessionContextValue | null>(null);

import type { BoothOutputCustomization, DrawingStrokePoint, DrawingStroke } from "@/types/customization";

function syncCustomization(
    customization: BoothOutputCustomization
): BoothOutputCustomization {
    const hasStickers = customization.stickerItems && customization.stickerItems.length > 0;
    const hasTexts = customization.textLabels && customization.textLabels.length > 0;
    const hasDrawingStrokes = customization.drawingStrokes && customization.drawingStrokes.length > 0;
    const hasOverlays = customization.overlays && customization.overlays.length > 0;

    if (hasOverlays) {
        const mappedOverlays = customization.overlays!.map((item) => {
            const rotRad = item.rotationRadians !== undefined ? item.rotationRadians : ((item.rotationDegrees || 0) * Math.PI) / 180;
            const opacity = item.opacity !== undefined ? item.opacity : 1;
            
            if (item.type === "sticker") {
                return {
                    ...item,
                    baseWidth: item.baseWidth ?? 150,
                    baseHeight: item.baseHeight ?? 150,
                    rotationRadians: rotRad,
                    rotationDegrees: Math.round((rotRad * 180) / Math.PI),
                    opacity,
                    flipX: (item as any).flipX ?? false,
                    flipY: (item as any).flipY ?? false,
                };
            } else if (item.type === "text") {
                const fontFamily = (item as any).fontFamily || "sans-serif";
                const fontSize = (item as any).fontSize || 48;
                const letterSpacing = (item as any).letterSpacing || 0;
                const outlineWidth = (item as any).outlineWidth || 0;
                const measured = measureTextOverlay(
                    item.content,
                    fontFamily,
                    fontSize,
                    letterSpacing,
                    outlineWidth
                );
                return {
                    ...item,
                    baseWidth: item.baseWidth ?? measured.width,
                    baseHeight: item.baseHeight ?? measured.height,
                    rotationRadians: rotRad,
                    rotationDegrees: Math.round((rotRad * 180) / Math.PI),
                    opacity,
                    color: (item as any).color || "#ffffff",
                    fontFamily,
                    fontSize,
                    align: (item as any).align || "center",
                    letterSpacing,
                    outlineColor: (item as any).outlineColor || "#000000",
                    outlineWidth,
                    shadowPreset: (item as any).shadowPreset || "none",
                };
            } else if (item.type === "drawing") {
                return {
                    ...item,
                    x: item.x ?? 0,
                    y: item.y ?? 0,
                    baseWidth: item.baseWidth ?? OVERLAY_REFERENCE_SIZE.width,
                    baseHeight: item.baseHeight ?? OVERLAY_REFERENCE_SIZE.height,
                    rotationRadians: rotRad,
                    rotationDegrees: 0,
                    opacity,
                    scale: item.scale ?? 1,
                    points: item.points || [],
                    color: (item as any).color || "#ffffff",
                    brushType: (item as any).brushType || "pen",
                    strokeWidth: (item as any).strokeWidth || 9,
                };
            }
            return item;
        }) as OverlayItem[];

        // Also sync back to legacy properties to keep them in sync
        const stickerItems: StickerCustomization[] = [];
        const textLabels: TextLabelCustomization[] = [];
        const drawingStrokes: DrawingStroke[] = [];

        mappedOverlays.forEach((item) => {
            const rotRad = item.rotationRadians !== undefined ? item.rotationRadians : (((item.rotationDegrees || 0) * Math.PI) / 180);
            const degrees = Math.round((rotRad * 180) / Math.PI);
            if (item.type === "sticker") {
                stickerItems.push({
                    id: item.id,
                    stickerId: item.content,
                    x: item.x,
                    y: item.y,
                    scale: item.scale,
                    rotationDegrees: degrees,
                });
            } else if (item.type === "text") {
                textLabels.push({
                    id: item.id,
                    text: item.content,
                    x: item.x,
                    y: item.y,
                    color: item.color || "#ffffff",
                    fontSize: item.fontSize || 48,
                    rotationDegrees: degrees,
                    fontFamily: item.fontFamily,
                    fontWeight: item.fontWeight,
                    outlineColor: item.outlineColor,
                    outlineWidth: item.outlineWidth,
                    shadowPreset: item.shadowPreset,
                    letterSpacing: item.letterSpacing,
                    align: item.align,
                    scale: item.scale,
                    opacity: item.opacity,
                } as unknown as TextLabelCustomization);
            } else if (item.type === "drawing") {
                drawingStrokes.push({
                    id: item.id,
                    color: item.color || "#ffffff",
                    width: item.strokeWidth || 9,
                    points: item.points || [],
                });
            }
        });

        return {
            ...customization,
            overlays: mappedOverlays,
            stickerItems,
            textLabels,
            drawingStrokes,
        };
    }

    // If overlays are empty but legacy lists exist, build overlays
    if (hasStickers || hasTexts || hasDrawingStrokes) {
        const overlays: OverlayItem[] = [];
        if (customization.stickerItems) {
            customization.stickerItems.forEach((sticker, idx) => {
                const rotRad = ((sticker.rotationDegrees || 0) * Math.PI) / 180;
                overlays.push({
                    id: sticker.id,
                    type: "sticker",
                    content: sticker.stickerId,
                    x: sticker.x,
                    y: sticker.y,
                    baseWidth: 150,
                    baseHeight: 150,
                    scale: sticker.scale,
                    rotationRadians: rotRad,
                    rotationDegrees: sticker.rotationDegrees,
                    zIndex: 600 + idx,
                    opacity: 1,
                    flipX: false,
                    flipY: false,
                });
            });
        }
        if (customization.textLabels) {
            customization.textLabels.forEach((label, idx) => {
                const rotRad = ((label.rotationDegrees || 0) * Math.PI) / 180;
                const fontFamily = "sans-serif";
                const fontSize = label.fontSize || 48;
                const letterSpacing = 0;
                const outlineWidth = 0;
                const measured = measureTextOverlay(label.text, fontFamily, fontSize, letterSpacing, outlineWidth);
                overlays.push({
                    id: label.id,
                    type: "text",
                    content: label.text,
                    x: label.x,
                    y: label.y,
                    baseWidth: measured.width,
                    baseHeight: measured.height,
                    scale: 1,
                    rotationRadians: rotRad,
                    rotationDegrees: label.rotationDegrees,
                    color: label.color || "#ffffff",
                    fontFamily,
                    fontSize,
                    align: "center",
                    letterSpacing,
                    outlineColor: "#000000",
                    outlineWidth,
                    shadowPreset: "none",
                    zIndex: 700 + idx,
                    opacity: 1,
                });
            });
        }
        if (customization.drawingStrokes) {
            customization.drawingStrokes.forEach((stroke, idx) => {
                overlays.push({
                    id: stroke.id,
                    type: "drawing",
                    x: 0,
                    y: 0,
                    baseWidth: OVERLAY_REFERENCE_SIZE.width,
                    baseHeight: OVERLAY_REFERENCE_SIZE.height,
                    scale: 1,
                    rotationRadians: 0,
                    rotationDegrees: 0,
                    color: stroke.color || "#ffffff",
                    points: stroke.points || [],
                    zIndex: 500 + idx,
                    opacity: 1,
                    brushType: "pen",
                    strokeWidth: stroke.width || 9,
                });
            });
        }
        return {
            ...customization,
            overlays,
        };
    }

    return customization;
}interface BoothSessionProviderProps {
    initialSelection: BoothSelection;
    children: React.ReactNode;
}

function InnerBoothSessionProvider({
    initialSelection,
    children,
}: BoothSessionProviderProps) {
    const [selection, rawSetSelection] = useState<BoothSelection>(() => {
        const initialWithCustom = initialSelection || {
            themeId: "",
            frameId: "none",
            styleId: "none",
            layoutId: "2x2",
            countdownSeconds: 3,
            customization: { stickerItems: [], textLabels: [], drawingStrokes: [], overlays: [] },
        };
        return {
            ...initialWithCustom,
            customization: syncCustomization(initialWithCustom.customization),
        };
    });

    const setSelection = useCallback((value: React.SetStateAction<BoothSelection>) => {
        rawSetSelection((prev) => {
            const resolved = typeof value === "function" ? value(prev) : value;
            return {
                ...resolved,
                customization: syncCustomization(resolved.customization),
            };
        });
    }, []);

    const [phase, setPhase] = useState<BoothPhase>("setup");
    const [activeStep, setActiveStep] = useState<SetupStep>("layout");
    const [selectionComplete, setSelectionComplete] = useState(false);
    const [capturedPhotos, setCapturedPhotos] = useState<CapturedPhoto[]>([]);
    const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);

    const camera = useCameraContext()!;

    const updateSelection = useCallback((patch: Partial<BoothSelection>) => {
        setSelection((prev) => ({ ...prev, ...patch }));
    }, [setSelection]);

    const setTheme = useCallback((themeId: string) => {
        setSelection((prev) => ({ ...prev, themeId }));
    }, [setSelection]);

    const setFrame = useCallback((frameId: string, defaultColor?: string) => {
        setSelection((prev) => ({
            ...prev,
            frameId,
            frameColor: defaultColor ?? prev.frameColor,
        }));
    }, [setSelection]);

    const setFrameColor = useCallback((frameColor: string) => {
        setSelection((prev) => ({ ...prev, frameColor }));
    }, [setSelection]);

    const setStyle = useCallback((styleId: string) => {
        setSelection((prev) => ({ ...prev, styleId }));
    }, [setSelection]);

    // --- Phase 2: Unified Overlay Actions ---
    const addOverlay = useCallback(
        (
            type: OverlayType,
            content: string,
            options?: AddOverlayOptions
        ) => {
            const newId = `${type}-${Date.now()}-${Math.random()}`;
            
            setSelection((prev) => {
                const overlays = prev.customization.overlays || [];
                
                // Enforce limit of 4 stickers / texts
                if (type === "sticker" && overlays.filter(o => o.type === "sticker").length >= 4) {
                    return prev;
                }
                if (type === "text" && overlays.filter(o => o.type === "text").length >= 4) {
                    return prev;
                }
                
                let baseWidth = 150;
                let baseHeight = 150;
                const scale = options?.scale ?? 1;
                const rotationRadians = options?.rotationRadians ?? (options?.rotationDegrees !== undefined ? (options.rotationDegrees * Math.PI) / 180 : 0);
                const rotationDegrees = Math.round((rotationRadians * 180) / Math.PI);
                const opacity = options?.opacity ?? 1;
                
                let newOverlay: OverlayItem;
                
                if (type === "sticker") {
                    const stickerCount = overlays.filter(o => o.type === "sticker").length;
                    const defaultX = 0.3 + (stickerCount % 2) * 0.4;
                    const defaultY = 0.3 + Math.floor(stickerCount / 2) * 0.35;
                    const zIndex = options?.zIndex ?? (600 + stickerCount);
                    newOverlay = {
                        id: newId,
                        type: "sticker",
                        content,
                        x: options?.x ?? defaultX,
                        y: options?.y ?? defaultY,
                        baseWidth,
                        baseHeight,
                        scale,
                        rotationRadians,
                        rotationDegrees,
                        zIndex,
                        opacity,
                        flipX: options?.flipX ?? false,
                        flipY: options?.flipY ?? false,
                    };
                } else if (type === "text") {
                    const textCount = overlays.filter(o => o.type === "text").length;
                    const defaultX = 0.5;
                    const defaultY = 0.85 - (textCount % 4) * 0.12;
                    const zIndex = options?.zIndex ?? (700 + textCount);
                    const color = options?.color ?? "#ffffff";
                    const fontFamily = options?.fontFamily ?? "sans-serif";
                    const fontSize = options?.fontSize ?? 48;
                    const align = options?.align ?? "center";
                    const letterSpacing = options?.letterSpacing ?? 0;
                    const outlineColor = options?.outlineColor ?? "#000000";
                    const outlineWidth = options?.outlineWidth ?? 0;
                    const shadowPreset = options?.shadowPreset ?? "none";
                    
                    const measured = measureTextOverlay(content, fontFamily, fontSize, letterSpacing, outlineWidth);
                    baseWidth = measured.width;
                    baseHeight = measured.height;
                    
                    newOverlay = {
                        id: newId,
                        type: "text",
                        content,
                        x: options?.x ?? defaultX,
                        y: options?.y ?? defaultY,
                        baseWidth,
                        baseHeight,
                        scale,
                        rotationRadians,
                        rotationDegrees,
                        zIndex,
                        opacity,
                        color,
                        fontFamily,
                        fontSize,
                        align,
                        letterSpacing,
                        outlineColor,
                        outlineWidth,
                        shadowPreset,
                    };
                } else {
                    const zIndex = options?.zIndex ?? (500 + overlays.filter(o => o.type === "drawing").length);
                    newOverlay = {
                        id: newId,
                        type: "drawing",
                        x: options?.x ?? 0,
                        y: options?.y ?? 0,
                        baseWidth: OVERLAY_REFERENCE_SIZE.width,
                        baseHeight: OVERLAY_REFERENCE_SIZE.height,
                        scale: 1,
                        rotationRadians: 0,
                        rotationDegrees: 0,
                        zIndex,
                        opacity,
                        points: options?.points ?? [],
                        color: options?.color ?? "#ffffff",
                        brushType: options?.brushType ?? "pen",
                        strokeWidth: options?.strokeWidth ?? 9,
                    };
                }
                
                // Position clamping for new overlays
                const clamped = clampOverlayPosition(
                    newOverlay.x,
                    newOverlay.y,
                    newOverlay.baseWidth ?? 150,
                    newOverlay.baseHeight ?? 150,
                    newOverlay.scale,
                    newOverlay.rotationRadians ?? 0
                );
                newOverlay.x = clamped.x;
                newOverlay.y = clamped.y;
                
                // Auto-select
                setTimeout(() => setSelectedOverlayId(newId), 0);
                
                return {
                    ...prev,
                    customization: {
                        ...prev.customization,
                        overlays: [...overlays, newOverlay],
                    },
                };
            });
        },
        [setSelection]
    );

    const updateOverlay = useCallback(
        (id: string, patch: OverlayPatch) => {
            setSelection((prev) => {
                const overlays = prev.customization.overlays || [];
                const updated = overlays.map((item) => {
                    if (item.id !== id) return item;
                    
                    // Merge fields
                    const merged = { ...item, ...patch } as OverlayItem;
                    
                    // If text and contents or typography changed, measure new derived size
                    if (merged.type === "text") {
                        const measured = measureTextOverlay(
                            merged.content,
                            merged.fontFamily || "sans-serif",
                            merged.fontSize || 48,
                            merged.letterSpacing || 0,
                            merged.outlineWidth || 0
                        );
                        merged.baseWidth = measured.width;
                        merged.baseHeight = measured.height;
                    }
                    
                    // Synchronize degrees to radians or vice-versa
                    if (patch.rotationRadians !== undefined) {
                        merged.rotationDegrees = Math.round((patch.rotationRadians * 180) / Math.PI);
                    } else if (patch.rotationDegrees !== undefined) {
                        merged.rotationRadians = (patch.rotationDegrees * Math.PI) / 180;
                    }
                    
                    // Clamp boundaries
                    const clamped = clampOverlayPosition(
                        merged.x,
                        merged.y,
                        merged.baseWidth,
                        merged.baseHeight,
                        merged.scale,
                        merged.rotationRadians ?? 0
                    );
                    merged.x = clamped.x;
                    merged.y = clamped.y;
                    
                    return merged;
                });
                
                // Keep legacy stickerItems and textLabels strictly in sync to prevent snap-back jumps
                const updatedStickers = (prev.customization.stickerItems || []).map((s) => {
                    const matchingOverlay = updated.find((o) => o.id === s.id && o.type === "sticker");
                    if (!matchingOverlay) return s;
                    return {
                        ...s,
                        x: matchingOverlay.x,
                        y: matchingOverlay.y,
                        scale: matchingOverlay.scale,
                        rotationDegrees: matchingOverlay.rotationDegrees ?? Math.round(((matchingOverlay.rotationRadians || 0) * 180) / Math.PI),
                    };
                });

                const updatedTexts = (prev.customization.textLabels || []).map((t) => {
                    const matchingOverlay = updated.find((o): o is TextOverlay => o.id === t.id && o.type === "text");
                    if (!matchingOverlay) return t;
                    const ext = t as unknown as Partial<TextOverlay>;
                    return {
                        ...t,
                        x: matchingOverlay.x,
                        y: matchingOverlay.y,
                        scale: matchingOverlay.scale,
                        rotationDegrees: matchingOverlay.rotationDegrees ?? Math.round(((matchingOverlay.rotationRadians || 0) * 180) / Math.PI),
                        color: matchingOverlay.color || t.color,
                        fontSize: matchingOverlay.fontSize || t.fontSize,
                        fontFamily: matchingOverlay.fontFamily || ext.fontFamily,
                        fontWeight: matchingOverlay.fontWeight || ext.fontWeight,
                        outlineColor: matchingOverlay.outlineColor || ext.outlineColor,
                        outlineWidth: matchingOverlay.outlineWidth || ext.outlineWidth,
                        shadowPreset: matchingOverlay.shadowPreset || ext.shadowPreset,
                        letterSpacing: matchingOverlay.letterSpacing || ext.letterSpacing,
                        align: matchingOverlay.align || ext.align,
                    };
                });

                return {
                    ...prev,
                    customization: {
                        ...prev.customization,
                        overlays: updated,
                        stickerItems: updatedStickers,
                        textLabels: updatedTexts,
                    },
                };
            });
        },
        [setSelection]
    );

    const removeOverlay = useCallback(
        (id: string) => {
            setSelection((prev) => ({
                ...prev,
                customization: {
                    ...prev.customization,
                    overlays: (prev.customization.overlays || []).filter((item) => item.id !== id),
                    stickerItems: (prev.customization.stickerItems || []).filter((item) => item.id !== id),
                    textLabels: (prev.customization.textLabels || []).filter((item) => item.id !== id),
                },
            }));
            setSelectedOverlayId((prev) => (prev === id ? null : prev));
        },
        [setSelection]
    );

    const duplicateOverlay = useCallback((id: string) => {
        setSelection((prev) => {
            const overlays = prev.customization.overlays || [];
            const item = overlays.find((o) => o.id === id);
            if (!item) return prev;
            
            // Limit checks
            if (item.type === "sticker" && overlays.filter(o => o.type === "sticker").length >= 4) {
                return prev;
            }
            if (item.type === "text" && overlays.filter(o => o.type === "text").length >= 4) {
                return prev;
            }
            
            const newId = crypto.randomUUID();
            const zIndexBase = item.type === "sticker" ? 600 : item.type === "text" ? 700 : 500;
            const newZIndex = zIndexBase + overlays.filter(o => o.type === item.type).length;
            
            // Duplicate offset + clamping
            const doubleOffset = clampOverlayPosition(
                item.x + 0.03,
                item.y + 0.03,
                item.baseWidth,
                item.baseHeight,
                item.scale,
                item.rotationRadians ?? 0
            );
            
            const newItem = {
                ...item,
                id: newId,
                x: doubleOffset.x,
                y: doubleOffset.y,
                zIndex: newZIndex,
            } as OverlayItem;
            
            // Auto-select duplicate
            setTimeout(() => setSelectedOverlayId(newId), 0);
            
            return {
                ...prev,
                customization: {
                    ...prev.customization,
                    overlays: [...overlays, newItem],
                },
            };
        });
    }, [setSelection]);

    const bringOverlayToFront = useCallback((id: string) => {
        setSelection((prev) => {
            const overlays = prev.customization.overlays || [];
            const item = overlays.find((o) => o.id === id);
            if (!item || item.type === "drawing") return prev;
            
            const type = item.type;
            const baseZ = type === "sticker" ? 600 : 700;
            const sameType = overlays.filter((o) => o.type === type).sort((a, b) => a.zIndex - b.zIndex);
            const otherTypes = overlays.filter((o) => o.type !== type);
            
            const targetIdx = sameType.findIndex((o) => o.id === id);
            if (targetIdx === -1) return prev;
            
            const [target] = sameType.splice(targetIdx, 1);
            sameType.push(target);
            
            const mapped = sameType.map((o, index) => ({
                ...o,
                zIndex: baseZ + index,
            }));
            
            return {
                ...prev,
                customization: {
                    ...prev.customization,
                    overlays: [...otherTypes, ...mapped] as OverlayItem[],
                },
            };
        });
    }, [setSelection]);

    const sendOverlayToBack = useCallback((id: string) => {
        setSelection((prev) => {
            const overlays = prev.customization.overlays || [];
            const item = overlays.find((o) => o.id === id);
            if (!item || item.type === "drawing") return prev;
            
            const type = item.type;
            const baseZ = type === "sticker" ? 600 : 700;
            const sameType = overlays.filter((o) => o.type === type).sort((a, b) => a.zIndex - b.zIndex);
            const otherTypes = overlays.filter((o) => o.type !== type);
            
            const targetIdx = sameType.findIndex((o) => o.id === id);
            if (targetIdx === -1) return prev;
            
            const [target] = sameType.splice(targetIdx, 1);
            sameType.unshift(target);
            
            const mapped = sameType.map((o, index) => ({
                ...o,
                zIndex: baseZ + index,
            }));
            
            return {
                ...prev,
                customization: {
                    ...prev.customization,
                    overlays: [...otherTypes, ...mapped] as OverlayItem[],
                },
            };
        });
    }, [setSelection]);

    // --- Legacy wrappers for tests/backward compatibility ---
    const addSticker = useCallback(
        (stickerId: string, x = 0.5, y = 0.5) => {
            addOverlay("sticker", stickerId, { x, y, scale: 1, rotationDegrees: 0 });
        },
        [addOverlay]
    );

    const updateSticker = useCallback(
        (id: string, patch: Partial<StickerCustomization>) => {
            updateOverlay(id, patch as OverlayPatch);
        },
        [updateOverlay]
    );

    const removeSticker = useCallback(
        (id: string) => {
            removeOverlay(id);
        },
        [removeOverlay]
    );

    const addTextLabel = useCallback(
        (text: string, color = "#ffffff") => {
            addOverlay("text", text, { color, fontSize: 48, rotationDegrees: 0 });
        },
        [addOverlay]
    );

    const updateTextLabel = useCallback(
        (id: string, patch: Partial<TextLabelCustomization>) => {
            updateOverlay(id, patch as OverlayPatch);
        },
        [updateOverlay]
    );

    const removeTextLabel = useCallback(
        (id: string) => {
            removeOverlay(id);
        },
        [removeOverlay]
    );
    const addDrawingStroke = useCallback(
        (points: readonly DrawingStrokePoint[], color: string, strokeWidth = 9) => {
            const newStroke: OverlayItem = {
                id: crypto.randomUUID(),
                type: "drawing",
                x: 0,
                y: 0,
                baseWidth: OVERLAY_REFERENCE_SIZE.width,
                baseHeight: OVERLAY_REFERENCE_SIZE.height,
                scale: 1,
                rotationRadians: 0,
                rotationDegrees: 0,
                zIndex: 500 + (selection.customization.overlays || []).filter(o => o.type === "drawing").length,
                opacity: 1,
                points,
                color,
                brushType: "pen",
                strokeWidth,
            };
            setSelection((prev) => ({
                ...prev,
                customization: {
                    ...prev.customization,
                    overlays: [...(prev.customization.overlays || []), newStroke],
                },
            }));
        },
        [setSelection, selection.customization.overlays]
    );

    const undoDrawingStroke = useCallback(() => {
        setSelection((prev) => {
            const drawingOverlays = (prev.customization.overlays || []).filter((o) => o.type === "drawing");
            if (drawingOverlays.length === 0) return prev;
            const lastDrawingId = drawingOverlays[drawingOverlays.length - 1].id;
            return {
                ...prev,
                customization: {
                    ...prev.customization,
                    overlays: (prev.customization.overlays || []).filter((o) => o.id !== lastDrawingId),
                },
            };
        });
    }, [setSelection]);

    const clearDrawingStrokes = useCallback(() => {
        setSelection((prev) => ({
            ...prev,
            customization: {
                ...prev.customization,
                overlays: (prev.customization.overlays || []).filter((o) => o.type !== "drawing"),
            },
        }));
    }, [setSelection]);

    return (
        <BoothSessionContext.Provider
            value={{
                selection,
                setSelection,
                updateSelection,
                setTheme,
                setFrame,
                setFrameColor,
                setStyle,
                addSticker,
                updateSticker,
                removeSticker,
                addTextLabel,
                updateTextLabel,
                removeTextLabel,
                addOverlay,
                updateOverlay,
                removeOverlay,
                addDrawingStroke,
                undoDrawingStroke,
                clearDrawingStrokes,
                selectedOverlayId,
                setSelectedOverlayId,
                duplicateOverlay,
                bringOverlayToFront,
                sendOverlayToBack,
                phase,
                setPhase,
                activeStep,
                setActiveStep,
                selectionComplete,
                setSelectionComplete,
                capturedPhotos,
                setCapturedPhotos,
                camera,
            }}
        >
            {children}
        </BoothSessionContext.Provider>
    );
}

export function BoothSessionProvider({
    initialSelection,
    children,
}: BoothSessionProviderProps) {
    const cameraContext = useCameraContext();

    if (!cameraContext) {
        return (
            <CameraProvider>
                <InnerBoothSessionProvider initialSelection={initialSelection}>
                    {children}
                </InnerBoothSessionProvider>
            </CameraProvider>
        );
    }

    return (
        <InnerBoothSessionProvider initialSelection={initialSelection}>
            {children}
        </InnerBoothSessionProvider>
    );
}

export function useBoothSession() {
    const context = useContext(BoothSessionContext);
    if (!context) {
        throw new Error("useBoothSession must be used within a BoothSessionProvider");
    }
    return context;
}
