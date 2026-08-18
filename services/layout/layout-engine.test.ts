import { describe, expect, it } from "vitest";

import {
    boothLayoutConfigs,
    resolveBoothLayoutConfig,
    resolveDefaultLayoutIdForShotCount,
    supportedShotCounts,
} from "@/config/layout.config";
import { getPhotoCellRects } from "@/services/layout/layout-engine";

describe("layout engine target variants", () => {
    it("maps supported shot counts to approved default portrait layouts", () => {
        expect(supportedShotCounts).toEqual([1, 2, 4, 6, 8]);
        expect(resolveDefaultLayoutIdForShotCount(1)).toBe("single-portrait-1200x1800");
        expect(resolveDefaultLayoutIdForShotCount(2)).toBe("two-portrait-1x2");
        expect(resolveDefaultLayoutIdForShotCount(4)).toBe("four-portrait-2x2");
        expect(resolveDefaultLayoutIdForShotCount(6)).toBe("six-portrait-2x3");
        expect(resolveDefaultLayoutIdForShotCount(8)).toBe("eight-portrait-2x4");
        expect(resolveDefaultLayoutIdForShotCount(999)).toBe("four-portrait-2x2");
    });

    it("resolves every target layout id", () => {
        for (const layout of boothLayoutConfigs) {
            expect(resolveBoothLayoutConfig(layout.id)).toEqual(
                expect.objectContaining({ id: layout.id }),
            );
        }
    });

    it("keeps portrait photo viewport layouts on the approved output surface", () => {
        const portraitLayouts = boothLayoutConfigs.filter((layout) => layout.orientation === "portrait");

        expect(portraitLayouts.length).toBeGreaterThan(0);
        for (const layout of portraitLayouts) {
            const resolved = resolveBoothLayoutConfig(layout.id);
            expect(resolved.outputWidth).toBe(1200);
            expect(resolved.outputHeight).toBe(1800);
        }
    });

    it("keeps landscape photo viewport layouts on the approved output surface", () => {
        const landscapeLayouts = boothLayoutConfigs.filter((layout) => layout.orientation === "landscape");

        expect(landscapeLayouts.length).toBeGreaterThan(0);
        for (const layout of landscapeLayouts) {
            const resolved = resolveBoothLayoutConfig(layout.id);
            expect(resolved.outputWidth).toBe(1800);
            expect(resolved.outputHeight).toBe(1200);
        }
    });

    it("does not expose old landscape ids as active layout choices", () => {
        const activeIds = boothLayoutConfigs.map((layout) => layout.id);

        expect(activeIds).not.toContain("two-landscape-2x1");
        expect(activeIds).not.toContain("six-landscape-3x2");
        expect(activeIds).not.toContain("eight-landscape-4x2");
    });

    it("keeps corrected landscape layout ids active and safely resolves legacy aliases", () => {
        expect(resolveBoothLayoutConfig("two-landscape-1x2")).toEqual(
            expect.objectContaining({ id: "two-landscape-1x2", columns: 1, rows: 2, shotCount: 2 }),
        );
        expect(resolveBoothLayoutConfig("six-landscape-2x3")).toEqual(
            expect.objectContaining({ id: "six-landscape-2x3", columns: 2, rows: 3, shotCount: 6 }),
        );
        expect(resolveBoothLayoutConfig("eight-landscape-2x4")).toEqual(
            expect.objectContaining({ id: "eight-landscape-2x4", columns: 2, rows: 4, shotCount: 8 }),
        );

        expect(resolveBoothLayoutConfig("two-landscape-2x1").id).toBe("two-landscape-1x2");
        expect(resolveBoothLayoutConfig("six-landscape-3x2").id).toBe("six-landscape-2x3");
        expect(resolveBoothLayoutConfig("eight-landscape-4x2").id).toBe("eight-landscape-2x4");
    });

    it("uses the corrected 2x4 portrait viewport for eight photos", () => {
        expect(resolveBoothLayoutConfig("eight-portrait-2x4")).toEqual(
            expect.objectContaining({ columns: 2, rows: 4, shotCount: 8 }),
        );
    });

    it("generates portrait-oriented slots for portrait photo viewport layouts", () => {
        const portraitLayouts = boothLayoutConfigs.filter((layout) => layout.orientation === "portrait");

        for (const layout of portraitLayouts) {
            const rects = getPhotoCellRects(layout.id, layout.outputWidth, layout.outputHeight);
            for (const rect of rects) {
                expect(rect.height).toBeGreaterThan(rect.width);
            }
        }
    });

    it("generates landscape-oriented slots for landscape photo viewport layouts", () => {
        const landscapeLayouts = boothLayoutConfigs.filter((layout) => layout.orientation === "landscape");

        for (const layout of landscapeLayouts) {
            const rects = getPhotoCellRects(layout.id, layout.outputWidth, layout.outputHeight);
            for (const rect of rects) {
                expect(rect.width).toBeGreaterThan(rect.height);
            }
        }
    });

    it("fits every default slot inside the 20/20/20/100 padded safe area", () => {
        for (const layout of boothLayoutConfigs) {
            const rects = getPhotoCellRects(layout.id, layout.outputWidth, layout.outputHeight);

            for (const rect of rects) {
                expect(rect.x).toBeGreaterThanOrEqual(20);
                expect(rect.y).toBeGreaterThanOrEqual(20);
                expect(rect.x + rect.width).toBeLessThanOrEqual(layout.outputWidth - 20);
                expect(rect.y + rect.height).toBeLessThanOrEqual(layout.outputHeight - 100);
            }
        }
    });

    it("does not let frame or output aspect ratio cap resolved slot height beyond the padding area", () => {
        const singlePortrait = resolveBoothLayoutConfig("single-portrait-1200x1800");
        const rects = getPhotoCellRects(singlePortrait.id, singlePortrait.outputWidth, singlePortrait.outputHeight);

        expect(rects[0].height).toBe(singlePortrait.outputHeight - 20 - 100);
        expect(rects[0].height).toBeGreaterThan(rects[0].width);
    });
});
