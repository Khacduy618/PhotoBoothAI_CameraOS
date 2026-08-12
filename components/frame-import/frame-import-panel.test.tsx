import React from "react";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { fireEvent, render, screen, cleanup, waitFor } from "@testing-library/react";
import { FrameImportPanel } from "./FrameImportPanel";

const eventsPayload = {
    ok: true,
    events: [{ eventId: "event_hoi_an_heritage", name: "Phố Cổ Hội An", status: "active" }],
};

const framesPayload = {
    ok: true,
    frames: [{
        id: "sample-frame",
        eventId: "event_hoi_an_heritage",
        name: "Sample Frame",
        kind: "png-overlay",
        source: "canva",
        assetUrl: "data:image/png;base64,test",
        shotCount: 1,
        outputWidth: 1200,
        outputHeight: 1800,
        slots: [{ id: "slot-1", index: 0, x: 0.05, y: 0.05, width: 0.9, height: 0.9 }],
        status: "published",
    }],
};

describe("FrameImportPanel", () => {
    beforeEach(() => {
        vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.includes("/api/admin/events")) {
                return Response.json(eventsPayload);
            }
            if (url.includes("/api/admin/frames")) {
                return Response.json(framesPayload);
            }
            return Response.json({ ok: false }, { status: 404 });
        }));
    });

    afterEach(() => {
        cleanup();
        vi.unstubAllGlobals();
    });

    it("renders operator import tool header and file upload dropzone", async () => {
        render(<FrameImportPanel />);

        expect(screen.getByText(/Canva Frame Import & Registry Tool/i)).toBeDefined();
        expect(screen.getByText(/Chọn hoặc kéo thả file Canva PNG/i)).toBeDefined();
        expect(screen.getAllByText(/Đã Đăng Ký/i).length).toBeGreaterThan(0);
        await waitFor(() => expect(screen.getAllByText(/Phố Cổ Hội An/i).length).toBeGreaterThan(0));
    });

    it("shows selected event folder and SQLite-backed frame count", async () => {
        render(<FrameImportPanel />);

        await waitFor(() => expect(screen.getByText(/1 frame trong event này/i)).toBeDefined());
        fireEvent.click(screen.getByRole("button", { name: /Đã Đăng Ký/i }));
        await waitFor(() => expect(screen.getByText(/Sample Frame/i)).toBeDefined());
    });
});
