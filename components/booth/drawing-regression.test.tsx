import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { PreviewRenderer } from "./preview-renderer";
import { EditablePreview } from "@/components/customize/editable-preview";
import { clampOverlayPosition, measureTextOverlay } from "@/types/customization";
import { composePhotoLayout } from "@/services/render/layout-compositor.service";
import { defaultBoothSelection } from "@/config/theme.config";
import { BoothSessionProvider, BoothSessionContext } from "./booth-session-context";

describe("Drawing & Typography Parity Regression Lock", () => {
    afterEach(() => {
        cleanup();
    });

    const selectionWithCustomizations = {
        ...defaultBoothSelection,
        customization: {
            stickerItems: [],
            textLabels: [
                {
                    id: "txt-1",
                    text: "HELLO WORLD",
                    x: 0.5,
                    y: 0.8,
                    color: "#ff0000",
                    fontSize: 48,
                    rotationDegrees: 10,
                }
            ],
            drawingStrokes: [
                {
                    id: "stroke-1",
                    color: "#00ff00",
                    width: 0.009,
                    points: [
                        { x: 0.1, y: 0.1 },
                        { x: 0.2, y: 0.2 }
                    ]
                }
            ],
            overlays: [
                {
                    id: "txt-1",
                    type: "text" as const,
                    content: "HELLO WORLD",
                    x: 0.5,
                    y: 0.8,
                    baseWidth: 200,
                    baseHeight: 50,
                    scale: 1,
                    rotationRadians: (10 * Math.PI) / 180,
                    rotationDegrees: 10,
                    opacity: 1,
                    color: "#ff0000",
                    fontSize: 48,
                    zIndex: 20,
                },
                {
                    id: "stroke-1",
                    type: "drawing" as const,
                    x: 0,
                    y: 0,
                    baseWidth: 1000,
                    baseHeight: 1500,
                    scale: 1,
                    rotationRadians: 0,
                    rotationDegrees: 0,
                    opacity: 1,
                    color: "#00ff00",
                    points: [
                        { x: 0.1, y: 0.1 },
                        { x: 0.2, y: 0.2 }
                    ],
                    zIndex: 5,
                }
            ]
        }
    };

    it("renders drawing strokes as SVG path elements in PreviewRenderer", () => {
        render(
            <PreviewRenderer
                selection={selectionWithCustomizations}
                capturedPhotos={[]}
            />
        );

        // Verify the SVG path exists for the drawing stroke with correct properties
        const path = document.querySelector("svg path");
        expect(path).toBeTruthy();
        expect(path?.getAttribute("stroke")).toBe("#00ff00");
        expect(path?.getAttribute("d")).toBe("M 180 120 L 360 240");
    });

    it("renders text overlays with outlined text-shadow styling and no black background pills", () => {
        render(
            <PreviewRenderer
                selection={selectionWithCustomizations}
                capturedPhotos={[]}
            />
        );

        const textElement = screen.getByText("HELLO WORLD");
        expect(textElement).toBeTruthy();
        
        // Verify styling outline textShadow is applied
        const style = window.getComputedStyle(textElement);
        expect(style.textShadow).toMatch(/rgba?\(0,\s*0,\s*0,\s*0\.8\)/);
        
        // Verify no black pill wrapper class is present
        expect(textElement.className).not.toContain("bg-black/60");
        expect(textElement.className).not.toContain("rounded-full");
    });

    it("captures pointer dragging on EditablePreview sheet background to record new drawing strokes", () => {
        let contextVal: any = null;
        const TestComponent = () => {
            const ctx = React.useContext(BoothSessionContext);
            contextVal = ctx;
            return null;
        };

        const { container } = render(
            <BoothSessionProvider initialSelection={defaultBoothSelection}>
                <TestComponent />
                <EditablePreview
                    enableDrawing={true}
                    activePenColor="#f59e0b"
                />
            </BoothSessionProvider>
        );

        const previewContainer = container.querySelector(".relative.w-full.h-full");
        expect(previewContainer).toBeTruthy();

        if (previewContainer) {
            // Mock getBoundingClientRect for coordinates calculation
            vi.spyOn(previewContainer, "getBoundingClientRect").mockReturnValue({
                left: 10,
                top: 20,
                width: 1000,
                height: 1000,
                right: 1010,
                bottom: 1020,
                x: 10,
                y: 20,
                toJSON: () => {}
            });

            // Start drawing
            fireEvent.pointerDown(previewContainer, { clientX: 110, clientY: 120 });
            // Move pointer
            fireEvent.pointerMove(previewContainer, { clientX: 210, clientY: 220 });
            // Release pointer
            fireEvent.pointerUp(previewContainer, { clientX: 210, clientY: 220 });

            // Expect committed stroke in context
            const overlays = contextVal.selection.customization.overlays;
            const drawingOverlay = overlays.find((o: any) => o.type === "drawing");
            expect(drawingOverlay).toBeTruthy();
            expect(drawingOverlay.color).toBe("#f59e0b");
            expect(drawingOverlay.points).toEqual([
                { x: 0.1, y: 0.1 },
                { x: 0.2, y: 0.2 }
            ]);
        }
    });

    it("composites drawing strokes and outline text labels inside layout compositor correctly", async () => {
        const canvasCtxMock = {
            save: vi.fn(),
            restore: vi.fn(),
            translate: vi.fn(),
            rotate: vi.fn(),
            beginPath: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            stroke: vi.fn(),
            strokeText: vi.fn(),
            fillText: vi.fn(),
            measureText: vi.fn(() => ({ width: 100 })),
            clearRect: vi.fn(),
            fillRect: vi.fn(),
        };

        const canvasMock = {
            width: 1200,
            height: 1800,
            getContext: () => canvasCtxMock,
            toBlob: (cb: any) => cb(new Blob()),
        };

        const result = await composePhotoLayout({
            sources: [],
            createImage: async () => ({ naturalWidth: 600, naturalHeight: 900 } as any),
            createCanvas: () => canvasMock as any,
            layoutId: "2x2",
            renderConfig: {
                layout: { id: "2x2", name: "2x2", columns: 2, rows: 2, shotCount: 0, outputWidth: 1200, outputHeight: 1800, description: "", orientation: "portrait" as const },
                theme: { id: "classic", name: "Classic", description: "", backgroundColor: "#fff", textColor: "#000", accentColor: "#00f" },
                frame: { id: "none", name: "None", description: "", borderColor: "transparent", borderWidth: 0, kind: "none" },
                style: { id: "none", name: "None", description: "", mode: "none" },
                overlays: [
                    {
                        id: "stroke-1",
                        type: "drawing",
                        x: 0,
                        y: 0,
                        baseWidth: 1000,
                        baseHeight: 1500,
                        scale: 1,
                        rotationRadians: 0,
                        rotationDegrees: 0,
                        opacity: 1,
                        color: "#00ff00",
                        points: [
                            { x: 0.1, y: 0.1 },
                            { x: 0.2, y: 0.2 }
                        ],
                        zIndex: 5
                    },
                    {
                        id: "txt-1",
                        type: "text",
                        content: "HAPPY",
                        x: 0.5,
                        y: 0.9,
                        baseWidth: 200,
                        baseHeight: 50,
                        scale: 1,
                        rotationRadians: 0,
                        rotationDegrees: 0,
                        opacity: 1,
                        color: "#ff0000",
                        fontSize: 48,
                        zIndex: 20
                    }
                ],
                assetManifest: { stickerUrls: [], capturedPhotoBlobs: [], fontDescriptors: [] },
                outputWidth: 1200,
                outputHeight: 1800
            }
        });

        expect(result).toBeTruthy();
        
        // Verify text outline stroke & fill was drawn
        expect(canvasCtxMock.strokeText).toHaveBeenCalledWith("HAPPY", 0, 0);
        expect(canvasCtxMock.fillText).toHaveBeenCalledWith("HAPPY", 0, 0);

        // Verify drawing stroke path was drawn
        expect(canvasCtxMock.moveTo).toHaveBeenCalledWith(120, 180); // 0.1 * 1200, 0.1 * 1800
        expect(canvasCtxMock.lineTo).toHaveBeenCalledWith(240, 360); // 0.2 * 1200, 0.2 * 1800
        expect(canvasCtxMock.stroke).toHaveBeenCalled();
    });

    it("verifies overlay selection click triggers selectedOverlayId in context", () => {
        let contextVal: any = null;
        const TestComponent = () => {
            const ctx = React.useContext(BoothSessionContext);
            contextVal = ctx;
            return null;
        };

        const selection = {
            ...defaultBoothSelection,
            customization: {
                ...defaultBoothSelection.customization,
                    overlays: [
                        {
                            id: "sticker-1",
                            type: "sticker" as const,
                            content: "sparkle-heart",
                            x: 0.5,
                            y: 0.5,
                            scale: 1,
                            baseWidth: 150,
                            baseHeight: 150,
                            rotationRadians: 0,
                            rotationDegrees: 0,
                            opacity: 1,
                            zIndex: 10,
                        }
                    ]
            }
        };

        const { container } = render(
            <BoothSessionProvider initialSelection={selection}>
                <TestComponent />
                <EditablePreview />
            </BoothSessionProvider>
        );

        const stickerItem = container.querySelector('[data-overlay-id="sticker-1"]');
        expect(stickerItem).toBeTruthy();

        if (stickerItem) {
            fireEvent.pointerDown(stickerItem);
            expect(contextVal.selectedOverlayId).toBe("sticker-1");
        }
    });

    it("verifies pointer dragging updates overlay coordinates in context", () => {
        let contextVal: any = null;
        const TestComponent = () => {
            const ctx = React.useContext(BoothSessionContext);
            contextVal = ctx;
            return null;
        };

        const selection = {
            ...defaultBoothSelection,
            customization: {
                ...defaultBoothSelection.customization,
                    overlays: [
                        {
                            id: "sticker-1",
                            type: "sticker" as const,
                            content: "sparkle-heart",
                            x: 0.5,
                            y: 0.5,
                            scale: 1,
                            baseWidth: 150,
                            baseHeight: 150,
                            rotationRadians: 0,
                            rotationDegrees: 0,
                            opacity: 1,
                            zIndex: 10,
                        }
                    ]
            }
        };

        const { container } = render(
            <BoothSessionProvider initialSelection={selection}>
                <TestComponent />
                <EditablePreview />
            </BoothSessionProvider>
        );

        const previewContainer = container.querySelector(".relative.w-full.h-full");
        expect(previewContainer).toBeTruthy();
        
        if (previewContainer) {
            vi.spyOn(previewContainer, "getBoundingClientRect").mockReturnValue({
                left: 0,
                top: 0,
                width: 100,
                height: 100,
                right: 100,
                bottom: 100,
                x: 0,
                y: 0,
                toJSON: () => {}
            });
        }

        const stickerItem = container.querySelector('[data-overlay-id="sticker-1"]');
        expect(stickerItem).toBeTruthy();

        const { act } = require("@testing-library/react");

        if (stickerItem) {
            act(() => {
                // Pointer down to start drag
                fireEvent.pointerDown(stickerItem, { clientX: 50, clientY: 50 });

                // Pointer move to (60, 70)
                const moveEvent = new PointerEvent("pointermove", { clientX: 60, clientY: 70 });
                window.dispatchEvent(moveEvent);
            });

            const updatedSticker = contextVal.selection.customization.overlays.find((o: any) => o.id === "sticker-1");
            expect(updatedSticker.x).toBe(0.6);
            expect(updatedSticker.y).toBe(0.7);

            act(() => {
                // Stop drag
                const upEvent = new PointerEvent("pointerup");
                window.dispatchEvent(upEvent);
            });
        }
    });

    it("verifies mouse wheel scaling and shift-wheel rotation", () => {
        let contextVal: any = null;
        const TestComponent = () => {
            const ctx = React.useContext(BoothSessionContext);
            contextVal = ctx;
            return null;
        };

        const selection = {
            ...defaultBoothSelection,
            customization: {
                ...defaultBoothSelection.customization,
                    overlays: [
                        {
                            id: "sticker-1",
                            type: "sticker" as const,
                            content: "sparkle-heart",
                            x: 0.5,
                            y: 0.5,
                            scale: 1,
                            baseWidth: 150,
                            baseHeight: 150,
                            rotationDegrees: 0,
                            rotationRadians: 0,
                            opacity: 1,
                            zIndex: 10,
                        }
                    ]
            }
        };

        const { container } = render(
            <BoothSessionProvider initialSelection={selection}>
                <TestComponent />
                <EditablePreview />
            </BoothSessionProvider>
        );

        const stickerItem = container.querySelector('[data-overlay-id="sticker-1"]');
        expect(stickerItem).toBeTruthy();

        if (stickerItem) {
            // Scale down (scroll down)
            fireEvent.wheel(stickerItem, { deltaY: 100, shiftKey: false });
            let updatedSticker = contextVal.selection.customization.overlays.find((o: any) => o.id === "sticker-1");
            expect(updatedSticker.scale).toBeCloseTo(0.9);

            // Rotate clockwise (shift + scroll down)
            fireEvent.wheel(stickerItem, { deltaY: 100, shiftKey: true });
            updatedSticker = contextVal.selection.customization.overlays.find((o: any) => o.id === "sticker-1");
            expect(updatedSticker.rotationRadians).toBeCloseTo(0.087266, 3); // ~5 deg in rad
        }
    });

    it("verifies duplicateOverlay and removeOverlay context action functions work correctly", () => {
        let contextVal: any = null;
        const TestComponent = () => {
            const ctx = React.useContext(BoothSessionContext);
            contextVal = ctx;
            return null;
        };

        const selection = {
            ...defaultBoothSelection,
            customization: {
                ...defaultBoothSelection.customization,
                    stickerItems: [
                        {
                            id: "item-to-dup",
                            stickerId: "party-popper",
                            x: 0.2,
                            y: 0.2,
                            scale: 1,
                            rotationDegrees: 15,
                        }
                    ]
            }
        };

        const { act } = require("@testing-library/react");

        render(
            <BoothSessionProvider initialSelection={selection}>
                <TestComponent />
            </BoothSessionProvider>
        );

        expect(contextVal).toBeTruthy();
        expect(contextVal.selection.customization.overlays).toHaveLength(1);

        // Perform duplicate
        act(() => {
            contextVal.duplicateOverlay("item-to-dup");
        });

        expect(contextVal.selection.customization.overlays).toHaveLength(2);
        const duplicated = contextVal.selection.customization.overlays.find((o: any) => o.id !== "item-to-dup");
        expect(duplicated).toBeTruthy();
        expect(duplicated.content).toBe("party-popper");
        expect(duplicated.x).toBeCloseTo(0.23);
        expect(duplicated.y).toBeCloseTo(0.23);

        // Perform delete on the duplicate
        act(() => {
            contextVal.removeOverlay(duplicated.id);
        });
        expect(contextVal.selection.customization.overlays).toHaveLength(1);
    });

    it("verifies boundary clamping handles oversized rotated overlays safely", () => {
        const baseWidth = 900;
        const baseHeight = 1400;
        const scale = 1.0;
        const rotationRadians = Math.PI / 4;
        
        const clamped = clampOverlayPosition(0.5, 0.5, baseWidth, baseHeight, scale, rotationRadians);
        
        expect(clamped.x).toBe(0.5);
        expect(clamped.y).toBe(0.5);
        expect(Number.isNaN(clamped.x)).toBe(false);
        expect(Number.isNaN(clamped.y)).toBe(false);
    });

    it("verifies text measurement recalculation works with typography changes", () => {
        const size1 = measureTextOverlay("LOVE", "Arial", 48, 0, 0);
        const size2 = measureTextOverlay("Chúc mừng kỷ niệm 3 năm ngày cưới", "Arial", 48, 0, 0);
        
        expect(size2.width).toBeGreaterThan(size1.width);
    });
});
