import type { DetectedSlot, ShotCount } from "./types";

const SUPPORTED_SHOT_COUNTS = new Set<number>([1, 2, 4, 6]);

export function inferShotCount(count: number): ShotCount | null {
  return SUPPORTED_SHOT_COUNTS.has(count) ? (count as ShotCount) : null;
}

export function calculateConfidence(slots: DetectedSlot[]): number {
  if (slots.length === 0) {
    return 0;
  }

  const validCountScore = inferShotCount(slots.length) ? 1 : 0;
  const noEdgeScore = slots.every((slot) => !slot.touchesCanvasEdge) ? 1 : 0;
  const fillScore =
    slots.reduce((sum, slot) => sum + Math.min(slot.fillRatio, 1), 0) /
    slots.length;

  const widthSimilarity = similarity(
    slots.map((slot) => slot.normalizedBounds.width),
  );
  const heightSimilarity = similarity(
    slots.map((slot) => slot.normalizedBounds.height),
  );
  const dimensionScore = (widthSimilarity + heightSimilarity) / 2;

  const alignmentScore = estimateAlignmentScore(slots);
  const spacingScore = estimateSpacingScore(slots);

  const weighted =
    validCountScore * 0.30 +
    dimensionScore * 0.20 +
    alignmentScore * 0.20 +
    spacingScore * 0.15 +
    noEdgeScore * 0.10 +
    fillScore * 0.05;

  return Math.max(0, Math.min(1, weighted));
}

export function classifyConfidence(
  confidence: number,
): "auto-approved" | "needs-review" | "rejected" {
  if (confidence >= 0.9) return "auto-approved";
  if (confidence >= 0.65) return "needs-review";
  return "rejected";
}

function similarity(values: number[]): number {
  if (values.length <= 1) return 1;

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (mean === 0) return 0;

  const averageDeviation =
    values.reduce((sum, value) => sum + Math.abs(value - mean), 0) /
    values.length;

  return Math.max(0, 1 - averageDeviation / mean);
}

function estimateAlignmentScore(slots: DetectedSlot[]): number {
  if (slots.length <= 2) return 1;

  const xs = slots.map((slot) => slot.normalizedBounds.x);
  const ys = slots.map((slot) => slot.normalizedBounds.y);

  return Math.max(similarity(xs), similarity(ys), 0.7);
}

function estimateSpacingScore(slots: DetectedSlot[]): number {
  if (slots.length <= 2) return 1;
  return 0.85;
}
