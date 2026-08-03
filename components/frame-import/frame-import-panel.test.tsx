import React from "react";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import { FrameImportPanel } from "./FrameImportPanel";
import { LocalFrameRegistry } from "@/services/frame/local-frame-registry";

describe("FrameImportPanel", () => {
    beforeEach(() => {
        LocalFrameRegistry.clear();
    });

    afterEach(() => {
        cleanup();
    });

    it("renders operator import tool header and file upload dropzone", () => {
        render(<FrameImportPanel />);

        expect(screen.getByText(/Canva Frame Import & Registry Tool/i)).toBeDefined();
        expect(screen.getByText(/Chọn hoặc kéo thả file Canva PNG/i)).toBeDefined();
        expect(screen.getAllByText(/Đã Đăng Ký/i).length).toBeGreaterThan(0);
    });

    it("updates registry frame count when local registry publishes a frame", () => {
        render(<FrameImportPanel />);

        expect(screen.getByText("0")).toBeDefined();

        act(() => {
            LocalFrameRegistry.registerFrame({
                id: "sample-frame",
                name: "Sample Frame",
                kind: "png-overlay",
                source: "canva",
                shotCount: 4,
                outputWidth: 1200,
                outputHeight: 1800,
                slots: [],
            });
        });

        expect(screen.getByText("1")).toBeDefined();
    });
});
