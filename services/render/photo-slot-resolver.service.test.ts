import { describe, expect, it } from "vitest";

import { resolveBoothLayoutConfig } from "@/config/layout.config";
import { getFrameCompatibility } from "@/services/frame/frame-compatibility.service";
import { resolveDefaultPhotoSlots, resolvePhotoSlots } from "@/services/render/photo-slot-resolver.service";
import type { FrameConfig } from "@/types/theme";

const layout = resolveBoothLayoutConfig("four-portrait-2x2");

const metadataSlots = [
    { id: "metadata-slot-1", index: 0, x: 100, y: 100, width: 220, height: 500 },
    { id: "metadata-slot-2", index: 1, x: 360, y: 100, width: 220, height: 500 },
    { id: "metadata-slot-3", index: 2, x: 100, y: 660, width: 220, height: 500 },
    { id: "metadata-slot-4", index: 3, x: 360, y: 660, width: 220, height: 500 },
] as const;

function createFrame(overrides: Partial<FrameConfig> = {}): FrameConfig {
    return {
        id: "metadata-frame",
        name: "Metadata frame",
        description: "Frame with authored slots",
        borderColor: "#ffffff",
        borderWidth: 0,
        kind: "png-overlay",
        source: "canva",
        shotCount: 4,
        photoViewportOrientation: "portrait",
        layoutFamily: "2x2",
        outputWidth: 1200,
        outputHeight: 1800,
        slots: metadataSlots,
        ...overrides,
    };
}

describe("frame compatibility", () => {
    it("accepts compatible metadata slots using photo viewport orientation", () => {
        expect(getFrameCompatibility(createFrame(), layout)).toEqual({ compatible: true });
    });

    it("does not require fixed frame orientation when slots match", () => {
        expect(getFrameCompatibility(createFrame({ photoViewportOrientation: undefined, orientation: undefined }), layout)).toEqual({ compatible: true });
    });

    it("keeps generic frames without metadata compatible for default-slot fallback", () => {
        expect(getFrameCompatibility(createFrame({ slots: undefined }), layout)).toEqual({ compatible: true });
    });

    it("accepts generic no-slot frames with optional constraints omitted", () => {
        expect(getFrameCompatibility(createFrame({
            slots: undefined,
            shotCount: undefined,
            photoViewportOrientation: undefined,
            orientation: undefined,
            layoutFamily: undefined,
            outputWidth: undefined,
            outputHeight: undefined,
        }), layout)).toEqual({ compatible: true });
    });

    it("rejects metadata frames with an incompatible slot count", () => {
        expect(getFrameCompatibility(createFrame({ slots: metadataSlots.slice(0, 2) }), layout)).toEqual({
            compatible: false,
            reason: "slot-count",
        });
    });

    it("rejects a mismatched photo viewport orientation", () => {
        expect(getFrameCompatibility(createFrame({ photoViewportOrientation: "landscape" }), layout)).toEqual({
            compatible: false,
            reason: "photo-viewport-orientation",
        });
    });
});

describe("photo slot resolver", () => {
    it("uses compatible metadata frame slots", () => {
        expect(resolvePhotoSlots({ layout, frame: createFrame() })).toBe(metadataSlots);
    });

    it("uses authored metadata frame slots whenever present", () => {
        const customFrame = createFrame({ outputHeight: 1200 });
        const slots = resolvePhotoSlots({
            layout,
            frame: customFrame,
        });

        expect(slots).toBe(customFrame.slots);
    });

    it("falls back to default layout slots when a frame has no metadata", () => {
        const slots = resolvePhotoSlots({
            layout,
            frame: createFrame({ slots: undefined }),
        });

        expect(slots).toEqual(resolveDefaultPhotoSlots(layout));
    });

    it("does not reduce resolved photo slot height to satisfy frame aspect ratio", () => {
        const slots = resolvePhotoSlots({ layout, frame: createFrame() });

        expect(slots[0].height).toBe(500);
    });
});
