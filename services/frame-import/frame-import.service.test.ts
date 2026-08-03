import { describe, expect, it } from "vitest";

import { buildCompanionMask } from "@/services/frame-import/alpha-mask.service";
import { findConnectedComponents } from "@/services/frame-import/connected-components.service";
import { filterSlotCandidates } from "@/services/frame-import/slot-candidate-filter.service";
import { orderSlots } from "@/services/frame-import/slot-ordering.service";
import { calculateConfidence, classifyConfidence, inferShotCount } from "@/services/frame-import/confidence.service";
import { analyzeImportFrame } from "@/services/frame-import/frame-import-analyzer.service";
import { convertFrameDefinitionToRuntimeFrame } from "@/services/frame-import/frame-definition.adapter";
import type { FrameDefinition } from "@/services/frame-import/frame-import.types";

function createSyntheticFourSlotCompanionMask(width: number, height: number): Uint8Array {
    const mask = new Uint8Array(width * height);
    const marginX = 5;
    const marginY = 5;
    const slotWidth = Math.floor((width - marginX * 3) / 2);
    const slotHeight = Math.floor((height - marginY * 3) / 2);

    const rects = [
        { x: marginX, y: marginY },
        { x: marginX * 2 + slotWidth, y: marginY },
        { x: marginX, y: marginY * 2 + slotHeight },
        { x: marginX * 2 + slotWidth, y: marginY * 2 + slotHeight },
    ];

    for (const rect of rects) {
        for (let y = rect.y; y < rect.y + slotHeight; y += 1) {
            for (let x = rect.x; x < rect.x + slotWidth; x += 1) {
                mask[y * width + x] = 1;
            }
        }
    }

    return mask;
}

describe("frame import analyzer services", () => {
    it("finds and orders synthetic four-slot mask into ordered detected slots", () => {
        const width = 120;
        const height = 180;
        const mask = createSyntheticFourSlotCompanionMask(width, height);
        const normalizedMask = buildCompanionMask(mask, width, height);
        const components = findConnectedComponents(normalizedMask, width, height);
        const candidates = filterSlotCandidates(components, width, height);
        const ordered = orderSlots(candidates);

        expect(ordered.length).toBe(4);
        expect(ordered[0].order).toBe(0);
        expect(ordered[0].normalizedBounds.x).toBeLessThan(ordered[1].normalizedBounds.x);
        expect(inferShotCount(ordered.length)).toBe(4);
        expect(calculateConfidence(ordered)).toBeGreaterThanOrEqual(0.65);
        expect(classifyConfidence(calculateConfidence(ordered))).toBe("auto-approved");
    });

    it("analyzes synthetic RGBA input with transparent slots using alpha detection", () => {
        const width = 120;
        const height = 180;
        const rgba = new Uint8ClampedArray(width * height * 4);

        for (let index = 0; index < width * height; index += 1) {
            const pixel = index * 4;
            rgba[pixel] = 34;
            rgba[pixel + 1] = 64;
            rgba[pixel + 2] = 98;
            rgba[pixel + 3] = 255;
        }

        const mask = createSyntheticFourSlotCompanionMask(width, height);
        for (let index = 0; index < width * height; index += 1) {
            if (mask[index] === 1) {
                const pixel = index * 4;
                rgba[pixel + 3] = 0;
            }
        }

        const result = analyzeImportFrame({
            fileName: "synthetic-4-slot.png",
            rgba,
            width,
            height,
        });

        expect(result.sourceFileName).toBe("synthetic-4-slot.png");
        expect(result.maskSource).toBe("alpha");
        expect(result.image.hasAlpha).toBe(true);
        expect(result.analysis.candidateCount).toBeGreaterThanOrEqual(4);
        expect(result.analysis.detectedShotCount).toBe(4);
        expect(result.status).toBe("auto-approved");
    });

    it("analyzes Canva frame filled with sky-and-hills placeholder graphics", () => {
        const width = 120;
        const height = 180;
        const rgba = new Uint8ClampedArray(width * height * 4);

        for (let index = 0; index < width * height; index += 1) {
            const pixel = index * 4;
            rgba[pixel] = 20;
            rgba[pixel + 1] = 20;
            rgba[pixel + 2] = 20;
            rgba[pixel + 3] = 255;
        }

        const mask = createSyntheticFourSlotCompanionMask(width, height);
        for (let index = 0; index < width * height; index += 1) {
            if (mask[index] === 1) {
                const pixel = index * 4;
                rgba[pixel] = 188; // Canva Sky R
                rgba[pixel + 1] = 227; // Canva Sky G
                rgba[pixel + 2] = 254; // Canva Sky B
                rgba[pixel + 3] = 255;
            }
        }

        const result = analyzeImportFrame({
            fileName: "canva-sky-hills-frame.png",
            rgba,
            width,
            height,
        });

        expect(result.sourceFileName).toBe("canva-sky-hills-frame.png");
        expect(result.analysis.detectedShotCount).toBe(4);
        expect(result.status).toBe("auto-approved");
    });

    it("classifies confidence thresholds correctly", () => {
        expect(classifyConfidence(0.95)).toBe("auto-approved");
        expect(classifyConfidence(0.90)).toBe("auto-approved");
        expect(classifyConfidence(0.85)).toBe("needs-review");
        expect(classifyConfidence(0.65)).toBe("needs-review");
        expect(classifyConfidence(0.64)).toBe("rejected");
        expect(classifyConfidence(0.30)).toBe("rejected");
    });

    it("produces runtime FrameConfig with pixel slot values normalized from 0..1 definition", () => {
        const definition: FrameDefinition = {
            id: "imported-frame-4",
            name: "Imported Frame 4",
            description: "Synthetic imported frame",
            kind: "png-overlay",
            source: "canva",
            borderColor: "#ffffff",
            borderWidth: 0,
            shotCount: 4,
            photoViewportOrientation: "portrait",
            layoutFamily: "2x2",
            outputWidth: 1200,
            outputHeight: 1800,
            slots: [
                { id: "s1", index: 0, x: 0.05, y: 0.05, width: 0.42, height: 0.42, photoViewportOrientation: "portrait" },
                { id: "s2", index: 1, x: 0.53, y: 0.05, width: 0.42, height: 0.42, photoViewportOrientation: "portrait" },
                { id: "s3", index: 2, x: 0.05, y: 0.53, width: 0.42, height: 0.42, photoViewportOrientation: "portrait" },
                { id: "s4", index: 3, x: 0.53, y: 0.53, width: 0.42, height: 0.42, photoViewportOrientation: "portrait" },
            ],
        };

        const frameConfig = convertFrameDefinitionToRuntimeFrame({ definition });

        expect(frameConfig.id).toBe("imported-frame-4");
        expect(frameConfig.kind).toBe("png-overlay");
        expect(frameConfig.source).toBe("canva");
        expect(frameConfig.slots).toHaveLength(4);
        expect(frameConfig.slots?.[0]).toEqual({
            id: "s1",
            index: 0,
            x: 60,
            y: 90,
            width: 504,
            height: 756,
            photoViewportOrientation: "portrait",
        });
        expect(frameConfig.outputWidth).toBe(1200);
        expect(frameConfig.outputHeight).toBe(1800);
    });
});
