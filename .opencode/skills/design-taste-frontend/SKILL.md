---
name: design-taste-frontend
description: Apply Taste Skill-inspired anti-generic UI/UX guidance for premium PhotoBoothAI kiosk screens while preserving accessibility, preview performance and recovery clarity
compatibility: opencode
source_inspiration: https://github.com/leonxlnx/taste-skill
---

# Design Taste Frontend

Use this skill when designing or implementing PhotoBoothAI UI/UX screens, especially attract, countdown, preview, QR/share, gallery, admin and recovery flows.

This is a local project adaptation inspired by Taste Skill. It does not vendor external code. It converts the design intent into PhotoBoothAI-specific rules.

## Core intent

Avoid generic, boilerplate-looking UI. Build an event-grade photobooth interface that feels premium, clear, memorable and fast.

PhotoBoothAI UI must be:

- cinematic but not distracting
- tactile and kiosk-friendly
- readable from booth distance
- delightful for attendees
- calm and precise for operators
- safe during hardware/media failures

## Taste dials

Set these per screen before implementation:

| Dial | Range | PhotoBoothAI default | Meaning |
|---|---:|---:|---|
| Design variance | 1-10 | 7 | More expressive layout than generic centered cards |
| Motion intensity | 1-10 | 6 | Smooth countdown/flash/status motion without hurting preview FPS |
| Visual density | 1-10 | 4 attendee, 7 admin | Spacious attendee flow; denser operator dashboard |

Rules:

- Attendee screens can be bold and visual.
- Admin screens should be information-dense but still structured.
- Error recovery screens prioritize clarity over novelty.
- Motion must never reduce preview responsiveness.

## Pre-flight design audit

Before implementing a frontend task, answer:

1. Which backlog story does this UI serve?
2. Which booth state renders this screen?
3. What is the primary action?
4. What is the fallback action?
5. What can fail here?
6. Does the design preserve preview visibility where required?
7. Does the design avoid generic SaaS card/slop patterns?
8. What command/test/manual evidence will prove it works?

If these are unclear, stop and ask PM/Architect before coding.

## Anti-generic UI rules

Avoid:

- plain centered white cards for every screen
- tiny controls or dense paragraphs in attendee flow
- generic “Submit/Cancel” copy when action-specific copy is possible
- low-contrast gray-on-gray kiosk text
- decorative animation that hides camera preview or recovery actions
- stock-dashboard admin layouts without hierarchy
- placeholder gradients without intentional brand purpose

Prefer:

- strong visual hierarchy with one obvious primary action
- oversized countdown numbers and large touch targets
- bold event-like typography and spacing
- camera-first compositions where preview feels alive
- clear status surfaces for AI/camera/storage/print
- premium dark/cinematic booth theme with controlled accent colors
- action copy like “Start Booth”, “Retake”, “Save & QR”, “Retry Camera”

## Screen-specific guidance

### Attract screen

- Must feel like an invitation, not a settings page.
- Use one dominant CTA.
- Include event/brand identity area.
- Motion may be ambient but must not block start input.

### Live preview and countdown

- Preview remains visually dominant.
- Countdown should be large, rhythmic and readable.
- Capture button/fallback remains obvious.
- Gesture feedback is subtle and confidence-based.

### Capture/flash

- Flash should be brief and intentional.
- Do not create long blocking animations after capture.
- Show that the photo is being saved/processed.

### Preview/actions

- Final photo should be hero content.
- Actions should map to attendee decisions: keep/share/print/retake/done.
- Avoid clutter; use progressive disclosure where possible.

### QR/share

- QR code must scan easily: size, quiet zone, contrast.
- Show simple instruction and fallback URL if needed.
- Avoid exposing local absolute paths or technical details.

### Error recovery

- Full-screen recovery for critical failures.
- Use direct language: what happened, what to do now.
- Never rely on toast only.
- Keep recovery actions large and visible.

### Admin/operator

- More dense is acceptable.
- Use grouped status cards: camera, AI, storage, printer, logs.
- Make dangerous actions visually distinct and confirmation-gated.

## Motion rules

- Motion is purposeful: countdown rhythm, state transitions, capture flash, saved/queued confirmation.
- Prefer CSS transforms and opacity; avoid layout-thrashing animation.
- Respect reduced-motion where feasible.
- Do not run animation work that competes with MediaPipe inference or live preview.

## Typography and spacing

- Attendee primary text must be readable from several feet away.
- Use clear size contrast: headline, instruction, action.
- Keep line length short in kiosk flow.
- Use spacing to create confidence and reduce confusion.

## Implementation checklist

- UI maps to an explicit backlog story and booth state.
- Primary action is visually dominant.
- Touch targets are large enough for kiosk use.
- Fallback action is visible where needed.
- Preview performance is protected.
- Critical recovery does not use toast-only feedback.
- Accessibility basics are preserved.
- Tests/manual evidence match the acceptance matrix.
