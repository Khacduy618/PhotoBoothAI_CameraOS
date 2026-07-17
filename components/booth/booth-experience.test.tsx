import {
    cleanup,
    fireEvent,
    render,
    screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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
    cameraPreviewMock.mockClear();
});

describe("BoothExperience", () => {
    it("does not mount camera preview before setup is complete", () => {
        render(<BoothExperience />);

        expect(
            screen.getByText("Chọn giao diện trước khi chụp"),
        ).toBeTruthy();
        expect(
            screen.queryByText("Camera preview mounted"),
        ).toBeNull();
        expect(cameraPreviewMock).not.toHaveBeenCalled();
    });

    it("mounts camera preview with the selected values after setup is complete", () => {
        render(<BoothExperience />);

        fireEvent.click(screen.getByText("Party"));
        fireEvent.click(screen.getByText("Viền vàng"));
        fireEvent.click(screen.getByText("Warm"));
        fireEvent.click(
            screen.getByRole("button", {
                name: "Tiếp tục vào camera",
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
                onBackToSetup: expect.any(Function),
            }),
            undefined,
        );
    });

    it("can return from preview to setup without losing the current selection", () => {
        render(<BoothExperience />);

        fireEvent.click(screen.getByText("Party"));
        fireEvent.click(screen.getByText("Viền vàng"));
        fireEvent.click(screen.getByText("Warm"));
        fireEvent.click(
            screen.getByRole("button", {
                name: "Tiếp tục vào camera",
            }),
        );

        fireEvent.click(
            screen.getByRole("button", {
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
});
