import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createAdminEvent, deleteAdminFrame, listAdminEvents, listAdminFrames, listPublishedFrames, listPublishedFramesByEvent, resetAdminRegistryStoreForTests, saveAdminFrame, updateAdminFrameStatus } from "./admin-registry-store";
import type { FrameDefinition } from "@/services/frame-import/frame-import.types";

let tempDir: string;

const sampleFrame: FrameDefinition = {
    id: "frame_test_1",
    name: "Frame Test 1",
    kind: "png-overlay",
    source: "canva",
    assetUrl: "data:image/png;base64,test",
    shotCount: 1,
    photoViewportOrientation: "portrait",
    photoAspectRatio: "2:3",
    photoFit: "contain",
    allowDraw: true,
    outputWidth: 1200,
    outputHeight: 1800,
    slots: [{ id: "slot_1", index: 0, x: 0.1, y: 0.1, width: 0.8, height: 0.7 }],
};

describe("admin registry SQLite store", () => {
    beforeEach(() => {
        tempDir = mkdtempSync(path.join(tmpdir(), "cameraos-admin-registry-"));
        process.env.CAMERAOS_DATA_DIR = tempDir;
        resetAdminRegistryStoreForTests();
    });

    afterEach(() => {
        resetAdminRegistryStoreForTests();
        delete process.env.CAMERAOS_DATA_DIR;
        try {
            rmSync(tempDir, { recursive: true, force: true });
        } catch {
            // Windows delayed lock cleanup safety
        }
    });

    it("creates manual events and stores frames inside the selected event folder", () => {
        const event = createAdminEvent("Wedding Demo");
        const frame = saveAdminFrame(sampleFrame, event.eventId);

        expect(listAdminEvents().some((item) => item.eventId === event.eventId)).toBe(true);
        expect(frame.eventId).toBe(event.eventId);
        expect(frame.allowDraw).toBe(true);
        expect(listAdminFrames(event.eventId)).toHaveLength(1);
        expect(listPublishedFramesByEvent(event.eventId)[0].id).toBe("frame_test_1");
    });

    it("keeps frames separated by event", () => {
        const eventA = createAdminEvent("Event A");
        const eventB = createAdminEvent("Event B");
        saveAdminFrame({ ...sampleFrame, id: "frame_event_a" }, eventA.eventId);
        saveAdminFrame({ ...sampleFrame, id: "frame_event_b", allowDraw: false }, eventB.eventId);

        expect(listAdminFrames(eventA.eventId).map((frame) => frame.id)).toEqual(["frame_event_a"]);
        expect(listAdminFrames(eventB.eventId).map((frame) => frame.id)).toEqual(["frame_event_b"]);
        expect(listPublishedFramesByEvent(eventB.eventId)[0].allowDraw).toBe(false);
    });

    it("allows the same public frame id in separate event folders without moving records", () => {
        const eventA = createAdminEvent("Same Frame Event A");
        const eventB = createAdminEvent("Same Frame Event B");
        saveAdminFrame({ ...sampleFrame, id: "shared_frame", name: "Shared A" }, eventA.eventId);
        saveAdminFrame({ ...sampleFrame, id: "shared_frame", name: "Shared B", allowDraw: false }, eventB.eventId);

        expect(listAdminFrames(eventA.eventId).map((frame) => `${frame.id}:${frame.name}`)).toEqual(["shared_frame:Shared A"]);
        expect(listAdminFrames(eventB.eventId).map((frame) => `${frame.id}:${frame.name}`)).toEqual(["shared_frame:Shared B"]);
    });

    it("updates and deletes same-id frames only within the selected event", () => {
        const eventA = createAdminEvent("Same Id Mutate A");
        const eventB = createAdminEvent("Same Id Mutate B");
        saveAdminFrame({ ...sampleFrame, id: "shared_mutate" }, eventA.eventId);
        saveAdminFrame({ ...sampleFrame, id: "shared_mutate" }, eventB.eventId);

        updateAdminFrameStatus("shared_mutate", "private", eventA.eventId);
        expect(listPublishedFrames(eventA.eventId)).toHaveLength(0);
        expect(listPublishedFrames(eventB.eventId).map((frame) => frame.id)).toEqual(["shared_mutate"]);

        deleteAdminFrame("shared_mutate", eventB.eventId);
        expect(listAdminFrames(eventA.eventId).map((frame) => frame.id)).toEqual(["shared_mutate"]);
        expect(listAdminFrames(eventB.eventId)).toHaveLength(0);
    });

    it("excludes private frames from published reads with and without eventId", () => {
        const event = createAdminEvent("Private Demo");
        saveAdminFrame({ ...sampleFrame, id: "frame_public" }, event.eventId);
        saveAdminFrame({ ...sampleFrame, id: "frame_private", status: "private" }, event.eventId);

        expect(listPublishedFrames(event.eventId).map((frame) => frame.id)).toEqual(["frame_public"]);
        expect(listPublishedFrames().map((frame) => frame.id)).toEqual(["frame_public"]);

        updateAdminFrameStatus("frame_public", "private", event.eventId);
        expect(listPublishedFrames(event.eventId)).toHaveLength(0);
    });

    it("rejects unsafe or malformed frame definitions", () => {
        const event = createAdminEvent("Validation Demo");
        expect(() => saveAdminFrame({ ...sampleFrame, id: "../bad" }, event.eventId)).toThrow(/frameId/);
        expect(() => saveAdminFrame({ ...sampleFrame, id: "bad_asset", assetUrl: "file:///tmp/frame.png" }, event.eventId)).toThrow(/asset URL/);
        expect(() => saveAdminFrame({ ...sampleFrame, id: "bad_slots", slots: [] }, event.eventId)).toThrow(/slot count/);
    });
});
