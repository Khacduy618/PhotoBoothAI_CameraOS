import type { BoothLayoutConfig } from "@/types/customization";
import type { FrameConfig } from "@/types/theme";

export interface FrameCompatibilityResult {
    compatible: boolean;
    reason?: "missing-slots" | "slot-count" | "shot-count" | "photo-viewport-orientation" | "layout-family" | "output-size";
}

export function isFrameCompatibleWithLayout(
    frame: FrameConfig | undefined,
    layout: BoothLayoutConfig,
): boolean {
    return getFrameCompatibility(frame, layout).compatible;
}

export function getFrameCompatibility(
    frame: FrameConfig | undefined,
    layout: BoothLayoutConfig,
): FrameCompatibilityResult {
    if (!frame) {
        return { compatible: false, reason: "missing-slots" };
    }

    if (frame.slots && frame.slots.length !== layout.shotCount) {
        return { compatible: false, reason: "slot-count" };
    }

    if (frame.shotCount !== undefined && frame.shotCount !== layout.shotCount) {
        return { compatible: false, reason: "shot-count" };
    }

    const frameViewportOrientation = frame.photoViewportOrientation ?? frame.orientation;
    if (frameViewportOrientation !== undefined && frameViewportOrientation !== layout.orientation) {
        return { compatible: false, reason: "photo-viewport-orientation" };
    }

    if (frame.layoutFamily !== undefined && frame.layoutFamily !== layout.layoutFamily) {
        return { compatible: false, reason: "layout-family" };
    }

    if (
        (frame.outputWidth !== undefined && frame.outputWidth !== layout.outputWidth) ||
        (frame.outputHeight !== undefined && frame.outputHeight !== layout.outputHeight)
    ) {
        return { compatible: false, reason: "output-size" };
    }

    return { compatible: true };
}
