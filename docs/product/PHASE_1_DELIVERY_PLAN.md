# PhotoBoothAI Phase 1 Delivery Plan

Status: Current Phase 1 execution source of truth after PR1-PR6 baseline merges and Phase 1 planning reset.
Date: 2026-07-20. Updated: 2026-08-03.

## Purpose

This document defines the current Phase 1 delivery track for PhotoBoothAI after the original Sprint 1 plan and the merged Phase 1 PR1-PR6 work. Use this file to sequence Phase 1 task execution. Keep `docs/product/SPRINT_1_DELIVERY_PLAN.md` as historical traceability for the original Sprint 1 scope.

## Phase 1 execution authority

This file is the current Phase 1 execution source of truth.

Source hierarchy:

1. PM-approved scope and current user instruction
2. `docs/product/PHASE_1_DELIVERY_PLAN.md`
3. `docs/product/phase-tasks/*.md`
4. `docs/product/ROLE_TASK_MATRIX.md`
5. `docs/testing/ACCEPTANCE_EVIDENCE_MATRIX.md`
6. `docs/product/PRODUCT_BACKLOG.md`
7. `docs/product/SPRINT_1_DELIVERY_PLAN.md` for historical traceability only

`SPRINT_1_DELIVERY_PLAN.md` remains historical and must not be used alone to sequence current Phase 1 work.

## Phase 1 reset definition

“Restart Phase 1” means:

- revalidate existing PR1–PR6 baseline,
- preserve merged work unless evidence shows acceptance gaps,
- create task-file execution breakdown,
- rework only failed or incomplete acceptance gaps,
- keep media-safety invariants,
- keep hardware evidence honest.

It does not mean deleting or rewriting completed implementation without QA/Verifier evidence and PM approval.

## Phase 1 product goal

PhotoBoothAI Phase 1 delivers a local-first photobooth experience that lets an operator configure the booth, preview selected layout/theme/frame/sticker/text choices in real time, capture photos safely, preserve originals, compose a final output, customize it locally, and download the result.

Phase 1 must not depend on print, cloud upload, email, SMS, social sharing, payment, gallery, admin dashboard or production hardware claims.

## Phase 1 target flow

```text
Open booth
→ setup/readiness screen
→ realtime setup preview
→ choose layout
→ choose countdown
→ choose theme
→ choose frame
→ choose style/filter
→ choose sticker/text preset
→ camera readiness check
→ start capture
→ multi-shot countdown if selected layout needs multiple photos
→ capture originals
→ preserve originals locally
→ compose layout derivative
→ preview composed result
→ customize final output
   → sticker picker
   → text label/custom text
   → canvas pen drawing
   → undo/clear
→ download customized final
→ retake/reset/finish
```

## Relationship to legacy Sprint 1

The legacy Sprint 1 plan remains preserved for traceability. It should not be used alone to sequence current Phase 1 work. Current execution follows this Phase 1 plan, the Phase 1 task files, the product backlog and the evidence matrix updates.

## Phase 1 task-file execution order

Required path:

1. `docs/product/phase-tasks/PHASE_1_TASK_00_BASELINE_REVALIDATION.md`
2. `docs/product/phase-tasks/PHASE_1_TASK_01_SETUP_READINESS.md`
3. `docs/product/phase-tasks/PHASE_1_TASK_02_REALTIME_SETUP_PREVIEW.md`
4. `docs/product/phase-tasks/PHASE_1_TASK_03_CAPTURE_COMPOSE_CUSTOMIZE_REGRESSION.md`
5. `docs/product/phase-tasks/PHASE_1_TASK_04_MANUAL_BROWSER_AND_OFFLINE_EVIDENCE.md`
6. `docs/product/phase-tasks/PHASE_1_TASK_05_HARDWARE_LABELING_AND_RELEASE_REPORT.md`

Optional / PM-gated:

7. `docs/product/phase-tasks/PHASE_1_TASK_06_ASSET_SYSTEM_INVESTIGATION_ONLY.md`

## Already merged Phase 1 baseline

| PR slice | Status | Scope summary | Evidence status |
|---|---|---|---|
| PR1 | Merged | PhotoBoothAI domain/config foundation | Software evidence in merged PR history |
| PR2 | Merged | Booth flow/state-machine foundation | Software evidence in merged PR history |
| PR3 | Merged | Multi-shot capture flow foundation | Software evidence in merged PR history; hardware PARTIAL unless manually tested |
| PR4 | Merged | Layout compositor service | Software evidence in merged PR history |
| PR5 | Merged | Composed layout result preview | Software evidence in merged PR history; browser/runtime PARTIAL unless manually tested |
| PR6 | Merged | Output customizer sticker/text/canvas/download | QA PASS, Reviewer PASS, Verifier PARTIAL due missing manual browser/touch evidence |

## Active Phase 1 task sequencing

The PR7+ grouping remains useful historical delivery shorthand, but current execution must follow the task files above. PR1–PR6 are revalidated through Task 00 before new implementation continues.

### PR7 / Task 02: Realtime setup preview UX

Goal: make the setup page visually reflect user selections immediately before capture.

Scope:

