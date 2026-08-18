---
name: frontend-implementation
description: Implement kiosk UI, preview, countdown, recovery and operator controls with accessibility and duplicate-action protection
compatibility: opencode
---

# Frontend Implementation

Apply the local Design Taste Frontend guidance (`.opencode/skills/design-taste-frontend/SKILL.md`) for UI/UX direction before implementing attendee-facing or operator-facing screens. Treat it as project guidance; load it with the skill tool only when the current environment exposes it. Do not ship generic placeholder UI when a screen is part of the approved backlog.

Before coding, confirm the story ID and execution order from `docs/product/GUEST_FLOW_V3_DELIVERY_PLAN.md`, `docs/product/GUEST_FLOW_V3_ROLE_TASK_MATRIX.md`, `docs/testing/GUEST_FLOW_V3_ACCEPTANCE_EVIDENCE_MATRIX.md` and `docs/product/GUEST_FLOW_V3_BACKLOG.md`. Do not skip ahead to later-milestone UI without PM approval.

## Required booth screens

Handle:

- attract/start
- camera initialization
- permission
- ready/live preview
- mode selection
- countdown
- capture/flash
- processing
- preview/review
- actions
- QR/share
- printing
- gallery
- admin/operator controls
- recoverable error
- fatal error

Prioritize clarity and tasteful visual hierarchy over novelty. Expressive UI is encouraged only when it keeps the booth flow obvious, accessible and performant.

## Kiosk UI rules

- Use large touch targets and short action-oriented copy.
- Screens render booth state and dispatch events; they do not own hardware logic.
- Every attendee action must be duplicate guarded.
- Critical errors use full-screen recovery UI.
- Toasts are only for non-critical confirmation/status.
- Gesture controls must always have touch fallback.
- Timeout behavior must be visible and safe.

## Accessibility and event usability

- Keep instructions readable from booth distance.
- Avoid dense text during attendee flow.
- Preserve preview visibility during countdown.
- Do not hide recovery actions behind developer-only controls.
