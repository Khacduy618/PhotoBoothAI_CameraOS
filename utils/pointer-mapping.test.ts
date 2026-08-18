import { describe, it, expect } from "vitest";
import { mapPointerToSheetCoordinates } from "./pointer-mapping";

describe("Pointer Mapping Utility (mapPointerToSheetCoordinates)", () => {
    const mockSheet = {
        getBoundingClientRect: () => ({
            left: 100,
            top: 200,
            width: 400,
            height: 600,
            right: 500,
            bottom: 800,
            x: 100,
            y: 200,
            toJSON: () => {},
        }),
    } as unknown as HTMLElement;

    it("1. Maps pointer at center of sheet to (0.5, 0.5)", () => {
        const pt = mapPointerToSheetCoordinates({ clientX: 300, clientY: 500 }, mockSheet);
        expect(pt).not.toBeNull();
        expect(pt?.x).toBe(0.5);
        expect(pt?.y).toBe(0.5);
    });

    it("2. Maps pointer at top-left corner (100, 200) to (0, 0)", () => {
        const pt = mapPointerToSheetCoordinates({ clientX: 100, clientY: 200 }, mockSheet);
        expect(pt).not.toBeNull();
        expect(pt?.x).toBe(0);
        expect(pt?.y).toBe(0);
    });

    it("3. Maps pointer at bottom-right corner (500, 800) to (1, 1)", () => {
        const pt = mapPointerToSheetCoordinates({ clientX: 500, clientY: 800 }, mockSheet);
        expect(pt).not.toBeNull();
        expect(pt?.x).toBe(1);
        expect(pt?.y).toBe(1);
    });

    it("4. Returns unclamped coordinates by default for move/rotate/resize delta calculation", () => {
        const pt = mapPointerToSheetCoordinates({ clientX: 50, clientY: 100 }, mockSheet, { clamp: false });
        expect(pt).not.toBeNull();
        expect(pt?.x).toBe(-0.125);
        expect(pt?.y).toBe(-0.16666666666666666);
    });

    it("5. Clamps coordinates to [0..1] when clamp: true is passed for drawing stroke points", () => {
        const pt = mapPointerToSheetCoordinates({ clientX: 50, clientY: 100 }, mockSheet, { clamp: true });
        expect(pt).not.toBeNull();
        expect(pt?.x).toBe(0);
        expect(pt?.y).toBe(0);
    });

    it("6. Returns null when sheet element is null or zero-sized", () => {
        expect(mapPointerToSheetCoordinates({ clientX: 100, clientY: 100 }, null)).toBeNull();

        const zeroSheet = {
            getBoundingClientRect: () => ({
                left: 0,
                top: 0,
                width: 0,
                height: 0,
                right: 0,
                bottom: 0,
                x: 0,
                y: 0,
                toJSON: () => {},
            }),
        } as unknown as HTMLElement;

        expect(mapPointerToSheetCoordinates({ clientX: 100, clientY: 100 }, zeroSheet)).toBeNull();
    });
});
