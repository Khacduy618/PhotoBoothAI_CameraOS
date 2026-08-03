import type { DetectedSlot } from "./types";

export function orderSlots(slots: DetectedSlot[]): DetectedSlot[] {
  if (slots.length === 0) {
    return [];
  }

  const sortedByY = [...slots].sort((a, b) => {
    const aCenterY = a.normalizedBounds.y + a.normalizedBounds.height / 2;
    const bCenterY = b.normalizedBounds.y + b.normalizedBounds.height / 2;
    return aCenterY - bCenterY;
  });

  const medianHeight = median(
    sortedByY.map((slot) => slot.normalizedBounds.height),
  );
  const rowTolerance = medianHeight * 0.35;

  const rows: DetectedSlot[][] = [];

  for (const slot of sortedByY) {
    const centerY =
      slot.normalizedBounds.y + slot.normalizedBounds.height / 2;

    const existingRow = rows.find((row) => {
      const rowCenterY =
        row.reduce(
          (sum, item) =>
            sum +
            item.normalizedBounds.y +
            item.normalizedBounds.height / 2,
          0,
        ) / row.length;

      return Math.abs(centerY - rowCenterY) <= rowTolerance;
    });

    if (existingRow) {
      existingRow.push(slot);
    } else {
      rows.push([slot]);
    }
  }

  const ordered = rows
    .sort((a, b) => averageCenterY(a) - averageCenterY(b))
    .flatMap((row) =>
      row.sort((a, b) => a.normalizedBounds.x - b.normalizedBounds.x),
    );

  return ordered.map((slot, order) => ({
    ...slot,
    id: `slot-${order + 1}`,
    order,
  }));
}

function averageCenterY(row: DetectedSlot[]): number {
  return (
    row.reduce(
      (sum, slot) =>
        sum + slot.normalizedBounds.y + slot.normalizedBounds.height / 2,
      0,
    ) / row.length
  );
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}
