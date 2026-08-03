import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CameraController } from "@/hooks/use-camera";
import type { BoothSelection } from "@/types/theme";

const liveSelectionPreviewMock = vi.hoisted(() =>
    vi.fn(({ selection }: { selection: BoothSelection }) => (
        <div>
            Live preview {selection.layoutId}/{selection.countdownSeconds}/stickers:{selection.customization.stickerItems.length}/text:{selection.customization.textLabels.length}
        </div>
    )),
);

vi.mock("@/components/booth/live-selection-preview", () => ({
    LiveSelectionPreview: liveSelectionPreviewMock,
}));

import { BoothSelectionFlow } from "@/components/booth/booth-selection-flow";
import {
    boothLayoutConfigs,
    countdownSecondOptions,
    resolveBoothLayoutConfig,
    resolveDefaultLayoutIdForShotCount,
    supportedShotCounts,
} from "@/config/layout.config";
import {
    defaultBoothSelection,
    frameConfigs,
    isBoothSelectionComplete,
    normalizeBoothSelection,
    resolveFrameConfig,
    resolveStyleConfig,
    resolveThemeConfig,
    styleConfigs,
    themeConfigs,
} from "@/config/theme.config";

function createCameraControllerMock(
    overrides: Partial<CameraController> = {},
): CameraController {
    return {
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
        ...overrides,
    } as unknown as CameraController;
}

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe("simplified booth selection config", () => {
    it("provides safe defaults for the fixed-8s shot selection flow", () => {
        expect(themeConfigs.length).toBeGreaterThanOrEqual(2);
        expect(frameConfigs.length).toBeGreaterThanOrEqual(2);
        expect(styleConfigs[0].id).toBe("none");
        expect(defaultBoothSelection.layoutId).toBe("four-landscape-2x2");
        expect(defaultBoothSelection.countdownSeconds).toBe(8);
        expect(isBoothSelectionComplete(defaultBoothSelection)).toBe(true);
    });

    it("resolves unknown ids to safe defaults", () => {
        expect(resolveThemeConfig("missing")).toEqual(themeConfigs[0]);
        expect(resolveFrameConfig("missing")).toEqual(frameConfigs[0]);
        expect(resolveStyleConfig("missing")).toEqual(styleConfigs[0]);
    });

    it("normalizes legacy restored selections to fixed 8 seconds", () => {
        const normalized = normalizeBoothSelection({
            themeId: "party",
            frameId: "gold",
            styleId: "warm",
            countdownSeconds: 3,
        });

        expect(normalized).toEqual(
            expect.objectContaining({
                themeId: "party",
                frameId: "gold",
                styleId: "warm",
                layoutId: "four-landscape-2x2",
                countdownSeconds: 8,
                frameColor: undefined,
                customization: {
                    stickerItems: [],
                    textLabels: [],
                    drawingStrokes: [],
                    overlays: [],
                },
            }),
        );
    });

    it("falls back from invalid layout and countdown values", () => {
        const normalized = normalizeBoothSelection({
            ...defaultBoothSelection,
            layoutId: "missing",
            countdownSeconds: 12,
        } as unknown as Partial<BoothSelection>);

        expect(normalized.layoutId).toBe("four-landscape-2x2");
        expect(normalized.countdownSeconds).toBe(8);
    });

    it("maps approved shot counts to default landscape layouts", () => {
        expect(supportedShotCounts).toEqual([1, 2, 4, 6, 8]);
        expect(resolveDefaultLayoutIdForShotCount(1)).toBe("single-landscape-1800x1200");
        expect(resolveDefaultLayoutIdForShotCount(2)).toBe("two-landscape-1x2");
        expect(resolveDefaultLayoutIdForShotCount(4)).toBe("four-landscape-2x2");
        expect(resolveDefaultLayoutIdForShotCount(6)).toBe("six-landscape-2x3");
        expect(resolveDefaultLayoutIdForShotCount(8)).toBe("eight-landscape-2x4");
        expect(resolveDefaultLayoutIdForShotCount(12)).toBe("four-landscape-2x2");
    });

    it("maps approved shot-count layouts to requested output surfaces", () => {
        expect(boothLayoutConfigs.map((layout) => layout.shotCount)).toEqual([1, 1, 2, 2, 4, 4, 4, 4, 6, 6, 8, 8]);
        expect(countdownSecondOptions).toEqual([8]);
        expect(resolveBoothLayoutConfig("single-portrait-1200x1800")).toEqual(
            expect.objectContaining({ shotCount: 1, outputWidth: 1200, outputHeight: 1800, orientation: "portrait", layoutFamily: "single" }),
        );
        expect(resolveBoothLayoutConfig("two-portrait-1x2")).toEqual(
            expect.objectContaining({ shotCount: 2, columns: 1, rows: 2, outputWidth: 1200, outputHeight: 1800 }),
        );
        expect(resolveBoothLayoutConfig("grid-2x2-4x6-portrait")).toEqual(
            expect.objectContaining({ shotCount: 4, columns: 2, rows: 2, outputWidth: 1200, outputHeight: 1800 }),
        );
        expect(resolveBoothLayoutConfig("stacked-4-4x6-portrait")).toEqual(
            expect.objectContaining({ shotCount: 4, columns: 1, rows: 4, outputWidth: 1200, outputHeight: 1800 }),
        );
        expect(resolveBoothLayoutConfig("grid-2x3-4x6-portrait")).toEqual(
            expect.objectContaining({ shotCount: 6, columns: 2, rows: 3, outputWidth: 1200, outputHeight: 1800 }),
        );
        expect(resolveBoothLayoutConfig("grid-2x4-4x6-portrait")).toEqual(
            expect.objectContaining({ shotCount: 8, columns: 2, rows: 4, outputWidth: 1200, outputHeight: 1800 }),
        );
    });
});

