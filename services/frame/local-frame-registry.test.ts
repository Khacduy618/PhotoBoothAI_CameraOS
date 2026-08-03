import { beforeEach, describe, expect, it } from "vitest";
import { LocalFrameRegistry } from "./local-frame-registry";
import type { FrameDefinition } from "@/services/frame-import/frame-import.types";

describe("LocalFrameRegistry", () => {
    beforeEach(() => {
        LocalFrameRegistry.clear();
    });

    const sampleDefinition: FrameDefinition = {
        id: "test-imported-frame-1",
        name: "Test Imported Frame 1",
        description: "A test imported frame",
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
            { id: "slot-1", index: 0, x: 0.05, y: 0.05, width: 0.42, height: 0.42 },
            { id: "slot-2", index: 1, x: 0.53, y: 0.05, width: 0.42, height: 0.42 },
            { id: "slot-3", index: 2, x: 0.05, y: 0.53, width: 0.42, height: 0.42 },
            { id: "slot-4", index: 3, x: 0.53, y: 0.53, width: 0.42, height: 0.42 },
        ],
    };

    it("registers and retrieves published definitions and runtime frames", () => {
        expect(LocalFrameRegistry.getPublishedDefinitions()).toHaveLength(0);
        expect(LocalFrameRegistry.getPublishedRuntimeFrames()).toHaveLength(0);

        const runtimeFrame = LocalFrameRegistry.registerFrame(sampleDefinition);

        expect(runtimeFrame.id).toBe("test-imported-frame-1");
        expect(runtimeFrame.kind).toBe("png-overlay");
        expect(runtimeFrame.slots).toHaveLength(4);

        expect(LocalFrameRegistry.getPublishedDefinitions()).toHaveLength(1);
        expect(LocalFrameRegistry.getPublishedRuntimeFrames()).toHaveLength(1);
    });

    it("removes a frame by id", () => {
        LocalFrameRegistry.registerFrame(sampleDefinition);
        expect(LocalFrameRegistry.getPublishedDefinitions()).toHaveLength(1);

        LocalFrameRegistry.removeFrame("test-imported-frame-1");
        expect(LocalFrameRegistry.getPublishedDefinitions()).toHaveLength(0);
    });

    it("notifies subscribers when frames change", () => {
        let notifiedCount = 0;
        const unsubscribe = LocalFrameRegistry.subscribe(() => {
            notifiedCount += 1;
        });

        LocalFrameRegistry.registerFrame(sampleDefinition);
        expect(notifiedCount).toBe(1);

        LocalFrameRegistry.removeFrame("test-imported-frame-1");
        expect(notifiedCount).toBe(2);

        unsubscribe();
        LocalFrameRegistry.registerFrame(sampleDefinition);
        expect(notifiedCount).toBe(2);
    });
});
