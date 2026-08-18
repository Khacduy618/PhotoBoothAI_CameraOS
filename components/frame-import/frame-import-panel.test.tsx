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
        Object.defineProperty(window, "momentai", {
            configurable: true,
            value: {
                admin: {
                    events: {
                        list: vi.fn(async () => ({ ok: true, value: eventsPayload.events })),
                        create: vi.fn(),
                    },
                    templates: {
                        list: vi.fn(async () => ({ ok: true, value: framesPayload.frames })),
                        publish: vi.fn(async () => ({ ok: true, value: undefined })),
                        archive: vi.fn(async () => ({ ok: true, value: undefined })),
                        save: vi.fn(async () => ({ ok: true, value: undefined })),
                        remove: vi.fn(async () => ({ ok: true, value: undefined })),
                        clear: vi.fn(async () => ({ ok: true, value: undefined })),
                    },
                },
            },
        });
    });

    afterEach(() => {
        cleanup();
        vi.unstubAllGlobals();
    });

    it("renders operator import tool header and file upload dropzone", async () => {
        render(<FrameImportPanel />);

        expect(screen.getByText(/Canva frame registry/i)).toBeDefined();
        expect(screen.getByText(/PNG only · max 25 files/i)).toBeDefined();
        expect(screen.getAllByText(/Registry/i).length).toBeGreaterThan(0);
        await waitFor(() => expect(screen.getAllByText(/Phố Cổ Hội An/i).length).toBeGreaterThan(0));
    });

    it("shows selected event folder and SQLite-backed frame count", async () => {
        render(<FrameImportPanel />);

        await waitFor(() => expect(screen.getByRole("button", { name: /Registry \(1\)/i })).toBeDefined());
        fireEvent.click(screen.getByRole("button", { name: /Registry \(1\)/i }));
        await waitFor(() => expect(screen.getByText(/Sample Frame/i)).toBeDefined());
    });
});
