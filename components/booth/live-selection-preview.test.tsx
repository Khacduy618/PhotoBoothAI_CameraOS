import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LiveSelectionPreview } from "@/components/booth/live-selection-preview";
import { defaultBoothSelection } from "@/config/theme.config";
import type { CameraController } from "@/hooks/use-camera";

const cameraControllerMock = {
    adapter: {
        connect: vi.fn(),
        disconnect: vi.fn(),
        getStream: vi.fn(() => null),
        capture: vi.fn(),
    },
    stream: null,
    devices: [],
    error: null,
    status: "idle" as const,
    isConnecting: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
    loadDevices: vi.fn(),
} as unknown as CameraController;

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
                    ...defaultBoothSelection,
                    themeId: "party",
                    frameId: "gold",
                    styleId: "warm",
                }}
                camera={cameraControllerMock}
            />,
        );

        expect(screen.getByText("Realtime setup preview")).toBeTruthy();
        expect(
            screen.getByText(
                "Layout: 2x2 · 4 ảnh · Countdown: 3s",
            ),
        ).toBeTruthy();
        expect(
            screen.getByText(
                "Theme: Party · Khung: Viền vàng · Style: Warm",
            ),
        ).toBeTruthy();
        expect(screen.getByText("Style preview: Warm")).toBeTruthy();
        expect(screen.getByText("Camera: IDLE")).toBeTruthy();
    });

    it("renders selected sticker and text presets on the realtime preview", () => {
        render(
            <LiveSelectionPreview
                selection={{
                    ...defaultBoothSelection,
                    customization: {
                        stickerItems: [
                            {
                                id: "setup-sticker-preset",
                                stickerId: "party-popper",
                                x: 0.78,
                                y: 0.2,
                                scale: 1,
                                rotationDegrees: -8,
                            },
                        ],
                        textLabels: [
                            {
                                id: "setup-text-preset",
                                text: "Best Day Ever",
                                x: 0.5,
                                y: 0.88,
                                color: "#ffffff",
                                fontSize: 42,
                                rotationDegrees: 0,
                            },
                        ],
                        drawingStrokes: [],
                    },
                }}
                camera={cameraControllerMock}
            />,
        );

        expect(screen.getByLabelText("Sticker preview Tiệc vui")).toBeTruthy();
        expect(screen.getByText("🎉")).toBeTruthy();
        expect(screen.getByText("Best Day Ever")).toBeTruthy();
    });

    it("connects shared camera on mount when no stream exists", () => {
        const connect = vi.fn();

        render(
            <LiveSelectionPreview
                selection={{
                    ...defaultBoothSelection,
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
                    ...defaultBoothSelection,
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
