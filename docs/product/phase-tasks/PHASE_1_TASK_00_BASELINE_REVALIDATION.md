# Phase 1 Task 00 — Baseline Revalidation

Status: Planned  
Primary owner: QA  
Supporting roles: Backend, Frontend, Reviewer, Verifier, PM

## Purpose

Revalidate the merged Phase 1 baseline before restarting execution.

This task does not authorize automatic reimplementation of PR1–PR6. It identifies PASS/PARTIAL/FAIL gaps and asks PM to decide what must be reworked.

## Backlog mapping

- PB-101 Stabilize lint configuration
- PB-102 Resolve React hook lifecycle issues
- PB-103 Restore production build
- PB-104 Establish test and type baseline
- PB-105 Replace starter landing page
- PB-106 Add explicit capture error UI
- PB-107 Add AI gesture fallback UI
- PB-116 Define session/photo domain types
- PB-117 Implement local session storage service
- PB-118 Implement photo storage service
- PB-119 Create unique booth sessions
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

- Inspect current implementation and evidence.
- Confirm which PBs already satisfy acceptance criteria.
- Identify incomplete evidence.
- Identify failed acceptance criteria.
- Recommend rework only for confirmed gaps.

## Explicit exclusions

- No production code changes.
- No delete/rewrite of merged work without PM approval.
- No Canon EDSDK/native worker.
- No print queue/printer integration.
- No cloud/gallery/admin scope.

## Acceptance criteria

- PASS/PARTIAL/FAIL recorded for each mapped PB.
- Missing tests/manual evidence listed.
- Media-safety gaps listed.
- Hardware evidence gaps labeled honestly.
- PM receives rework recommendation.

## Commands required

- `git status --short`
- `pnpm lint`
- `pnpm build`
- `pnpm test`
- `pnpm tsc --noEmit` when types/tests are touched or suspected incomplete

## Browser/manual evidence

Required only for PBs where prior browser evidence is missing.

## Hardware evidence

- Camera: PASS only with named real device evidence.
- Kiosk/touch: PASS only with named target device evidence.
- Printer: Not applicable in Phase 1.

## Exit gate

Task complete when QA and Verifier deliver a gap report and PM decides what, if anything, must be reworked.
