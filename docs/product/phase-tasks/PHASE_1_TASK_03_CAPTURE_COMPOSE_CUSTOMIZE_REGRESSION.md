# Phase 1 Task 03 — Capture, Compose, Customize Regression

Status: Planned  
Primary owner: QA first; Backend/Frontend own rework by failed area  
Supporting roles: Architect, Reviewer, Verifier, PM

## Purpose

Verify the full Phase 1 runtime path after setup changes.

## Backlog mapping

- PB-120 Preserve original capture before preview/output
- PB-121 Implement multi-shot countdown flow
- PB-122 Implement layout compositor
- PB-123 Preview composed layout result
- PB-124 Add output customizer sticker picker
- PB-125 Add output customizer text label/custom text
- PB-126 Add output customizer canvas pen drawing
- PB-127 Add undo/clear customization
- PB-128 Download customized final output

## Scope

- Capture required number of photos for selected layout.
- Preserve originals before composition/customization.
- Compose layout derivative.
- Preview composed result.
- Apply stickers.
- Apply text/custom label.
- Draw with pointer/touch where supported.
- Undo/clear.
- Download customized final output.
- Retake/reset/finish.
- Rework only evidence-confirmed gaps.

## Explicit exclusions

- No print.
- No cloud.
- No Canon native/EDSDK.
- No gallery/admin.
- No claim of hardware PASS without real target evidence.

## Acceptance criteria

- Capture is single-flight.
- Countdown runs per required photo.
- Multi-shot progress is visible.
- Originals are preserved before derivative.
- Composition uses preserved originals.
- Composition failure does not delete originals.
- Customization creates derivative only.
- Undo/clear do not affect originals.
- Downloaded output uses customized derivative when available.
- Retake/reset does not silently delete preserved originals.
- No print/cloud UI appears.

## Architecture impact

- Domain/state machine guards capture.
- Storage service preserves original.
- Render/composition service creates derivative.
- UI shows recovery where capture/storage/composition fails.

## Tests

- Capture-storage integration.
- Multi-shot test.
- Layout compositor tests.
- Customizer helper/component tests.
- Download/open manual browser check.
- Retake/reset manual check.

## Hardware evidence

- PARTIAL unless tested with named real camera/kiosk/touchscreen.
- Touch drawing PASS requires target touchscreen evidence.

## Exit gate

Task complete when QA validates runtime path and Verifier maps evidence to PB-120 through PB-128.
