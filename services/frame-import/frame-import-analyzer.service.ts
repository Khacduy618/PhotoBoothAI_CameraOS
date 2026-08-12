import type {
    AnalyzeFrameInput,
    FrameImportResult,
    FrameImportWarning,
} from "./frame-import.types";
import { buildAlphaMask, buildCompanionMask } from "./alpha-mask.service";
import { findConnectedComponents } from "./connected-components.service";
import { filterSlotCandidates } from "./slot-candidate-filter.service";
import { buildOcclusionTolerantSlotCandidates } from "./occlusion-tolerant-slot-detector.service";
import { orderSlots } from "./slot-ordering.service";
import { calculateConfidence, classifyConfidence, inferShotCount } from "./confidence.service";
import type { DetectedSlot } from "./frame-import.types";

function buildFallbackSlot(width: number, height: number): DetectedSlot {
    const isLandscape = width >= height;
    const targetAspect = isLandscape ? 3 / 2 : 2 / 3;
    const maxWidth = 0.82;
    const maxHeight = 0.82;
    let slotWidth = maxWidth;
    let slotHeight = slotWidth / targetAspect;

    if (slotHeight > maxHeight) {
        slotHeight = maxHeight;
        slotWidth = slotHeight * targetAspect;
    }

    const x = (1 - slotWidth) / 2;
    const y = (1 - slotHeight) / 2;

    return {
        id: "fallback-slot-1",
        order: 0,
        normalizedBounds: {
            x: Number(x.toFixed(4)),
            y: Number(y.toFixed(4)),
            width: Number(slotWidth.toFixed(4)),
            height: Number(slotHeight.toFixed(4)),
        },
        pixelBounds: {
            x: Math.round(x * width),
            y: Math.round(y * height),
            width: Math.round(slotWidth * width),
            height: Math.round(slotHeight * height),
        },
        areaRatio: slotWidth * slotHeight,
        fillRatio: 1,
        touchesCanvasEdge: false,
    };
}

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
    const strictCandidates = filterSlotCandidates(components, width, height);
    const strictUnion = strictCandidates.length > 1 ? {
        x1: Math.min(...strictCandidates.map((slot) => slot.normalizedBounds.x)),
        y1: Math.min(...strictCandidates.map((slot) => slot.normalizedBounds.y)),
        x2: Math.max(...strictCandidates.map((slot) => slot.normalizedBounds.x + slot.normalizedBounds.width)),
        y2: Math.max(...strictCandidates.map((slot) => slot.normalizedBounds.y + slot.normalizedBounds.height)),
    } : null;
    const strictLooksFragmented = Boolean(
        strictUnion &&
        strictCandidates.length >= 3 &&
        strictCandidates.length <= 6 &&
        strictCandidates.every((slot) => slot.areaRatio < 0.055) &&
        strictUnion.x2 - strictUnion.x1 <= 0.7 &&
        strictUnion.y2 - strictUnion.y1 <= 0.7,
    );
    const usedTolerantDetector = strictCandidates.length === 0 || strictLooksFragmented;
    const tolerantCandidates = usedTolerantDetector
        ? buildOcclusionTolerantSlotCandidates(components, width, height)
        : strictCandidates;
    const detectedSlots = orderSlots(tolerantCandidates);
    const fallbackSlots = detectedSlots.length > 0 ? [] : [buildFallbackSlot(width, height)];
    const orderedSlots = detectedSlots.length > 0 ? detectedSlots : fallbackSlots;
    const detectedShotCount = inferShotCount(orderedSlots.length);
    const confidence = detectedSlots.length > 0 ? calculateConfidence(orderedSlots) : 0.65;
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
            candidateCount: tolerantCandidates.length,
            detectedShotCount,
            confidence,
            warnings,
        },
        slots: orderedSlots,
        status: detectedSlots.length === 0 || usedTolerantDetector ? "needs-review" : detectedShotCount ? classifyConfidence(confidence) : "rejected",
    };
}
