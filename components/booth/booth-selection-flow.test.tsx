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

afterEach(() => {
    cleanup();
});

describe("simplified booth selection config", () => {
    it("provides safe defaults for the fixed-8s shot selection flow", () => {
        expect(themeConfigs.length).toBeGreaterThanOrEqual(2);
        expect(frameConfigs.length).toBeGreaterThanOrEqual(2);
        expect(styleConfigs[0].id).toBe("none");
        expect(defaultBoothSelection.layoutId).toBe("single-4x6-landscape");
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
                layoutId: "single-4x6-landscape",
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

        expect(normalized.layoutId).toBe("single-4x6-landscape");
        expect(normalized.countdownSeconds).toBe(8);
    });

    it("maps approved shot-count layouts to requested output surfaces", () => {
        expect(boothLayoutConfigs.map((layout) => layout.shotCount)).toEqual([1, 2, 4, 4, 6, 8]);
        expect(countdownSecondOptions).toEqual([8]);
        expect(resolveBoothLayoutConfig("single-4x6-landscape")).toEqual(
            expect.objectContaining({ shotCount: 1, outputWidth: 1800, outputHeight: 1200, orientation: "landscape" }),
        );
        expect(resolveBoothLayoutConfig("stacked-2-4x6-portrait")).toEqual(
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
    it("starts at shot selection, hides sticker/text setup, and continues with fixed 8s", () => {
        const onSelectionChange = vi.fn();
        const onComplete = vi.fn();

        const { rerender } = render(
            <BoothSelectionFlow
                selection={defaultBoothSelection}
                camera={cameraControllerMock}
                onSelectionChange={onSelectionChange}
                onComplete={onComplete}
            />,
        );

        expect(screen.getByText("Live preview single-4x6-landscape/8/stickers:0/text:0")).toBeTruthy();
        expect(screen.queryByText("Chọn Nhãn dán Sticker")).toBeNull();
        expect(screen.queryByText("Thêm Text")).toBeNull();
        expect(screen.queryByText("3s")).toBeNull();
        expect(screen.queryByText("6s")).toBeNull();
        expect(screen.queryByText("10s")).toBeNull();

        fireEvent.click(screen.getByText("2 ảnh stacked"));
        expect(onSelectionChange).toHaveBeenCalledWith({
            ...defaultBoothSelection,
            layoutId: "stacked-2-4x6-portrait",
            countdownSeconds: 8,
            customization: {
                ...defaultBoothSelection.customization,
                stickerItems: [],
                textLabels: [],
                overlays: [],
            },
        });

        rerender(
            <BoothSelectionFlow
                selection={{ ...defaultBoothSelection, layoutId: "stacked-2-4x6-portrait" }}
                camera={cameraControllerMock}
                onSelectionChange={onSelectionChange}
                onComplete={onComplete}
            />,
        );

        fireEvent.click(screen.getByRole("button", { name: /Tiếp/i }));
        expect(screen.getByText(/2 ảnh · Đếm ngược 8 giây/i)).toBeTruthy();

        fireEvent.click(screen.getByRole("button", { name: /Tiếp tục vào camera/i }));
        expect(onComplete).toHaveBeenCalledTimes(1);
    });
});
