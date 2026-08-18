import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { createAdminEvent, resetAdminRegistryStoreForTests, saveAdminFrame } from "@/services/admin/server/admin-registry-store";
import type { FrameDefinition } from "@/services/frame-import/frame-import.types";
import { DELETE, GET, PATCH, POST } from "./route";

let tempDir: string;

const frame: FrameDefinition = {
    id: "route_frame_1",
    name: "Route Frame",
    kind: "png-overlay",
    source: "canva",
    assetUrl: "data:image/png;base64,test",
    shotCount: 1,
    outputWidth: 1200,
    outputHeight: 1800,
    slots: [{ id: "slot_1", index: 0, x: 0.1, y: 0.1, width: 0.8, height: 0.8 }],
};

function makeRequest(url: string, init?: RequestInit): NextRequest {
    return new NextRequest(new Request(url, init));
}

describe("admin frame API route", () => {
    beforeEach(() => {
        tempDir = mkdtempSync(path.join(tmpdir(), "cameraos-admin-route-"));
        process.env.CAMERAOS_DATA_DIR = tempDir;
        resetAdminRegistryStoreForTests();
    });

    afterEach(() => {
        resetAdminRegistryStoreForTests();
        rmSync(tempDir, { recursive: true, force: true });
        delete process.env.CAMERAOS_DATA_DIR;
    });

    it("allows frame mutation without admin token", async () => {
        const event = createAdminEvent("Route Event");
        const response = await POST(makeRequest("http://localhost/api/admin/frames", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ eventId: event.eventId, frame }),
        }));

        expect(response.status).toBe(200);
    });

    it("allows plain admin GET without admin token", async () => {
        const response = await GET(makeRequest("http://localhost/api/admin/frames"));
        expect(response.status).toBe(200);
    });

    it("saves frames and published reads exclude private frames", async () => {
        const event = createAdminEvent("Route Event");
        const postResponse = await POST(makeRequest("http://localhost/api/admin/frames", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ eventId: event.eventId, frame }),
        }));
        expect(postResponse.status).toBe(200);
        saveAdminFrame({ ...frame, id: "route_private", status: "private" }, event.eventId);

        const response = await GET(makeRequest(`http://localhost/api/admin/frames?eventId=${event.eventId}&published=1`));
        const payload = await response.json() as { frames: FrameDefinition[] };

        expect(payload.frames.map((item) => item.id)).toEqual(["route_frame_1"]);
    });

    it("rejects frame PATCH and DELETE without eventId", async () => {
        const patchResponse = await PATCH(makeRequest("http://localhost/api/admin/frames", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ frameId: "route_frame_1", status: "private" }),
        }));
        expect(patchResponse.status).toBe(400);

        const deleteResponse = await DELETE(makeRequest("http://localhost/api/admin/frames?frameId=route_frame_1", {
            method: "DELETE",
        }));
        expect(deleteResponse.status).toBe(400);
    });
});
