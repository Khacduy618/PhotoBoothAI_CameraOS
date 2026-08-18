# 06 — Implementation Plan

## Milestone 1 — Contract and types

Deliverables:

- Canva export contract.
- Frame import types.
- FrameDefinition schema.
- Warning codes.
- Test fixtures.

Acceptance:

- Types compile.
- 1/2/4/6 layouts represented.
- Invalid slot bounds rejected.

## Milestone 2 — PNG decoder and alpha mask

Deliverables:

- PNG decode.
- Alpha extraction.
- Binary mask builder.
- Companion mask support.

Acceptance:

- Transparent slots become `1`.
- Opaque pixels become `0`.
- Dimension mismatch is rejected.

## Milestone 3 — Connected components

Deliverables:

- Flood fill or union-find.
- Bounding boxes.
- Area and edge-touch metadata.

Acceptance:

- Detect separated transparent regions.
- Ignore tiny noise.
- Deterministic output.

## Milestone 4 — Candidate filtering and layout inference

Deliverables:

- Area filters.
- Width/height filters.
- Fill-ratio filters.
- Shot-count inference.
- Grid/strip ordering.

Acceptance:

- 1/2/4/6 valid layouts detected.
- Edge-connected background rejected.
- Slot order stable.

## Milestone 5 — Confidence scoring

Deliverables:

- Scoring rules.
- Warnings.
- Status classification.

Acceptance:

- Clean frames auto-approved.
- Ambiguous frames need review.
- Broken frames rejected.

## Milestone 6 — Batch importer

Deliverables:

- Multi-file input.
- Queue.
- Progress.
- Duplicate hash.
- Summary.

Acceptance:

- Import at least 10 PNGs in one action.
- One failed file does not stop batch.
- Re-import duplicate is detected.

## Milestone 7 — Preview and visual correction

Deliverables:

- Sample-photo preview.
- Slot outline overlay.
- Drag/resize.
- Add/delete/reorder.
- Revalidate.

Acceptance:

- User can fix metadata without typing numbers.
- Preview matches renderer output.

## Milestone 8 — Publish and registry

Deliverables:

- FrameDefinition export.
- Asset copy.
- Registry update.
- Frame pack manifest.

Acceptance:

- Published frame appears in PhotoBooth.
- Runtime performs no detection.
- Offline use works.

## Recommended stack

### Browser-only implementation

- Canvas API
- createImageBitmap
- Web Worker
- Zod
- native File API

### Node/Electron implementation

- Sharp for PNG decode
- Optional OpenCV for morphology
- Zod
- worker threads

## Recommendation for CameraOS

Nếu CameraOS chạy Next.js/browser:

1. Detection trong Web Worker.
2. Canvas preview trong admin/dev Frame Studio.
3. Metadata lưu local hoặc API.
4. Runtime chỉ tải frame registry.

Không cần OpenCV ở phiên bản đầu. Connected components có thể tự cài bằng TypeScript.
