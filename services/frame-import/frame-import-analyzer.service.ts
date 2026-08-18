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

function splitMergedPhotostripSlots(
    slots: DetectedSlot[],
    imageWidth: number,
    imageHeight: number,
): DetectedSlot[] {
    const isTallPhotostrip = imageHeight / imageWidth >= 2.0;
    if (!isTallPhotostrip || slots.length === 0) {
        return slots;
    }

    // Case 1: 1 giant merged slot in a tall photostrip (heightRatio >= 0.50)
    if (slots.length === 1) {
        const singleSlot = slots[0];
        if (singleSlot.normalizedBounds.height >= 0.50) {
            const b = singleSlot.normalizedBounds;
            const slotGapRatio = 0.012;
            const netHeight = b.height - slotGapRatio * 3;
            const subHeight = netHeight / 4;

            const splitSlots: DetectedSlot[] = [];
            for (let i = 0; i < 4; i++) {
                const subY = b.y + i * (subHeight + slotGapRatio);
                const bounds = {
                    x: Number(b.x.toFixed(4)),
                    y: Number(subY.toFixed(4)),
                    width: Number(b.width.toFixed(4)),
                    height: Number(subHeight.toFixed(4)),
                };
                splitSlots.push({
                    id: `photostrip-slot-${i + 1}`,
                    order: i,
                    normalizedBounds: bounds,
                    pixelBounds: {
                        x: Math.round(bounds.x * imageWidth),
                        y: Math.round(bounds.y * imageHeight),
                        width: Math.round(bounds.width * imageWidth),
                        height: Math.round(bounds.height * imageHeight),
                    },
                    areaRatio: bounds.width * bounds.height,
                    fillRatio: singleSlot.fillRatio,
                    touchesCanvasEdge: singleSlot.touchesCanvasEdge,
                });
            }
            return splitSlots;
        }
    }

    // Case 2: 2 or 3 slots in a tall photostrip where slots are merged 2-shot cutouts (height >= 0.35 or 1.35x avg height)
    if (slots.length === 2 || slots.length === 3) {
        const sorted = [...slots].sort((a, b) => a.normalizedBounds.y - b.normalizedBounds.y);
        const heights = sorted.map((s) => s.normalizedBounds.height);
        const minH = Math.min(...heights);

        const hasMergedSlot = sorted.some(
            (s) => s.normalizedBounds.height >= 0.65 || s.normalizedBounds.height >= minH * 1.75,
        );

        if (hasMergedSlot) {
            const result: DetectedSlot[] = [];
            let orderCounter = 0;

            for (const slot of sorted) {
                const isMerged = slot.normalizedBounds.height >= 0.65 || slot.normalizedBounds.height >= minH * 1.75;
                if (isMerged) {
                    const b = slot.normalizedBounds;
                    const slotGapRatio = 0.012;
                    const netHeight = b.height - slotGapRatio;
                    const subHeight = netHeight / 2;

                    for (let i = 0; i < 2; i++) {
                        const subY = b.y + i * (subHeight + slotGapRatio);
                        const bounds = {
                            x: Number(b.x.toFixed(4)),
                            y: Number(subY.toFixed(4)),
                            width: Number(b.width.toFixed(4)),
                            height: Number(subHeight.toFixed(4)),
                        };
                        result.push({
                            id: `photostrip-sub-slot-${orderCounter + 1}`,
                            order: orderCounter++,
                            normalizedBounds: bounds,
                            pixelBounds: {
                                x: Math.round(bounds.x * imageWidth),
                                y: Math.round(bounds.y * imageHeight),
                                width: Math.round(bounds.width * imageWidth),
                                height: Math.round(bounds.height * imageHeight),
                            },
                            areaRatio: bounds.width * bounds.height,
                            fillRatio: slot.fillRatio,
                            touchesCanvasEdge: slot.touchesCanvasEdge,
                        });
                    }
                } else {
                    result.push({
                        ...slot,
                        order: orderCounter++,
                    });
                }
            }
            return result;
        }
    }

    return slots;
}

export function analyzeImportFrame({
    fileName,
    rgba,
    width,
    height,
    companionMask,
    importId = `import_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
}: AnalyzeFrameInput): FrameImportResult {
    const maskResult = typeof companionMask !== "undefined"
        ? { mask: buildCompanionMask(companionMask, width, height), maskSource: "companion-mask" as const }
        : buildAlphaMask(rgba, width, height);

    const mask = maskResult.mask;
    const maskSource = maskResult.maskSource;

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
    const rawDetectedSlots = orderSlots(tolerantCandidates);
    const detectedSlots = splitMergedPhotostripSlots(rawDetectedSlots, width, height);
    const usedFallback = detectedSlots.length === 0;
    const fallbackSlots = usedFallback ? [buildFallbackSlot(width, height)] : [];
    const orderedSlots = (usedFallback ? fallbackSlots : detectedSlots).map((slot) => ({
        ...slot,
        slotSource: usedFallback ? ("fallback" as const) : ("auto" as const),
    }));
    const detectedShotCount = inferShotCount(orderedSlots.length);
    const confidence = !usedFallback ? calculateConfidence(orderedSlots) : 0.50;
    const warnings: FrameImportWarning[] = [];

    if (transparentPixels === 0 || usedFallback) {
        warnings.push("NO_TRANSPARENT_SLOT_FOUND");
    }

    if (!detectedShotCount) {
        warnings.push("UNSUPPORTED_SLOT_COUNT");
    }

    if (confidence < 0.9 || usedFallback) {
        warnings.push("LOW_CONFIDENCE");
    }

    const isPng = fileName.toLowerCase().endsWith(".png");
    const autoApprove = isPng && transparentPixels > 0 && !usedTolerantDetector && !usedFallback;
    const status = autoApprove
        ? "auto-approved"
        : usedFallback || usedTolerantDetector
        ? "needs-review"
        : detectedShotCount
        ? classifyConfidence(confidence)
        : "rejected";
    const finalConfidence = autoApprove ? 1.0 : confidence;
    const finalWarnings = autoApprove ? [] : warnings;

    return {
        importId,
        sourceFileName: fileName,
        image: {
            width,
            height,
            mimeType: "image/png",
            hasAlpha: typeof companionMask === "undefined",
        },
        maskSource,
        analysis: {
            transparentPixelRatio: transparentPixels / (width * height),
            rawComponentCount: components.length,
            candidateCount: tolerantCandidates.length,
            detectedShotCount,
            confidence: finalConfidence,
            warnings: finalWarnings,
        },
        slots: orderedSlots,
        status,
    };
}
