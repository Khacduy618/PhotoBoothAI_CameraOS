# Phase 1 Task 02 — Realtime Setup Preview

Status: Planned  
Primary owner: Frontend  
Supporting roles: Architect, BA, QA, Reviewer, Verifier

## Purpose

Make the setup page visually reflect user selections immediately before capture.

## Backlog mapping

- PB-109 Realtime layout preview
- PB-110 Realtime countdown preview
- PB-111 Realtime theme preview
- PB-112 Realtime frame preview
- PB-113 Realtime style/filter preview
- PB-114 Realtime sticker preset preview
- PB-115 Realtime text preset/custom label preview

## Scope

- Layout preview updates immediately.
- Countdown summary updates immediately.
- Theme colors/accent update immediately.
- Frame preview updates immediately.
- Style/filter preview updates using lightweight CSS approximation.
- Sticker preset preview updates and replaces prior setup sticker.
- Text preset/custom label preview updates and replaces prior setup label.
- Static fallback preview works without camera.
- Confirmed selection persists into capture flow.

## Explicit exclusions

- No heavy canvas loop in setup preview.
- No MediaPipe inference in setup preview.
- No print/cloud action.
- No external asset/editor dependency without PM and Architect approval.
- No production asset pack implementation unless PM approves.

## Acceptance criteria

- Selecting `2x2` updates preview.
- Selecting `1x4-vertical` or approved equivalent updates preview.
- Selecting `2x3` updates preview.
- Countdown options are limited to approved values.
- Theme/frame/style selection visibly updates preview.
- Sticker/text selection replaces setup-generated item instead of appending unlimited items.
- Invalid layout/countdown/theme/frame/style falls back safely.
- Preview remains usable without camera.
- Selection persists into capture config.

## Architecture impact

- Setup preview remains DOM/CSS/SVG/emoji.
- Final renderer remains authoritative.
- Preview must not block live camera.
- Selection state must remain typed and session-compatible.

## Tests

- Layout selector/component tests.
- Countdown selection test.
- Theme/frame/style application tests.
- Sticker replacement helper/component test.
- Text trim/max/blank/replacement tests.
- Browser/manual visual check.

## Hardware evidence

- Not applicable unless camera/kiosk claim is made.
- Camera-related claims remain PARTIAL unless named real device tested.

## Exit gate

Task complete when all PB-109 to PB-115 evidence is mapped and Verifier accepts PASS/PARTIAL status.
