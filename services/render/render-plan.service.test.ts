import { describe, expect, it } from "vitest";

import { resolveRenderPlan } from "@/services/render/render-plan.service";
import { createRenderConfig } from "@/services/render/render-config.builder";
import type { BoothSelection } from "@/types/theme";

function createSelection(layoutId: BoothSelection["layoutId"] = "2x2"): BoothSelection {
    return {
        themeId: "classic",
        frameId: "white-border",
        styleId: "none",
        layoutId,
        countdownSeconds: 3,
        customization: {
            stickerItems: [],
            textLabels: [],
            drawingStrokes: [],
            overlays: [
                {
                    id: "sticker-1",
                    type: "sticker",
                    content: "sparkle-heart",
                    x: 0.25,
                    y: 0.75,
                    baseWidth: 150,
                    baseHeight: 150,
                    scale: 1,
                    rotationRadians: 0,
                    rotationDegrees: 0,
                    zIndex: 10,
                    opacity: 1,
                },
            ],
        },
    };
}

describe("render plan", () => {
    it("resolves 2x2 cells in export coordinates", () => {
        const config = createRenderConfig(createSelection("2x2"));
        const plan = resolveRenderPlan(config);

        expect(plan.sheet.width).toBe(config.outputWidth);
        expect(plan.sheet.height).toBe(config.outputHeight);
        expect(plan.grid.rows).toBe(2);
        expect(plan.grid.columns).toBe(2);
        expect(plan.grid.cells).toHaveLength(4);
        expect(plan.grid.cells[0].x).toBeGreaterThan(0);
        expect(plan.grid.cells[1].x).toBeGreaterThan(plan.grid.cells[0].x);
        expect(plan.grid.cells[2].y).toBeGreaterThan(plan.grid.cells[0].y);
    });

    it("scales the same geometry proportionally for preview surfaces", () => {
        const config = createRenderConfig(createSelection("2x2"));
        const exportPlan = resolveRenderPlan(config);
        const previewPlan = resolveRenderPlan(config, {
            width: config.outputWidth / 2,
            height: config.outputHeight / 2,
            pixelRatio: 1,
            type: "preview",
        });

        expect(previewPlan.grid.gap).toBeCloseTo(exportPlan.grid.gap / 2);
        expect(previewPlan.grid.cells[0].x).toBeCloseTo(exportPlan.grid.cells[0].x / 2);
        expect(previewPlan.grid.cells[0].width).toBeCloseTo(exportPlan.grid.cells[0].width / 2);
    });

    it("preserves ordered overlay data for both preview and export renderers", () => {
        const config = createRenderConfig(createSelection("2x2"));
        const plan = resolveRenderPlan(config);

        expect(plan.overlays).toHaveLength(1);
        expect(plan.overlays[0].id).toBe("sticker-1");
    });
});
