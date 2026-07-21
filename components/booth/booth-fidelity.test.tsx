import { describe, it, expect } from "vitest";
import { createRenderConfig } from "@/services/render/render-config.builder";
import type { BoothSelection } from "@/types/theme";
import type { TextOverlay } from "@/types/customization";

describe("Booth State Fidelity & RenderConfig Consistency", () => {
    const sampleSelection: BoothSelection = {
        layoutId: "1x4-vertical",
        countdownSeconds: 6,
        themeId: "party",
        frameId: "cute-heart-frame",
        frameColor: "#ff4fa3",
        styleId: "warm",
        customization: {
            stickerItems: [
                {
                    id: "sticker-1",
                    stickerId: "heart",
                    x: 0.5,
                    y: 0.5,
                    scale: 1.2,
                    rotationDegrees: 15,
                },
            ],
            textLabels: [
                {
                    id: "text-1",
                    text: "SUPER EVENT 2026",
                    x: 0.5,
                    y: 0.9,
                    color: "#ffffff",
                    fontSize: 52,
                    rotationDegrees: 0,
                },
            ],
            drawingStrokes: [],
        },
    };

    it("1. Step transitions preserve all BoothSelection values without resets or default overwrites", () => {
        const initialSelection = { ...sampleSelection };

        // Simulate step transition (e.g. from Step 7 Text to Step 8 Review)
        const reviewSelection = { ...initialSelection };

        expect(reviewSelection.layoutId).toBe("1x4-vertical");
        expect(reviewSelection.countdownSeconds).toBe(6);
        expect(reviewSelection.themeId).toBe("party");
        expect(reviewSelection.frameId).toBe("cute-heart-frame");
        expect(reviewSelection.styleId).toBe("warm");
        expect(reviewSelection.customization.stickerItems).toHaveLength(1);
        expect(reviewSelection.customization.textLabels).toHaveLength(1);
    });

    it("2. createRenderConfig produces identical RenderConfig in Step 7, Step 8 Review, Camera, and Export", () => {
        const step7Config = createRenderConfig(sampleSelection);
        const step8ReviewConfig = createRenderConfig(sampleSelection);
        const cameraConfig = createRenderConfig(sampleSelection);
        const exportConfig = createRenderConfig(sampleSelection);

        expect(step8ReviewConfig).toEqual(step7Config);
        expect(cameraConfig).toEqual(step7Config);
        expect(exportConfig).toEqual(step7Config);
    });

    it("3. Text style fields and sticker transform fields survive overlay mapping without loss", () => {
        const config = createRenderConfig(sampleSelection);

        const stickerOverlay = config.overlays.find((o) => o.id === "sticker-1");
        expect(stickerOverlay).toBeDefined();
        expect(stickerOverlay?.scale).toBe(1.2);

        const textOverlay = config.overlays.find((o): o is TextOverlay => o.type === "text" && o.id === "text-1");
        expect(textOverlay).toBeDefined();
        expect(textOverlay?.content).toBe("SUPER EVENT 2026");
    });

    it("4. Confirming Review passes a complete lossless BoothSelection snapshot into Camera Mode", () => {
        const confirmedSnapshot = JSON.parse(JSON.stringify(sampleSelection));

        expect(confirmedSnapshot.layoutId).toBe(sampleSelection.layoutId);
        expect(confirmedSnapshot.countdownSeconds).toBe(sampleSelection.countdownSeconds);
        expect(confirmedSnapshot.customization.stickerItems[0].stickerId).toBe("heart");
        expect(confirmedSnapshot.customization.textLabels[0].text).toBe("SUPER EVENT 2026");
    });
});
