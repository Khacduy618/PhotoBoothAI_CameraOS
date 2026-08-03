import {
    cleanup,
    fireEvent,
    render,
    screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cameraControllerMock = vi.hoisted(() => ({
    adapter: {
        connect: vi.fn(),
        disconnect: vi.fn(),
        getStream: vi.fn(() => null),
        capture: vi.fn(),
    },
    stream: null as MediaStream | null,
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

import {
    BoothExperience,
    resolvePostCaptureDefaultFramePatch,
} from "@/components/booth/booth-experience";
import { defaultBoothSelection } from "@/config/theme.config";

beforeEach(() => {
    cameraControllerMock.stream = {} as MediaStream;
    cameraControllerMock.status = "ready";
    cameraControllerMock.error = null;
});

afterEach(() => {
    cleanup();
    window.localStorage.clear();
    window.sessionStorage.clear();
    cameraPreviewMock.mockClear();
});

describe("BoothExperience", () => {
    it("applies a default compatible frame only after enough photos are captured", () => {
        expect(resolvePostCaptureDefaultFramePatch(defaultBoothSelection, 0)).toBeNull();
        expect(resolvePostCaptureDefaultFramePatch(defaultBoothSelection, 4)).toBeNull();
        expect(resolvePostCaptureDefaultFramePatch({
            ...defaultBoothSelection,
            frameId: "gold",
        }, 4)).toBeNull();
    });

    it("waits for the selected shot count before applying the default review frame", () => {
        const twoShotSelection = {
            ...defaultBoothSelection,
            layoutId: "two-landscape-1x2" as const,
        };

        expect(resolvePostCaptureDefaultFramePatch(twoShotSelection, 1)).toBeNull();
        expect(resolvePostCaptureDefaultFramePatch(twoShotSelection, 2)).toEqual({
            frameId: "white-border-2shot-landscape",
            frameColor: "#ffffff",
        });
    });

    it("does not mount camera preview before setup is complete", async () => {
        render(<BoothExperience />);

        expect(
            await screen.findByText("Chọn số ảnh, chọn frame sau khi chụp"),
        ).toBeTruthy();
        expect(
            screen.queryByText("Camera preview mounted"),
        ).toBeNull();
        expect(cameraPreviewMock).not.toHaveBeenCalled();
    });

    it("mounts camera preview with the selected fixed-8s setup after setup is complete", async () => {
        render(<BoothExperience />);

        await screen.findByText("Chọn số ảnh, chọn frame sau khi chụp");

        fireEvent.click(screen.getByRole("button", { name: "2 shots" }));
        fireEvent.click(
            screen.getByRole("button", {
                name: "Bắt đầu chụp",
            }),
        );

        expect(
            await screen.findByText("Camera preview mounted"),
        ).toBeTruthy();
        expect(cameraPreviewMock).toHaveBeenCalledWith(
            expect.objectContaining({
                selection: expect.objectContaining({
                    layoutId: "two-landscape-1x2",
                    countdownSeconds: 8,
                    frameId: "white-border",
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

        await screen.findByText("Chọn số ảnh, chọn frame sau khi chụp");

        fireEvent.click(screen.getByRole("button", { name: "2 shots" }));
        fireEvent.click(
            screen.getByRole("button", {
                name: "Bắt đầu chụp",
            }),
        );

        fireEvent.click(
            await screen.findByRole("button", {
                name: "Camera preview mounted",
            }),
        );

        expect(
            screen.getByText("Chọn số ảnh, chọn frame sau khi chụp"),
        ).toBeTruthy();
        expect(screen.getByRole("button", { name: "2 shots" }).getAttribute("aria-pressed")).toBe("true");
        expect(screen.queryByText("Frame viền")).toBeNull();
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
