import { getPhotoCellRects } from "@/services/layout/layout-engine";
import { isFrameCompatibleWithLayout } from "@/services/frame/frame-compatibility.service";
import type { BoothLayoutConfig } from "@/types/customization";
import type { FrameConfig, FrameSlot } from "@/types/theme";

export interface ResolvePhotoSlotsInput {
    layout: BoothLayoutConfig;
    frame?: FrameConfig;
}

export function resolvePhotoSlots({
    layout,
    frame,
}: ResolvePhotoSlotsInput): readonly FrameSlot[] {
    if (frame?.slots && frame.slots.length > 0) {
        return frame.slots;
    }

    return resolveDefaultPhotoSlots(layout);
}

export function resolveDefaultPhotoSlots(
    layout: BoothLayoutConfig,
): readonly FrameSlot[] {
    return getPhotoCellRects(layout.id, layout.outputWidth, layout.outputHeight).map((slot, index) => ({
        id: `slot-${index}`,
        index,
        x: slot.x,
        y: slot.y,
        width: slot.width,
        height: slot.height,
        photoViewportOrientation: layout.orientation === "landscape" ? "landscape" : "portrait",
    }));
}
