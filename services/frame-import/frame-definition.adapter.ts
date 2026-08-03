import type { FrameSlot } from "@/types/theme";
import type { FrameDefinition, FrameDefinitionSlot, RuntimeFrameConfig } from "./frame-import.types";

type RuntimeFrameId = string;

function normalizeSlot(
    slot: FrameDefinitionSlot,
    outputWidth: number,
    outputHeight: number,
): FrameSlot {
    const x = slot.x * outputWidth;
    const y = slot.y * outputHeight;
    const width = slot.width * outputWidth;
    const height = slot.height * outputHeight;

    return {
        id: slot.id || `slot-${slot.index + 1}`,
        index: slot.index,
        x,
        y,
        width,
        height,
        photoViewportOrientation: slot.photoViewportOrientation,
    };
}

function buildSlotPreview(frameId: RuntimeFrameId, outputWidth: number, outputHeight: number): FrameSlot[] {
    const previewMargin = 0.08;
    const paddingX = outputWidth * previewMargin;
    const paddingY = outputHeight * previewMargin;
    const width = outputWidth - paddingX * 2;
    const height = outputHeight - paddingY * 2;

    return [
        {
            id: `${frameId}-preview-slot-1`,
            index: 0,
            x: paddingX,
            y: paddingY,
            width,
            height,
        },
    ];
}

export function convertFrameDefinitionToRuntimeFrame({
    definition,
}: {
    definition: FrameDefinition;
}): RuntimeFrameConfig {
    const outputWidth = definition.outputWidth;
    const outputHeight = definition.outputHeight;
    const normalizedSlots = definition.slots.length > 0
        ? definition.slots.map((slot) => normalizeSlot(slot, outputWidth, outputHeight))
        : buildSlotPreview(definition.id, outputWidth, outputHeight);

    return {
        id: definition.id,
        name: definition.name,
        description: definition.description ?? "",
        borderColor: definition.borderColor ?? "transparent",
        borderWidth: definition.borderWidth ?? 0,
        kind: "png-overlay",
        source: definition.source,
        assetUrl: definition.assetUrl,
        shotCount: definition.shotCount,
        orientation: definition.photoViewportOrientation,
        photoViewportOrientation: definition.photoViewportOrientation,
        layoutFamily: definition.layoutFamily,
        outputWidth,
        outputHeight,
        slots: normalizedSlots,
    };
}
