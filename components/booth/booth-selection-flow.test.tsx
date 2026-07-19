import {
    cleanup,
    fireEvent,
    render,
    screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { BoothSelection } from "@/types/theme";

const liveSelectionPreviewMock = vi.hoisted(() =>
    vi.fn(({ selection }: { selection: BoothSelection }) => (
        <div>
            Live preview {selection.themeId}/{selection.frameId}/{selection.styleId}
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
    resolveStickerConfig,
    resolveTextLabelPresetConfig,
    stickerConfigs,
    textLabelPresetConfigs,
} from "@/config/sticker.config";
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

afterEach(() => {
    cleanup();
});

describe("theme/frame/style config", () => {
    it("provides required defaults", () => {
        expect(themeConfigs.length).toBeGreaterThanOrEqual(2);
        expect(frameConfigs.length).toBeGreaterThanOrEqual(2);
        expect(styleConfigs[0].id).toBe("none");
        expect(isBoothSelectionComplete(defaultBoothSelection)).toBe(true);
    });

    it("resolves unknown ids to safe defaults", () => {
        expect(resolveThemeConfig("missing")).toEqual(themeConfigs[0]);
        expect(resolveFrameConfig("missing")).toEqual(frameConfigs[0]);
        expect(resolveStyleConfig("missing")).toEqual(styleConfigs[0]);
    });

    it("rejects incomplete or unknown selections", () => {
        const invalidSelection: BoothSelection = {
            ...defaultBoothSelection,
            themeId: "missing",
        };

        expect(isBoothSelectionComplete(invalidSelection)).toBe(false);
    });

    it("normalizes legacy restored selections to safe defaults", () => {
        const normalized = normalizeBoothSelection({
            themeId: "party",
            frameId: "gold",
            styleId: "warm",
        });

        expect(normalized).toEqual(
            expect.objectContaining({
                themeId: "party",
                frameId: "gold",
                styleId: "warm",
                layoutId: "2x2",
                countdownSeconds: 3,
                customization: {
                    stickerItems: [],
                    textLabels: [],
                    drawingStrokes: [],
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

        expect(normalized.layoutId).toBe("2x2");
        expect(normalized.countdownSeconds).toBe(3);
    });
});

describe("layout/countdown/customization config", () => {
    it("maps approved layouts to expected shot counts and output sizes", () => {
        expect(resolveBoothLayoutConfig("2x2")).toEqual(
            expect.objectContaining({
                shotCount: 4,
                outputWidth: 1600,
                outputHeight: 1600,
            }),
        );
        expect(resolveBoothLayoutConfig("1x4-vertical")).toEqual(
            expect.objectContaining({
                shotCount: 4,
                outputWidth: 1200,
                outputHeight: 3600,
            }),
        );
        expect(resolveBoothLayoutConfig("2x3")).toEqual(
            expect.objectContaining({
                shotCount: 6,
                outputWidth: 1600,
                outputHeight: 2400,
            }),
        );
    });

    it("exposes only approved countdown options", () => {
        expect(countdownSecondOptions).toEqual([3, 6, 8, 10]);
    });

    it("provides bundled sticker and text-label defaults", () => {
        expect(boothLayoutConfigs).toHaveLength(3);
        expect(stickerConfigs.length).toBeGreaterThanOrEqual(3);
        expect(textLabelPresetConfigs.length).toBeGreaterThanOrEqual(3);
        expect(resolveStickerConfig("missing")).toEqual(stickerConfigs[0]);
        expect(resolveTextLabelPresetConfig("missing")).toEqual(
            textLabelPresetConfigs[0],
        );
    });
});

describe("BoothSelectionFlow", () => {
    it("allows selection changes and continuing when required choices are valid", () => {
        const onSelectionChange = vi.fn();
        const onComplete = vi.fn();

        render(
            <BoothSelectionFlow
                selection={defaultBoothSelection}
                camera={cameraControllerMock}
                onSelectionChange={onSelectionChange}
                onComplete={onComplete}
            />,
        );

        expect(
            screen.getByText("Live preview classic/none/none"),
        ).toBeTruthy();

        fireEvent.click(screen.getByText("Party"));
        expect(onSelectionChange).toHaveBeenCalledWith({
            ...defaultBoothSelection,
            themeId: "party",
        });

        fireEvent.click(screen.getByRole("button", {
            name: "Tiếp tục vào camera",
        }));
        expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it("blocks continuing when required selection is invalid", () => {
        const onComplete = vi.fn();

        render(
            <BoothSelectionFlow
                selection={{
                    ...defaultBoothSelection,
                    themeId: "missing",
                }}
                camera={cameraControllerMock}
                onSelectionChange={vi.fn()}
                onComplete={onComplete}
            />,
        );

        const continueButton = screen.getByRole("button", {
            name: "Tiếp tục vào camera",
        });

        expect(continueButton).toHaveProperty("disabled", true);
        fireEvent.click(continueButton);
        expect(onComplete).not.toHaveBeenCalled();
    });
});
