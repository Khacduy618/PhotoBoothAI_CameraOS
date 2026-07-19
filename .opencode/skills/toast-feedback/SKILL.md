---
name: toast-feedback
description: Design and implement non-blocking PhotoBoothAI toast feedback without replacing critical recovery screens
compatibility: opencode
---

# Toast Feedback

Use this skill when adding transient user/operator feedback in PhotoBoothAI.

## When to use toast

Use toast for non-critical status:

- session started
- camera ready
- photo saved
- QR code ready
- print queued
- print completed
- settings saved
- gallery export started/completed
- AI gesture disabled but touch is available

## When not to use toast

Do not use toast as the only UI for:

- camera permission denied
- camera disconnected
- capture failed before original media is preserved
- storage full or storage write failure
- printer offline when user requested print
- fatal errors
- countdown
- active capture flash

Critical and recoverable hardware failures require full-screen or operator-panel recovery UI.

## Design rules

- Keep toast text short and action-oriented.
- Avoid blocking attendee actions.
- Avoid covering faces or countdown controls.
- Use bottom-center for attendee flow unless it conflicts with controls.
- Use operator dashboard region for admin-only toasts.
- Include ARIA live announcements for accessibility.
- Do not include secrets, local absolute paths, photo blobs or customer personal data.

## Suggested durations

- success: 2500-3000 ms
- info: 3000-5000 ms
- warning: 5000 ms or until related screen changes
- error: only for non-critical errors; otherwise use recovery screen

## Implementation checklist

- Toast state is independent from booth state machine.
- Toasts are triggered by side-effect results, not by rendering loops.
- Duplicate toasts are coalesced during repeated async events.
- Tests verify that critical failures render recovery UI rather than toast-only feedback.

## Example copy

- `Photo saved. QR is ready.`
- `Print queued.`
- `Printer retry started.`
- `AI gestures unavailable. Touch capture is ready.`
- `Settings saved.`
