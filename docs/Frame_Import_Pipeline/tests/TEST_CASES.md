# Test Cases

## TC-001 — Four-slot grid

Input:

- PNG 1200×1800
- 4 transparent rectangles
- Opaque background

Expected:

- candidateCount = 4
- detectedShotCount = 4
- order: top-left, top-right, bottom-left, bottom-right
- status = auto-approved

## TC-002 — Full transparent background

Expected:

- large component touches edge
- component rejected
- warning
- status rejected hoặc needs-review

## TC-003 — Canva decorations with tiny transparent holes

Expected:

- tiny components filtered
- valid photo slots retained

## TC-004 — No transparency

Expected:

- candidateCount = 0
- NO_TRANSPARENT_SLOT_FOUND
- rejected

## TC-005 — Companion mask

Expected:

- source = companion-mask
- detect from mask instead of alpha
- frame alpha ignored

## TC-006 — Batch of ten

Expected:

- independent progress
- one failure does not cancel others
- summary correct
