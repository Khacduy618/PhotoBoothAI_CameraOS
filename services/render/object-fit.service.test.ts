import { describe, expect, it } from "vitest";

import { calculateObjectFitRect } from "./object-fit.service";

describe("calculateObjectFitRect", () => {
    it("contains a Canon-like 3:2 landscape image inside a portrait slot without cropping", () => {
        const rect = calculateObjectFitRect({
            imageWidth: 6000,
            imageHeight: 4000,
            targetX: 0,
            targetY: 0,
            targetWidth: 1200,
            targetHeight: 1800,
            fit: "contain",
        });

        expect(rect.width).toBe(1200);
        expect(rect.height).toBe(800);
        expect(rect.x).toBe(0);
        expect(rect.y).toBe(500);
    });

    it("covers a 3:2 image by expanding beyond the slot when crop mode is explicit", () => {
        const rect = calculateObjectFitRect({
            imageWidth: 6000,
            imageHeight: 4000,
            targetX: 0,
            targetY: 0,
            targetWidth: 1200,
            targetHeight: 1800,
            fit: "cover",
        });

        expect(rect.width).toBe(2700);
        expect(rect.height).toBe(1800);
        expect(rect.x).toBe(-750);
        expect(rect.y).toBe(0);
    });
});
