import {
    cleanup,
    fireEvent,
    render,
    screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CameraController } from "@/hooks/use-camera";
import type { BoothSelection } from "@/types/theme";

const liveSelectionPreviewMock = vi.hoisted(() =>
    vi.fn(({ selection }: { selection: BoothSelection }) => (
        <div>
            Live preview {selection.layoutId}/{selection.themeId}/{selection.frameId}/{selection.styleId}/stickers:{selection.customization.stickerItems.length}/text:{selection.customization.textLabels.length}
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
                outputHeight: 2275,
            }),
        );
        expect(resolveBoothLayoutConfig("1x4-vertical")).toEqual(
            expect.objectContaining({
                shotCount: 4,
                outputWidth: 1200,
                outputHeight: 3798,
            }),
        );
        expect(resolveBoothLayoutConfig("2x3")).toEqual(
            expect.objectContaining({
                shotCount: 6,
                outputWidth: 1600,
                outputHeight: 3319,
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
            screen.getByText("Live preview 2x2/classic/none/none/stickers:0/text:0"),
        ).toBeTruthy();

        fireEvent.click(screen.getByText("1x4 dọc"));
        expect(onSelectionChange).toHaveBeenCalledWith({
            ...defaultBoothSelection,
            layoutId: "1x4-vertical",
        });

        fireEvent.click(screen.getByText("6s"));
        expect(onSelectionChange).toHaveBeenCalledWith({
            ...defaultBoothSelection,
            countdownSeconds: 6,
        });

        // Navigate to theme step before selecting Party theme
        const themeStepButton = screen.getAllByText(/Theme/i).find(el => el.tagName === 'BUTTON');
        if (themeStepButton) fireEvent.click(themeStepButton);

        // Safely click the Party option by matching the specific label/radio
        const partyLabel = screen.getAllByText("Party").find(el => el.closest('label'));
        if (partyLabel) fireEvent.click(partyLabel);
        expect(onSelectionChange).toHaveBeenCalledWith({
            ...defaultBoothSelection,
            themeId: "party",
        });

        // Navigate to sticker step before selecting sticker
        const stickerStepButton = screen.getAllByText(/Sticker/i).find(el => el.tagName === 'BUTTON');
        if (stickerStepButton) fireEvent.click(stickerStepButton);

        const stickerBtn = screen.getAllByText("💖 Tim lấp lánh").find(el => el.closest('button'));
        if (stickerBtn) fireEvent.click(stickerBtn);
        expect(onSelectionChange).toHaveBeenCalledWith({
            ...defaultBoothSelection,
            customization: {
                ...defaultBoothSelection.customization,
                stickerItems: [
                    {
                        id: "setup-sticker-preset",
                        stickerId: "sparkle-heart",
                        x: 0.78,
                        y: 0.2,
                        scale: 1,
                        rotationDegrees: -8,
                    },
                ],
            },
        });

        // Navigate to text step before selecting text preset
        const textStepButton = screen.getAllByText(/Text/i).find(el => el.tagName === 'BUTTON');
        if (textStepButton) fireEvent.click(textStepButton);

        fireEvent.click(screen.getByText("Best Day Ever"));
        expect(onSelectionChange).toHaveBeenCalledWith({
            ...defaultBoothSelection,
            customization: {
                ...defaultBoothSelection.customization,
                textLabels: [
                    {
                        id: "setup-text-preset",
                        text: "Best Day Ever",
                        x: 0.5,
                        y: 0.95,
                        color: "#ffffff",
                        fontSize: 42,
                        rotationDegrees: 0,
                    },
                ],
            },
        });

        // Navigate to review step to access the complete button
        const reviewStepButton = screen.getAllByText(/Review/i).find(el => el.tagName === 'BUTTON');
        if (reviewStepButton) fireEvent.click(reviewStepButton);

        fireEvent.click(screen.getByRole("button", {
            name: "Tiếp tục vào camera",
        }));
        expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it("replaces setup sticker and text presets instead of appending unlimited items", () => {
        const onSelectionChange = vi.fn();
        const selectionWithSetupPresets: BoothSelection = {
            ...defaultBoothSelection,
            customization: {
                stickerItems: [
                    {
                        id: "setup-sticker-preset",
                        stickerId: "cute-star",
                        x: 0.78,
                        y: 0.2,
                        scale: 1,
                        rotationDegrees: -8,
                    },
                ],
                textLabels: [
                    {
                        id: "setup-text-preset",
                        text: "Old Label",
                        x: 0.5,
                        y: 0.95,
                        color: "#ffffff",
                        fontSize: 42,
                        rotationDegrees: 0,
                    },
                ],
                drawingStrokes: [],
            },
        };

        render(
            <BoothSelectionFlow
                selection={selectionWithSetupPresets}
                camera={cameraControllerMock}
                onSelectionChange={onSelectionChange}
                onComplete={vi.fn()}
            />,
        );

        // Navigate to sticker step first
        const stickerStepBtn = screen.getAllByText(/Sticker/i).find(el => el.tagName === 'BUTTON');
        if (stickerStepBtn) fireEvent.click(stickerStepBtn);

        const partyStickerBtn = screen.getAllByText("🎉 Tiệc vui").find(el => el.closest('button'));
        if (partyStickerBtn) fireEvent.click(partyStickerBtn);
        expect(onSelectionChange).toHaveBeenCalledWith({
            ...selectionWithSetupPresets,
            customization: {
                ...selectionWithSetupPresets.customization,
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
            },
        });

        // Navigate to text step first
        const textStepBtn = screen.getAllByText(/Text/i).find(el => el.tagName === 'BUTTON');
        if (textStepBtn) fireEvent.click(textStepBtn);

        fireEvent.click(screen.getByText("Happy Birthday"));
        expect(onSelectionChange).toHaveBeenCalledWith({
            ...selectionWithSetupPresets,
            customization: {
                ...selectionWithSetupPresets.customization,
                textLabels: [
                    {
                        id: "setup-text-preset",
                        text: "Happy Birthday",
                        x: 0.5,
                        y: 0.95,
                        color: "#ffffff",
                        fontSize: 42,
                        rotationDegrees: 0,
                    },
                ],
            },
        });
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