- realtime layout preview grid for approved layouts
- realtime countdown summary
- realtime theme color/accent preview
- realtime frame preview
- realtime style/filter preview using lightweight CSS approximation
- realtime sticker preset preview
- realtime text preset/custom label preview
- camera unavailable fallback preview
- no print/cloud
- no heavy canvas work on live preview path
- no MediaPipe inference in setup preview

Acceptance gates:

- selecting layout updates preview immediately
- selecting countdown updates preview summary immediately
- selecting theme/frame/style updates preview immediately
- selecting sticker/text preset updates preview immediately
- repeated sticker/text preset changes replace setup-generated items rather than appending unlimited items
- camera unavailable state keeps static preview usable
- confirmed selection is preserved into capture flow
- `pnpm lint`, `pnpm build`, `pnpm test`, `pnpm tsc --noEmit` pass

### PR8: Phase 1 manual browser evidence

Goal: document runtime behavior honestly.

Scope:

- open `/booth`
- verify setup preview changes for layout/countdown/theme/frame/style/sticker/text
- grant/deny camera permission path
- run capture flow
- verify multi-shot progress if enabled
- verify composed result
- use customizer
- download final JPEG and open it
- test retake/reset
- confirm no print/cloud UI
- record browser, OS and hardware status

### PR9: Visual polish and kiosk refinement

Goal: improve attendee/operator UX without changing core scope.

Scope:

- setup preview as hero/sticky surface
- large touch targets
- clear selected states
- accessible labels
- responsive kiosk layout
- no new product capability

### PR10+: Theme/frame/sticker asset system, only with PM approval

Theme, frame and sticker packs are allowed as investigation first. Production implementation requires PM and Architect approval because asset licensing, offline behavior, rendering fidelity, bundle impact and kiosk performance must be reviewed.

## Explicit Phase 1 exclusions

- Canon EDSDK native implementation
- native Camera Worker
- printing integration
- print queue
- printer hardware validation
- cloud upload
- cloud-backed QR sharing
- email/SMS/social sharing
- payment
- gallery browsing
- admin dashboard
- production event asset marketplace
- production camera/kiosk/printer PASS claims without named-device evidence

## Library and asset decision

Phase 1 must not add a heavy production design/editor dependency by default. Use native React DOM/CSS for setup preview and native Canvas for final local derivatives. External libraries are investigation candidates only until PM/Architect approve dependency risk.

Recommended current approach:

- setup preview: DOM/CSS grid, CSS frame, CSS style filter, SVG/emoji sticker/text overlay
- final renderer: native Canvas drawing from preserved originals and local assets
- stickers: curated local SVG pack preferred; OpenMoji/Twemoji/Noto Emoji can be evaluated after license review
- frames: local SVG/PNG overlays plus typed config preferred

Candidate libraries:

| Candidate | Use | License note | Phase 1 recommendation |
|---|---|---|---|
| `konva` / `react-konva` | Advanced drag/resize/rotate editor | MIT | Investigate for Phase 2 if customizer grows |
| `fabric` | Canvas object editor and SVG support | MIT | Investigate only; likely heavy for Phase 1 |
| `canvg` | SVG to Canvas rendering | MIT | Possible later utility if SVG frames require rasterization |
| `html2canvas` | DOM screenshot | MIT | Avoid as authoritative renderer |
| `sharp` | Node/server image processing | Apache-2.0 | Defer unless local backend renderer is introduced |
| `polotno` | Design editor framework | Custom license | Avoid for Phase 1 |
| `@pqina/pintura` | Commercial image editor | Commercial | Avoid unless product buys SDK |

## Acceptance gates for every Phase 1 task or PR change

1. Scope maps to explicit PB IDs.
2. Exclusions are listed.
3. `pnpm lint` result is recorded.
4. `pnpm build` result is recorded.
5. `pnpm test` result is recorded.
6. `pnpm tsc --noEmit` result is recorded when types/tests are touched.
7. Browser/manual evidence is recorded for affected UI/runtime flows.
8. Original captures are preserved before derivatives.
9. Live preview remains prioritized.
10. MediaPipe inference does not block preview.
11. Sustained gesture cannot trigger unlimited captures.
12. Fallback behavior is documented.
13. Hardware status is labeled PASS, PARTIAL, FAIL or Not applicable.
14. Mock/browser-only hardware evidence is never labeled PASS.
15. QA PASS, Reviewer PASS and Verifier PASS/PARTIAL are required before PM final acceptance.

## Hardware status policy

- PASS: named real target hardware was tested successfully.
- PARTIAL: browser-only, mock, simulated or incomplete hardware evidence.
- FAIL: attempted on target hardware and failed.
- Not applicable: docs-only or non-runtime change.

Printer is Not applicable in Phase 1 unless PM explicitly expands scope.

## PR evidence template

```text
PR:
Backlog items:
Scope:
Exclusions:
Files changed:
Commands:
- pnpm lint:
- pnpm build:
- pnpm test:
- pnpm tsc --noEmit:
Browser/manual evidence:
Media safety evidence:
Hardware tested:
Hardware not tested:
Hardware status:
Fallback behavior:
Known risks:
QA verdict:
Reviewer verdict:
Verifier verdict:
PM decision:
```
