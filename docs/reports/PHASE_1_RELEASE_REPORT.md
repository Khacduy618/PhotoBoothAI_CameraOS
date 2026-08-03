# Phase 1 Release Report

Status: PARTIAL pending PM final decision  
Date: 2026-08-03  
Task: PHASE_1_TASK_05_HARDWARE_LABELING_AND_RELEASE_REPORT  
Backlog mapping: PB-131 Hardware evidence labeling, PB-132 Phase 1 release report

## Version / branch

- Base branch: `develop`
- Latest merged Phase 1 evidence PR: PR #33
- Report scope: Phase 1 local browser/runtime evidence after PR #30 through PR #33.

## Included merged changes and evidence

| PR | Title | Evidence summary |
|---:|---|---|
| #30 | feat(phase1): update setup readiness and frame flow | PB-108 setup/readiness screen, camera ready/failure/retry evidence, hardware PARTIAL |
| #31 | fix(render): use portrait frame output layers | Portrait 1200x1800 defaults, frame output layer clipping, no photo-slot drawing overwrite |
| #32 | test(phase1): update task03 portrait regression expectations | Task 03 regression expectations aligned with portrait defaults |
| #33 | fix(phase1): complete manual browser capture flow | Task 04 browser smoke blockers fixed; countdown, result/customizer transition, manual capture label, offline/no-cloud evidence |

Earlier Phase 1 baseline PRs remain part of merged history:

| PR | Title |
|---:|---|
| #24 | feat(phase1): wire multi-shot capture flow |
| #25 | feat(phase1): add layout compositor service |
| #26 | feat(phase1): show composed layout result |
| #27 | feat(phase1): add output customizer |
| #28 | docs(phase1): define PR7 delivery plan |
| #29 | Feature/booth updates |

## Commands and results

Latest recorded command evidence from Task 04 / PR #33:

| Command | Result |
|---|---|
| `pnpm test hooks/use-booth-machine.test.tsx components/camera/camera-preview.test.tsx components/booth/booth-selection-flow.test.tsx components/booth/booth-experience.test.tsx` | PASS — 4 files, 45 tests |
| `pnpm test` | PASS — 26 files, 182 tests |
| `pnpm build` | PASS |
| `pnpm exec tsc --noEmit` | PASS |
| `pnpm lint` | PASS with warnings — 0 errors, 73 warnings |

Known command caveats:

- Vitest/jsdom logs expected media/canvas limitations in some tests.
- Lint still reports warnings in existing files, but no lint errors were reported in the latest run.

## Browser/manual evidence

Browser/OS recorded:

- Browser: Chrome DevTools automation browser
- OS: macOS local development machine
- URL: `http://localhost:3000/booth`

Observed browser/manual flow after PR #33:

- `/booth` opens.
- Setup/readiness screen appears.
- Camera ready state appears.
- Touch/manual fallback and AI setup copy are visible.
- Selecting `1 shots` updates the setup summary to `1 ảnh · 1 ảnh dọc`.
- Start capture opens the capture screen.
- Manual capture button is visible and labeled `Chụp thủ công`.
- Countdown runs from `8` and no longer gets stuck.
- Capture reaches `RESULT`.
- Composed/customizer workspace appears.
- Customizer workspace includes `Chỉnh sửa & Xuất ảnh`, `Frame`, `Drawing`, `Tải ảnh đã xuất`, and `Chụp lại toàn bộ`.
- Drawing tab opens.
- Download button was clicked.
- Retake/reset button was clicked and returned to setup.
- No print UI was observed.
- No cloud upload/share UI was observed.

Limitations in browser/manual evidence:

- Downloaded JPEG was not independently opened outside browser automation.
- Browser evidence was local development browser evidence, not target kiosk evidence.
- Camera evidence used the local development browser/camera path; no named production camera was recorded for a hardware PASS claim.

## Offline / no-cloud evidence

Network requests observed during Task 04 smoke were local-only:

- `localhost:3000/booth`
- `localhost:3000/_next/static/...`
- `localhost:3000/backgrounds/bright-pastel.jpg`
- `localhost:3000/mediapipe/wasm/...`
- `localhost:3000/models/gesture_recognizer.task`
- `blob:http://localhost:3000/...`

Dev-only local request observed:

- `localhost:3000/__nextjs_original-stack-frames`

Interpretation:

- No external cloud domain was observed.
- `__nextjs_original-stack-frames` is local Next.js development tooling, not a cloud dependency.
- Offline emulation after page load kept the current `/booth` setup visible/usable.

## Media safety evidence

Evidence from tests and browser smoke:

- Capture reaches result and customizer after PR #33.
- Layout compositor tests pass.
- Drawing regression tests pass.
- Output rendering uses portrait 1200x1800 defaults after PR #31.
- Drawing overlays are clipped away from photo slots in export/compositor tests so drawing decorates the frame/layer without covering captured photo slots.
- Retake/reset returns to setup; no silent media deletion was observed in browser smoke.

Remaining media-safety caveats:

- Real device capture and independently opened downloaded JPEG were not completed in this report.
- Browser automation cannot fully prove long-run storage durability on event kiosk hardware.

## Hardware tested

No named target production hardware was tested for this release report.

Browser/manual environment tested:

- macOS local development machine
- Chrome DevTools automation browser
- Local development URL: `http://localhost:3000/booth`

## Hardware not tested

