import {
    cleanup,
    fireEvent,
    render,
    screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const cameraControllerMock = vi.hoisted(() => ({
    adapter: {},
    stream: null,
    devices: [],
    error: null,
    status: "idle",
    isConnecting: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
    loadDevices: vi.fn(),
}));

vi.mock("@/hooks/use-camera", () => ({
    useCamera: vi.fn(() => cameraControllerMock),
}));

const cameraPreviewMock = vi.hoisted(() =>
    vi.fn(({ onBackToSetup }: { onBackToSetup?: () => void }) => (
        <button type="button" onClick={onBackToSetup}>
            Camera preview mounted
        </button>
    )),
);

vi.mock("@/components/camera/camera-preview", () => ({
    CameraPreview: cameraPreviewMock,
}));

import { BoothExperience } from "@/components/booth/booth-experience";

afterEach(() => {
    cleanup();
    window.localStorage.clear();
    cameraPreviewMock.mockClear();
});

describe("BoothExperience", () => {
    it("does not mount camera preview before setup is complete", async () => {
        render(<BoothExperience />);

        expect(
            await screen.findByText("Chọn giao diện trước khi chụp"),
        ).toBeTruthy();
        expect(
            screen.queryByText("Camera preview mounted"),
        ).toBeNull();
        expect(cameraPreviewMock).not.toHaveBeenCalled();
    });

    it("mounts camera preview with the selected values after setup is complete", async () => {
        render(<BoothExperience />);

        await screen.findByText("Chọn giao diện trước khi chụp");
        fireEvent.click(screen.getByText("Party"));
        fireEvent.click(screen.getByText("Viền vàng"));
        fireEvent.click(screen.getByText("Warm"));
        fireEvent.click(
            screen.getByRole("button", {
                name: "Tiếp tục vào camera",
            }),
        );

        expect(
            await screen.findByText("Camera preview mounted"),
        ).toBeTruthy();
        expect(cameraPreviewMock).toHaveBeenCalledWith(
            expect.objectContaining({
                selection: {
                    themeId: "party",
                    frameId: "gold",
                    styleId: "warm",
                },
                camera: cameraControllerMock,
                onBackToSetup: expect.any(Function),
            }),
            undefined,
        );
    });

    it("can return from preview to setup without losing the current selection", async () => {
        render(<BoothExperience />);

        await screen.findByText("Chọn giao diện trước khi chụp");
        fireEvent.click(screen.getByText("Party"));
        fireEvent.click(screen.getByText("Viền vàng"));
        fireEvent.click(screen.getByText("Warm"));
        fireEvent.click(
            screen.getByRole("button", {
                name: "Tiếp tục vào camera",
            }),
        );

        fireEvent.click(
            await screen.findByRole("button", {
                name: "Camera preview mounted",
            }),
        );

        expect(
            screen.getByText("Chọn giao diện trước khi chụp"),
        ).toBeTruthy();
        expect(screen.getByDisplayValue("party")).toBeTruthy();
        expect(screen.getByDisplayValue("gold")).toBeTruthy();
        expect(screen.getByDisplayValue("warm")).toBeTruthy();
    });

    it("offers active session recovery after reload", async () => {
        window.localStorage.setItem(
            "photoboothai:sessions:v1",
            JSON.stringify([
                {
                    id: "session-reload",
                    status: "active",
                    mode: "single-photo",
                    createdAt: "2026-07-19T00:00:00.000Z",
                    updatedAt: "2026-07-19T00:00:00.000Z",
                    photoIds: ["photo-1"],
                    selection: {
                        themeId: "party",
                        frameId: "gold",
                        styleId: "warm",
                    },
                },
            ]),
        );

        render(<BoothExperience />);

        expect(
            await screen.findByText("Tiếp tục phiên chụp trước?"),
        ).toBeTruthy();

        fireEvent.click(
            screen.getByRole("button", {
                name: "Tiếp tục",
            }),
        );

        expect(
            screen.getByText("Camera preview mounted"),
        ).toBeTruthy();
        expect(cameraPreviewMock).toHaveBeenCalledWith(
            expect.objectContaining({
                selection: {
                    themeId: "party",
                    frameId: "gold",
                    styleId: "warm",
                },
            }),
            undefined,
        );
    });
});
