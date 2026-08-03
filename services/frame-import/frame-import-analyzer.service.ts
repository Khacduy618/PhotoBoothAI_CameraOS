import type {
    AnalyzeFrameInput,
    FrameImportResult,
    FrameImportWarning,
} from "./frame-import.types";
import { buildAlphaMask, buildCompanionMask } from "./alpha-mask.service";
import { findConnectedComponents } from "./connected-components.service";
import { filterSlotCandidates } from "./slot-candidate-filter.service";
import { orderSlots } from "./slot-ordering.service";
import { calculateConfidence, classifyConfidence, inferShotCount } from "./confidence.service";

export function analyzeImportFrame({
    fileName,
    rgba,
    width,
    height,
    companionMask,
    importId = `import-${Date.now()}-${Math.random()}`,
}: AnalyzeFrameInput): FrameImportResult {
    const mask = typeof companionMask !== "undefined"
        ? buildCompanionMask(companionMask, width, height)
        : buildAlphaMask(rgba, width, height);

    const transparentPixels = mask.reduce((sum, value) => sum + value, 0);
    const components = findConnectedComponents(mask, width, height);
    const candidates = filterSlotCandidates(components, width, height);
    const orderedSlots = orderSlots(candidates);
    const detectedShotCount = inferShotCount(orderedSlots.length);
    const confidence = calculateConfidence(orderedSlots);
    const warnings: FrameImportWarning[] = [];

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
        importId,
        sourceFileName: fileName,
        image: {
            width,
            height,
            mimeType: "image/png",
            hasAlpha: typeof companionMask === "undefined",
        },
        maskSource: typeof companionMask !== "undefined" ? "companion-mask" : "alpha",
        analysis: {
            transparentPixelRatio: transparentPixels / (width * height),
            rawComponentCount: components.length,
            candidateCount: candidates.length,
            detectedShotCount,
            confidence,
            warnings,
        },
        slots: orderedSlots,
        status: detectedShotCount ? classifyConfidence(confidence) : "rejected",
    };
}