describe("BoothSelectionFlow", () => {
    it("shows shot-count-only setup, hides pre-capture customization, and starts capture", () => {
        const onSelectionChange = vi.fn();
        const onComplete = vi.fn();

        const readyCamera = createCameraControllerMock({
            stream: {} as MediaStream,
            status: "ready",
        });

        render(
            <BoothSelectionFlow
                selection={defaultBoothSelection}
                camera={readyCamera}
                onSelectionChange={onSelectionChange}
                onComplete={onComplete}
            />,
        );

        expect(screen.getByText("Camera sẵn sàng")).toBeTruthy();
        expect(screen.getByRole("button", { name: /2 shots/i })).toBeTruthy();
        expect(screen.queryByText("Chọn Layout")).toBeNull();
        expect(screen.queryByText("Chọn Nhãn dán Sticker")).toBeNull();
        expect(screen.queryByText("Thêm Text")).toBeNull();
        expect(screen.queryByText("Frame viền")).toBeNull();
        expect(screen.queryByText("Style Filter")).toBeNull();
        expect(screen.queryByText("3s")).toBeNull();
        expect(screen.queryByText("6s")).toBeNull();
        expect(screen.queryByText("10s")).toBeNull();
        expect(liveSelectionPreviewMock).not.toHaveBeenCalled();
        expect(readyCamera.connect).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole("button", { name: /2 shots/i }));
        expect(onSelectionChange).toHaveBeenCalledWith({
            ...defaultBoothSelection,
            layoutId: "two-landscape-1x2",
            countdownSeconds: 8,
            frameId: "white-border",
            frameColor: undefined,
            styleId: "none",
            customization: {
                stickerItems: [],
                textLabels: [],
                drawingStrokes: [],
                overlays: [],
            },
        });

        fireEvent.click(screen.getByRole("button", { name: /Bắt đầu chụp/i }));
        expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it("shows recoverable camera readiness and blocks capture while preview is unavailable", () => {
        const onComplete = vi.fn();
        const errorCamera = createCameraControllerMock({
            status: "error",
            error: "Camera bị trình duyệt chặn.",
        });

        render(
            <BoothSelectionFlow
                selection={defaultBoothSelection}
                camera={errorCamera}
                onComplete={onComplete}
            />,
        );

        expect(screen.getByText("Không mở được camera")).toBeTruthy();
        expect(screen.getByText("Camera bị trình duyệt chặn.")).toBeTruthy();
        expect(screen.getByText(/Touch capture fallback/i)).toBeTruthy();
        expect(screen.getByRole("button", { name: /Thử lại camera/i })).toBeTruthy();

        const startButton = screen.getByRole("button", { name: /Bắt đầu chụp/i });
        expect(startButton.hasAttribute("disabled")).toBe(true);
        fireEvent.click(startButton);
        expect(onComplete).not.toHaveBeenCalled();
    });
});
