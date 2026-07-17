import { describe, expect, it } from "vitest";

import {
    getCanvasFilter,
    getOutputMimeType,
} from "@/services/render/render-photo-output";
import type { StyleConfig } from "@/types/theme";

function style(mode: StyleConfig["mode"]): StyleConfig {
    return {
        id: mode,
        name: mode,
        description: mode,
        mode,
    };
}

describe("render-photo-output helpers", () => {
    it("maps optional none style to no canvas filter", () => {
        expect(getCanvasFilter(style("none"))).toBe("none");
    });

    it("maps supported styles to canvas filters", () => {
        expect(getCanvasFilter(style("grayscale"))).toBe("grayscale(1)");
        expect(getCanvasFilter(style("warm"))).toContain("sepia");
        expect(getCanvasFilter(style("cool"))).toContain("hue-rotate");
        expect(getCanvasFilter(style("contrast"))).toContain("contrast");
    });

    it("preserves png output and defaults other captures to jpeg", () => {
        expect(getOutputMimeType("image/png")).toBe("image/png");
        expect(getOutputMimeType("image/jpeg")).toBe("image/jpeg");
        expect(getOutputMimeType("image/webp")).toBe("image/jpeg");
        expect(getOutputMimeType("")).toBe("image/jpeg");
    });
});
