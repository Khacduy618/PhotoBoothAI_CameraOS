# Phase 1 Task 04 — Manual Browser and Offline Evidence

Status: Planned  
Primary owner: QA  
Supporting roles: Reviewer, Verifier, PM

## Purpose

Collect honest runtime evidence for the full local Phase 1 flow.

## Backlog mapping

- PB-129 Manual browser smoke test for Phase 1
- PB-130 Offline/no-cloud verification

## Scope

- Open `/booth`.
- Verify setup/readiness.
- Verify realtime preview changes.
- Test camera permission flow.
- Run capture flow.
- Verify multi-shot flow if selected layout requires it.
- Verify composed result.
- Use customizer.
- Download JPEG and open it.
- Test retake/reset.
- Confirm no print UI.
- Confirm no cloud upload/share UI.
- Disable network or otherwise verify no cloud dependency.
- Inspect logs for sensitive paths/media/blob leakage.

## Acceptance criteria

- Browser and OS recorded.
- `/booth` opens.
- Setup preview updates for layout/countdown/theme/frame/style/sticker/text.
- Camera permission flow recorded.
- Capture flow completes or failure is documented.
- Original preservation path is not bypassed.
- Composed result appears.
- Customizer actions work.
- Downloaded JPEG opens.
- Retake/reset works.
- No print action appears.
- No cloud upload/share action appears.
- Hardware status labeled honestly.

## Commands required

- Latest `pnpm lint`
- Latest `pnpm build`
- Latest `pnpm test`
- `pnpm tsc --noEmit` if relevant

## Hardware evidence

- Camera PASS only with named real camera.
- Kiosk/touch PASS only with named target kiosk/touchscreen.
- Printer: Not applicable.

## Exit gate

Task complete when QA checklist is complete and Verifier accepts evidence labels.
