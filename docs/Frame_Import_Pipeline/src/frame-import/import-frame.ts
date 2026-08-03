import { buildAlphaMask } from "./analyze-alpha";
import { calculateConfidence, classifyConfidence, inferShotCount } from "./confidence";
import { findConnectedComponents } from "./connected-components";
import { filterSlotCandidates } from "./filter-candidates";
import { orderSlots } from "./order-slots";
import type { FrameImportResult, FrameWarning } from "./types";

type ImportFrameInput = {
  fileName: string;
  rgba: Uint8ClampedArray;
  width: number;
  height: number;
};

export function importFrame(
  input: ImportFrameInput,
): FrameImportResult {
  const mask = buildAlphaMask(
    input.rgba,
    input.width,
    input.height,
  );

  const transparentPixels = mask.reduce(
    (sum, value) => sum + value,
    0,
  );

  const components = findConnectedComponents(
    mask,
    input.width,
    input.height,
  );

  const candidates = filterSlotCandidates(
    components,
    input.width,
    input.height,
  );

  const slots = orderSlots(candidates);
  const detectedShotCount = inferShotCount(slots.length);
  const confidence = calculateConfidence(slots);
  const warnings: FrameWarning[] = [];

  if (transparentPixels === 0) {
    warnings.push("NO_TRANSPARENT_SLOT_FOUND");
  }

  if (!detectedShotCount) {
    warnings.push("UNSUPPORTED_SLOT_COUNT");
  }

  if (confidence < 0.9) {
    warnings.push("LOW_CONFIDENCE");
  }

  return {
    importId: crypto.randomUUID(),
    sourceFileName: input.fileName,
    image: {
      width: input.width,
      height: input.height,
      mimeType: "image/png",
      hasAlpha: true,
    },
    maskSource: "alpha",
    analysis: {
      transparentPixelRatio:
        transparentPixels / (input.width * input.height),
      rawComponentCount: components.length,
      candidateCount: candidates.length,
      detectedShotCount,
      confidence,
      warnings,
    },
    slots,
    status: detectedShotCount
      ? classifyConfidence(confidence)
      : "rejected",
  };
}
