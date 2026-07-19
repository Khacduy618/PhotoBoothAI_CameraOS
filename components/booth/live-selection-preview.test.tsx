import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LiveSelectionPreview } from "@/components/booth/live-selection-preview";

const cameraControllerMock = {
    adapter: {},
    stream: null,
    devices: [],
    error: null,
    status: "idle" as const,
    isConnecting: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
    loadDevices: vi.fn(),
};

beforeEach(() => {
    vi.spyOn(
        HTMLMediaElement.prototype,
        "play",
    ).mockResolvedValue(undefined);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("LiveSelectionPreview", () => {
    it("shows realtime setup preview metadata for the selected theme, frame, and style", () => {
        render(
            <LiveSelectionPreview
                selection={{
                    themeId: "party",
                    frameId: "gold",
                    styleId: "warm",
                }}
                camera={cameraControllerMock}
            />,
        );

        expect(screen.getByText("Live setup preview")).toBeTruthy();
        expect(
            screen.getByText(
                "Theme: Party · Khung: Viền vàng · Style: Warm",
            ),
        ).toBeTruthy();
        expect(screen.getByText("Style preview: Warm")).toBeTruthy();
        expect(screen.getByText("Camera: IDLE")).toBeTruthy();
    });

    it("connects shared camera on mount when no stream exists", () => {
        const connect = vi.fn();

        render(
            <LiveSelectionPreview
                selection={{
                    themeId: "classic",
                    frameId: "none",
                    styleId: "none",
                }}
                camera={{
                    ...cameraControllerMock,
                    connect,
                }}
            />,
        );

        expect(connect).toHaveBeenCalledTimes(1);
    });

    it("does not reconnect shared camera when a stream already exists", () => {
        const connect = vi.fn();

        render(
            <LiveSelectionPreview
                selection={{
                    themeId: "classic",
                    frameId: "none",
                    styleId: "none",
                }}
                camera={{
                    ...cameraControllerMock,
                    stream: {
                        getVideoTracks: vi.fn(() => []),
                        getTracks: vi.fn(() => []),
                    } as unknown as MediaStream,
                    connect,
                }}
            />,
        );

        expect(connect).not.toHaveBeenCalled();
    });
});
