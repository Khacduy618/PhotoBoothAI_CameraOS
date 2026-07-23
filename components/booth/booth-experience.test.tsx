import {
    cleanup,
    fireEvent,
    render,
    screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const cameraControllerMock = vi.hoisted(() => ({
    adapter: {
        connect: vi.fn(),
        disconnect: vi.fn(),
        getStream: vi.fn(() => null),
        capture: vi.fn(),
    },
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
    window.sessionStorage.clear();
    cameraPreviewMock.mockClear();
});

describe("BoothExperience", () => {
    it("does not mount camera preview before setup is complete", async () => {
        render(<BoothExperience />);

        expect(
            await screen.findByText("Chọn số ảnh, khung có lề vẽ 60px"),
        ).toBeTruthy();
        expect(
            screen.queryByText("Camera preview mounted"),
        ).toBeNull();
        expect(cameraPreviewMock).not.toHaveBeenCalled();
    });

    it("mounts camera preview with the selected fixed-8s setup after setup is complete", async () => {
        render(<BoothExperience />);

        await screen.findByText("Chọn số ảnh, khung có lề vẽ 60px");

        fireEvent.click(screen.getByText("2 ảnh stacked"));
        fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
        expect(screen.getByText(/2 ảnh · Đếm ngược 8 giây/i)).toBeTruthy();

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
                selection: expect.objectContaining({
                    layoutId: "stacked-2-4x6-portrait",
                    countdownSeconds: 8,
                    frameId: "none",
                    styleId: "none",
                }),
                camera: cameraControllerMock,
                onBackToSetup: expect.any(Function),
            }),
            undefined,
        );
    });

    it("can return from preview to setup without losing the simplified selection", async () => {
        render(<BoothExperience />);

        await screen.findByText("Chọn số ảnh, khung có lề vẽ 60px");

        fireEvent.click(screen.getByText("2 ảnh stacked"));
        fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
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
            screen.getByText("Chọn số ảnh, khung có lề vẽ 60px"),
        ).toBeTruthy();
        expect(screen.getByDisplayValue("stacked-2-4x6-portrait")).toBeTruthy();
        expect(screen.queryByText("Khung & Style")).toBeNull();
        expect(screen.queryByText("Nhãn Sticker")).toBeNull();
        expect(screen.queryByText("Thêm Text")).toBeNull();
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
                selection: expect.objectContaining({
                    themeId: "party",
                    frameId: "gold",
                    styleId: "warm",
                }),
            }),
            undefined,
        );
    });
});
