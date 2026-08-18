# 05 — Data Model

## 1. FrameImportResult

```ts
type FrameImportResult = {
  importId: string;
  sourceFileName: string;
  sourceHash: string;

  image: {
    width: number;
    height: number;
    mimeType: "image/png";
    hasAlpha: boolean;
  };

  maskSource: "alpha" | "companion-mask";

  analysis: {
    transparentPixelRatio: number;
    rawComponentCount: number;
    candidateCount: number;
    detectedShotCount: 1 | 2 | 4 | 6 | null;
    confidence: number;
    warnings: FrameWarning[];
  };

  slots: DetectedSlot[];

  status:
    | "auto-approved"
    | "needs-review"
    | "rejected";
};
```

## 2. DetectedSlot

```ts
type DetectedSlot = {
  id: string;
  order: number;

  normalizedBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  pixelBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  areaRatio: number;
  fillRatio: number;
  touchesCanvasEdge: boolean;
};
```

## 3. FrameDefinition

```ts
type FrameDefinition = {
  version: 1;
  id: string;
  name: string;

  assetType: "png";
  assetUrl: string;
  thumbnailUrl?: string;

  output: {
    width: number;
    height: number;
    aspectRatio: "4:6";
    orientation: "portrait";
  };

  shotCount: 1 | 2 | 4 | 6;

  slots: Array<{
    id: string;
    order: number;
    x: number;
    y: number;
    width: number;
    height: number;
    fit: "cover";
  }>;

  importMetadata: {
    source: "canva";
    maskSource: "alpha" | "companion-mask";
    sourceHash: string;
    confidence: number;
    reviewedByHuman: boolean;
    analyzerVersion: string;
  };

  fallback: {
    backgroundColor: string;
  };

  license: {
    type: "canva" | "internal";
    source: string;
    usage: "project-bundled";
    attributionRequired: boolean;
    notes?: string;
  };
};
```

## 4. Warnings

```ts
type FrameWarning =
  | "NO_ALPHA_CHANNEL"
  | "NO_TRANSPARENT_SLOT_FOUND"
  | "BACKGROUND_TOUCHES_EDGE"
  | "UNSUPPORTED_SLOT_COUNT"
  | "INCONSISTENT_SLOT_SIZE"
  | "IRREGULAR_LAYOUT"
  | "LOW_FILL_RATIO"
  | "MASK_DIMENSION_MISMATCH"
  | "DUPLICATE_FILE"
  | "LOW_CONFIDENCE";
```

## 5. Batch record

```ts
type BatchImportRecord = {
  batchId: string;
  createdAt: string;
  items: FrameImportResult[];

  summary: {
    total: number;
    autoApproved: number;
    needsReview: number;
    rejected: number;
  };
};
```
