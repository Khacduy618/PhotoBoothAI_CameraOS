# MomentAI Guest Flow V3 — Product Backlog

Status: Active source of truth after Guest Flow V3 reset.
Source architecture: `docs/architecture/MomentAI_Guest_Internal_System_Design.md`.

## Product goal

Build MomentAI Photobooth on CameraOS as a Canon EOS 6D + macOS photobooth flow where guests select only the shot format and template, then receive QR digital output while auto print runs in the background on the result screen.

## Core guest flow

```text
START / SHOWCASE
→ SELECT SHOT FORMAT
→ LIVE VIEW / AUTO CAPTURE
→ SELECT TEMPLATE
→ CUSTOMIZE, only if template allows typing/drawing
→ FINAL COMPOSITION
→ RESULT + QR, with background auto print
→ DONE or 120-second timeout
→ RESET GUEST SESSION
→ START
```

Guest does not choose layout, photo order, paper or printer. The system derives those from shot format, template, event and print profile.

## Required shot formats

| ID | Guest label | Shot count | Slot count | Layout type |
|---|---|---:|---:|---|
| `format_1shot` | 1 Shot | 1 | 1 | `single` |
| `format_2shot` | 2 Shots | 2 | 2 | `vertical_2` |
| `format_4shot` | 4 Shots | 4 | 4 | `vertical_4` |
| `format_6shot` | 6 Shots | 6 | 6 | `2col_3row` |

## Epics and stories

### V3-001 — Session controller and state machine

As CameraOS, I want one session controller to coordinate the guest flow so UI never talks directly to hardware.

Acceptance criteria:

- Session states cover showcase, created, selecting format, ready to capture, capturing, selecting template, customizing, composing, result ready, completed and resetting.
- Error states cover camera, capture, image, storage, template, composition, QR and print failures.
- Invalid transitions are rejected or ignored explicitly.
- State machine is testable without React.

### V3-002 — Guest session data model

As the system, I want one session object to own guest flow data.

Acceptance criteria:

- Session stores `sessionId`, `eventId`, `captureFormat`, `photos`, `selectedTemplate`, `slotAssignments`, `customization`, `outputs`, `qr`, `printJob` and `status`.
- Original photos are referenced from the session but owned by photo storage.
- Templates never contain guest photo blobs.
- Reset clears active guest UI state only and does not disconnect camera or printer services.

### V3-003 — Start / Showcase screen

As a guest, I want a clear branded start screen so I know what experience I am entering.

Acceptance criteria:

- Shows event branding and sample outputs.
- Explains available 1/2/4/6 shot formats without selecting them on this screen.
- Has one primary CTA: Start.
- Start creates a unique guest session and transitions to format selection.

### V3-004 — Select Shot Format screen

As a guest, I want to choose 1/2/4/6 shots so the output matches my preference.

Acceptance criteria:

- Shows exactly 1 Shot, 2 Shots, 4 Shots and 6 Shots.
- Each card shows shot count, layout illustration and selected state.
- Continue is unavailable until a valid format is selected.
- Selected format is stored on the session.
- Guest is not shown layout/order/paper/printer choices.

### V3-005 — Canon camera service and adapter

As CameraOS, I want Canon EOS 6D capture behind a camera adapter so hardware can be controlled safely.

Acceptance criteria:

- Guest UI never calls Canon EDSDK directly.
- Camera flow is `SessionController → CaptureManager → CameraService → CanonAdapter`.
- Camera connection is app/platform-level and remains ready between guest sessions.
- Capture requires camera ready, state allows capture and no capture already running.
- Hardware PASS requires named Canon EOS 6D evidence on macOS.

### V3-006 — Capture loop

As a guest, I want automatic capture for the selected shot count.

Acceptance criteria:

- Countdown runs before each shot.
- Capture count is derived from `captureFormat.shotCount`.
- Every successful original JPEG is validated and saved before the session advances.
- Partial captures are preserved on failure.
- Duplicate capture is guarded.
- Capture completion occurs only when saved valid photo count equals selected shot count.

### V3-007 — Photo storage and photo pool

As the system, I want originals preserved safely before any output is created.

Acceptance criteria:

- Each photo has stable `photoId`, `sessionId`, `shotIndex`, original reference, status and capture timestamp.
- Originals are never overwritten by preview, customization, composition, QR or print.
- Storage failures are typed and visible.
- Session completion is blocked if required originals cannot be saved.

### V3-008 — Template service

As a guest, I want to see only templates compatible with my event and shot format.

Acceptance criteria:

- Templates are filtered by `eventId`, `captureFormatId` and `PUBLISHED` status.
- Template defines canvas, slots, assets, customization config and print profile.
- No incompatible templates are shown.
- No compatible template produces an explicit recovery/operator message.

### V3-009 — Shot-to-slot assignment

As the system, I want deterministic mapping from captured photos to template slots.

Acceptance criteria:

- Default mapping is `shotIndex = slotIndex`.
- Guest cannot reorder photos in V3.
- Assignments are stored in the session before preview/composition.
- Assignment failure blocks composition and preserves originals.

### V3-010 — Conditional customization

As a guest, I want to type or draw only when the selected template supports it.

Acceptance criteria:

- Customize screen is skipped when `allowTyping=false` and `allowDraw=false`.
- Text uses template-defined text regions, max length and alignment.
- Drawing is stored as stroke data, not bitmap-only preview.
- Customization is stored in the session and applied to derivatives only.
- Sticker/theme/frame/style setup choices are not separate guest flow features; they belong to the template system.

### V3-011 — Composition engine

As the system, I want final outputs rendered from originals and template data.

Acceptance criteria:

- Composition uses originals, template, slot assignments, text, drawing and event branding.
- Render order is background, photo slots, overlay, decoration, event branding, text, drawing.
- Outputs are distinct: master, share and print.
- Composition failure never deletes originals.
- Preview and print-resolution render paths are distinguishable.

### V3-012 — Cloud QR delivery

As a guest, I want a QR code to download my final photo.

Acceptance criteria:

- QR uses the cloud delivery URL for the share output.
- QR URL does not expose local absolute paths.
- Cloud delivery failures show explicit fallback and preserve media.
- QR generation failure does not delete outputs or originals.

### V3-013 — Background auto print

As a guest, I want printing to happen automatically after final output is ready without blocking the QR screen.

Acceptance criteria:

- Auto print starts in the background from the Result + QR screen after composition is complete.
- Guest does not choose printer or paper.
- Print profile comes from the selected template.
- Print job has stable ID and duplicate prevention.
- Printer failure appears as print status but QR remains available.
- Printer failure never deletes or invalidates captured media.
- Printer PASS requires named real printer evidence.

### V3-014 — Result, timeout and reset

As a guest, I want a clear final screen with QR while the booth resets safely after completion.

Acceptance criteria:

- Result screen shows final photo, QR, print status, Done and 120-second countdown.
- Done completes the session.
- Timeout completes the session.
- Reset clears active guest selections, customization and result UI.
- Reset does not disconnect Canon EOS 6D, printer connection, event config or template cache.

### V3-015 — Evidence and release gates

As PM and verifier, I want every V3 claim mapped to evidence.

Acceptance criteria:

- Every story records commands, tests, browser/manual evidence and hardware status.
- Hardware status is PASS, PARTIAL, FAIL or Not applicable.
- No Canon/printer/kiosk PASS is claimed without named real hardware evidence.
- QA, Reviewer and Verifier gates are required before completion.