- Named physical production camera: Not tested
- Capture card: Not tested
- Target kiosk/touchscreen: Not tested
- Printer: Not applicable for Phase 1 unless PM explicitly expands scope

## Hardware labels

| Area | Label | Rationale |
|---|---|---|
| Camera | PARTIAL | Browser/local camera path only; no named production camera evidence |
| Kiosk/touchscreen | PARTIAL | Browser automation/local machine only; no named target kiosk/touchscreen evidence |
| Touch drawing | PARTIAL | Drawing UI opens in browser; no target touchscreen evidence |
| Printer | Not applicable | Phase 1 excludes print UI/integration |
| Cloud/offline | PASS for no external cloud observed in local browser smoke; hardware Not applicable | Network evidence showed local-only requests; no cloud upload/share UI observed |

## Backlog/status mapping

| Backlog | Status | Evidence / notes |
|---|---|---|
| PB-108 Setup/readiness screen | PARTIAL | Browser readiness/failure/retry evidence exists; hardware remains PARTIAL |
| PB-109 Realtime layout preview | PARTIAL / scope-adjusted | Current approved runtime flow keeps setup shot-count only; portrait output mapping verified by tests/browser summary |
| PB-110 Realtime countdown preview | PASS/PARTIAL | Countdown fixed and browser-observed; no target kiosk hardware |
| PB-111 Theme preview | PARTIAL | Theme/editor path present from merged baseline; Task 04 focused manual evidence did not exhaustively verify every theme |
| PB-112 Frame preview | PASS/PARTIAL | Frame workspace appears; portrait frame output layer tests pass; no kiosk hardware |
| PB-113 Style/filter preview | PARTIAL | Existing tests pass; not exhaustively verified manually in Task 04 |
| PB-114 Sticker preset preview | PARTIAL | Customizer baseline present; not exhaustively verified manually in Task 04 |
| PB-115 Text preset/custom label preview | PARTIAL | Customizer baseline present; not exhaustively verified manually in Task 04 |
| PB-120 Preserve original capture before preview/output | PASS/PARTIAL | Storage/render tests and browser flow support evidence; no production hardware |
| PB-121 Multi-shot countdown flow | PASS/PARTIAL | Tests pass; Task 04 smoke used 1-shot browser path for speed; multi-shot not manually completed in Task 04 |
| PB-122 Layout compositor | PASS | Layout compositor tests pass |
| PB-123 Preview composed layout result | PASS/PARTIAL | Composed/customizer workspace appears in browser smoke |
| PB-124 Output customizer sticker picker | PARTIAL | Customizer workspace present; sticker picker not fully manually exercised in Task 04 |
| PB-125 Output customizer text label/custom text | PARTIAL | Customizer baseline present; not fully manually exercised in Task 04 |
| PB-126 Output customizer canvas pen drawing | PASS/PARTIAL | Drawing tab opens and drawing regression tests pass; no target touchscreen |
| PB-127 Undo/clear customization | PARTIAL | Drawing UI exposes undo/clear; not fully manually exercised after drawing stroke in Task 04 |
| PB-128 Download customized final output | PARTIAL | Download button clicked; downloaded JPEG not independently opened outside automation |
| PB-129 Manual browser smoke | PASS/PARTIAL | Local browser smoke completed for core path with noted limitations |
| PB-130 Offline/no-cloud verification | PASS | No external cloud domain observed; no cloud UI observed |
| PB-131 Hardware evidence labeling | PASS | Hardware labels recorded honestly |
| PB-132 Phase 1 release report | PASS pending PM decision | This report created |

## QA verdict

Task 04 browser/manual evidence: PASS/PARTIAL.

- PASS for local browser smoke core path after PR #33.
- PARTIAL due no named target camera/kiosk/touchscreen hardware and downloaded JPEG not independently opened outside automation.

## Reviewer verdict

Reviewer status: needs PM/reviewer review of this report.

No new runtime code is introduced by this report. Recent runtime changes were merged in PR #33.

## Verifier verdict

Final verifier recommendation: PARTIAL.

Rationale:

- Command evidence is recorded and passing.
- Browser/manual evidence exists for the core local flow.
- No print/cloud UI was observed.
- Offline/no-cloud evidence is local-only and acceptable for Phase 1 privacy scope.
- Hardware evidence is incomplete; therefore Phase 1 must not be labeled full PASS for camera/kiosk/touch operation.

## Final Phase 1 status

PARTIAL

This is acceptable only if PM accepts the remaining hardware/manual limitations and explicitly records that no production hardware PASS claim is made.

## Remaining risks

- No named physical production camera evidence.
- No named kiosk/touchscreen evidence.
- Touch drawing was not validated on target touchscreen hardware.
- Downloaded JPEG was clicked but not independently opened outside browser automation.
- Multi-shot browser smoke was not fully completed in Task 04 after the 1-shot core path passed.
- Lint warnings remain, although lint exits with 0 errors.
- Existing local developer worktree contains user-managed uncommitted agent/skill/script files not included in this report.

## PM decision requested

PM should decide one of:

1. Accept Phase 1 as PARTIAL for browser/local evidence with honest hardware labeling.
2. Require named camera/kiosk/touch hardware evidence before Phase 1 acceptance.
3. Require additional manual evidence for multi-shot, sticker/text/undo/clear and independently opened JPEG before Phase 1 acceptance.
