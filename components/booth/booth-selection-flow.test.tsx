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
    defaultBoothSelection,
    frameConfigs,
    isBoothSelectionComplete,
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
            themeId: "missing",
            frameId: defaultBoothSelection.frameId,
            styleId: defaultBoothSelection.styleId,
        };

        expect(isBoothSelectionComplete(invalidSelection)).toBe(false);
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
