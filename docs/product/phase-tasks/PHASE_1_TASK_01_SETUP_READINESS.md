# Phase 1 Task 01 — Setup Readiness

Status: Planned  
Primary owner: Frontend  
Supporting roles: BA, QA, Reviewer, Verifier

## Purpose

Provide a clear booth setup/readiness screen before capture.

## Backlog mapping

- PB-108 Setup/readiness screen

## Scope

- Setup/readiness UI.
- Camera status:
  - permission needed
  - initializing
  - ready
  - failed/unavailable
- AI/gesture status if enabled.
- Manual/touch fallback.
- Camera retry action.
- Static fallback preview when camera unavailable.
- Clear booth-distance copy.

## Explicit exclusions

- No print UI.
- No cloud UI.
- No Canon EDSDK/native worker.
- No production hardware PASS claim.
- No heavy canvas setup preview loop.

## Acceptance criteria

- Setup page opens.
- Camera readiness state is visible.
- Camera unavailable state gives clear recovery.
- Capture/start is blocked or clearly unavailable when preview is unavailable.
- Manual/touch fallback is visible.
- AI failure does not block touch capture.
- No print/cloud action appears.
- UI is readable from booth distance.

## Architecture impact

- Components stay UI-only.
- Camera state comes from hook/service.
- No direct hardware calls from UI.
- Recovery states map to typed errors.

## Tests

- Component test for readiness states.
- Browser/manual check for `/booth`.
- Simulated camera unavailable/permission denied.

## Hardware evidence

- PARTIAL unless tested with named real camera/kiosk.
- Browser/mock evidence must not be labeled PASS.

## Exit gate

Task complete when setup/readiness behavior passes tests/manual evidence and Verifier maps evidence to PB-108.
