# MomentAI Guest Flow V3 — Product Backlog

Status: Active source of truth after Guest Flow V3 reset, updated for Production Brief v3.1 PM decisions.
Source architecture: `docs/architecture/MomentAI_Guest_Internal_System_Design.md` and `docs/MomentAI_CameraOS_Production_Brief_v3.1.md`.

## PM decisions applied

- Production target: Windows 10 x64 booth PC.
- Share/QR: V1 uses `LOCAL_NETWORK_URL` when a guest phone can reach the booth local network endpoint; otherwise Result shows an explicit QR unavailable/fallback state. Cloud URL delivery is deferred unless PM approves a provider.
- Print: V1 uses `GUEST_CONFIRM`; the guest may confirm printing but cannot choose printer, paper, layout, photo order or print profile.
- Retake: deferred to a later phase; V1 Guest UI does not expose retake. Admin-configurable retake policy is reserved for later work and V1 effective behavior is `allowGuestRetake=false`, `maxRetakesPerShot=0`.
- Canon Command Shadow Mode: after fake/device capture loop and before the physical Canon integration spike; shadow evidence never satisfies Canon PASS.

## Product goal

Build MomentAI Photobooth on CameraOS as a Windows 10 x64 booth PC / Mini PC form factor + Electron kiosk flow with Canon EOS 6D over USB/Canon EDSDK and Canon SELPHY CP1000 over USB/Windows Print System. Guests select only the shot format and template, then receive a Local QR when the phone can reach the booth local network endpoint or a clear fallback when unavailable. Printing is guest-confirmed from the Result screen and runs through a durable print queue. React Native, iPad and macOS production runtimes are out of V1 scope; macOS remains a development path using Device/Fake adapters.

## Core guest flow

```text
START / SHOWCASE
→ SELECT SHOT FORMAT
→ LIVE VIEW / AUTO CAPTURE
→ SELECT TEMPLATE
→ CUSTOMIZE, only if template allows typing/drawing
→ FINAL COMPOSITION
→ RESULT + LOCAL QR / fallback, with guest-confirmed print
→ DONE or 120-second timeout
→ RESET GUEST SESSION
→ START
```

Guest does not choose layout, photo order, paper, printer, camera provider or print profile. The system derives those from shot format, template, event and print/share profile.

## Required shot formats

| ID | Guest label | Shot count | Slot count | Layout type |
|---|---|---:|---:|---|
| `format_1shot` | 1 Shot | 1 | 1 | `single` |
| `format_2shot` | 2 Shots | 2 | 2 | `vertical_2` |
| `format_4shot` | 4 Shots | 4 | 4 | `vertical_4` |
| `format_6shot` | 6 Shots | 6 | 6 | `2col_3row` |

## Cross-story production foundations

These foundations apply to all stories:

- `SystemState`, `SessionState` and side-effect `JobState` are separate.
- An active `EventConfig` controls enabled shot formats, timeout policy, capture policy, print policy, share policy, template set and V1 retake disabled state.
- Guest Start is blocked unless readiness allows a new session.
- Original photos are validated and persisted before shot completion.
- Durable session/job records are the source of truth; React memory is never enough for production completion state.
- Local QR must point to a tokenized local network URL, not `localhost` and not a local absolute path.
- Print/share side effects are idempotent and recoverable.
- Hardware support claims require named real hardware evidence.

## Epics and stories

### V3-001 — Session controller and state machine

As CameraOS, I want one session controller to coordinate the guest flow so UI never talks directly to hardware.

Acceptance criteria:

- Session states cover idle/showcase, selecting format, ready to capture, countdown, capturing, capture review, recovering camera, selecting template, customizing, composing, result, completing, completed, session error, aborted and resetting.
- System readiness is represented separately from guest session state.
- Print/share job lifecycle is represented separately from guest session state.
- Error states cover camera, capture, image, storage, template, composition, QR/share and print failures.
- Invalid transitions are rejected or ignored explicitly.
- State machine is testable without React.

### V3-002 — Guest session data model

As the system, I want one durable session object to own guest flow data.

Acceptance criteria:

- Session stores `sessionId`, `eventId`, `captureFormat`, `photos`, `selectedTemplate`, `slotAssignments`, `customization`, `outputs`, `qr/share`, `printJob` references and `status`.
- Session is created once at START and persisted before capture begins.
- Meaningful state transitions are persisted.
- Original photos are referenced from the session but owned by photo storage.
- Templates never contain guest photo blobs.
- Reset clears active guest UI state only and does not disconnect camera or printer services.
- Reset is safe to call more than once.

### V3-003 — Start / Showcase screen

As a guest, I want a clear branded start screen so I know what experience I am entering.

Acceptance criteria:

- Shows event branding and sample outputs.
- Explains available enabled shot formats without selecting them on this screen.
- Has one primary CTA: Start.
- Start is disabled or blocked when there is no active event or readiness is BLOCKED.
- Start creates a unique durable guest session and transitions to format selection.
- Guest-facing blocked copy is simple and action-oriented; operator-facing details remain in Admin.

### V3-004 — Select Shot Format screen

As a guest, I want to choose an enabled 1/2/4/6 shot format so the output matches my preference.

Acceptance criteria:

- Shows event-enabled 1 Shot, 2 Shots, 4 Shots and/or 6 Shots.
- Current V1 event may enable all four formats.
- Each card shows shot count, layout illustration and selected state.
- Continue is unavailable until a valid enabled format is selected.
- Selected format is stored on the durable session.
- Guest is not shown layout/order/paper/printer/camera choices.

### V3-005 — Camera service and adapter boundary

As CameraOS, I want camera capture behind a camera adapter so hardware can be controlled safely and development can proceed with fake/device adapters.

Acceptance criteria:

- Guest UI never calls Canon EDSDK, filesystem or camera APIs directly.
- Camera flow is `SessionController → CaptureManager → CameraService → CameraAdapter`.
- Camera connection is app/platform-level and remains ready between guest sessions when healthy.
- Adapter capabilities report live view, still capture and provider-specific capabilities explicitly.
- FakeCameraAdapter and DeviceCameraAdapter may satisfy software integration evidence but not Canon hardware PASS.
- Fallback activation is visible in Admin state/logs and never silently pretends to be Canon.
- Capture requires camera ready, state allows capture and no capture already running.
- Hardware PASS requires named Canon EOS 6D evidence on the Windows 10 x64 booth PC target via Canon EDSDK/Bridge.

### V3-006 — Capture loop

As a guest, I want automatic capture for the selected shot count.

Acceptance criteria:

- Countdown runs before each shot.
- Capture count is derived from `captureFormat.shotCount`.
- Capture lock prevents duplicate guest triggers, admin test capture, provider switch and unsafe reset of in-flight paths.
- Every successful original JPEG is validated and saved before the session advances.
- `shotComplete=true` requires command success, still acquired, image valid and original persisted.
- Partial captures are preserved on failure.
- Duplicate capture is guarded.
- Capture failure does not increment saved shot count.
- Capture completion occurs only when saved valid photo count equals selected shot count.

### V3-007 — Photo storage and photo pool

As the system, I want originals preserved safely before any output is created.

Acceptance criteria:

- Each photo has stable `photoId`, `sessionId`, `shotIndex`, original reference, status and capture timestamp.
- Originals are never overwritten by preview, customization, composition, QR/share or print.
- Storage failures are typed and visible.
- Critical original/output writes use temp + validate + atomic rename where feasible.
- Storage warning threshold produces Admin warning/DEGRADED health; block threshold prevents new sessions.
- Cleanup never touches active sessions or required originals/outputs.
- Session completion is blocked if required originals cannot be saved.

### V3-008 — Template service

As a guest, I want to see only templates compatible with my event and shot format.

Acceptance criteria:

- Templates are filtered by `eventId`, selected shot count/capture format, active template set and `PUBLISHED` status.
- Template manifest defines canvas, slots, assets, supported shot counts, customization config, print profile and share profile.
- Manifest/assets/profile validation must pass before a template is shown to guests.
- No incompatible templates are shown.
- When no compatible template exists, the UI shows an explicit guest/operator recovery message.

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
- Customization model is stored separately from raster outputs.
- Customization is stored in the session and applied to derivatives only.
- The low-resolution UI canvas screenshot is never the print master.
- Sticker/theme/frame/style setup choices are not separate guest flow features; they belong to the template system.
- Retake is not exposed on the V1 Guest UI.

### V3-011 — Composition engine

As the system, I want final outputs rendered from originals and template data.

Acceptance criteria:

- Composition uses originals, template version, slot assignments, text, drawing and event branding.
- Render order is background, photo slots, overlay, decoration, event branding, text, drawing.
- EXIF/orientation normalization is applied where feasible.
- Outputs are distinct: master, share and print.
- Critical outputs are validated and persisted atomically where feasible.
- Output paths/hashes are persisted before session completion.
- Composition failure never deletes originals.
- Preview and print-resolution render paths are distinguishable.

### V3-012 — Local Share/QR delivery

As a guest, I want a QR code to download my final photo when my phone can reach the booth local network endpoint.

Acceptance criteria:

- Share mode supports `DISABLED` and `LOCAL_NETWORK_URL` for V1.
- Cloud delivery is deferred unless PM approves a cloud provider.
- QR uses a tokenized local network URL for the final-share output.
- QR URL does not expose local absolute paths.
- QR URL must not be `localhost`-only.
- Local ShareService must not serve arbitrary files or directory listings.
- If local network retrieval is unavailable, Result shows explicit QR unavailable/fallback state.
- QR generation/retrieval failure does not delete outputs or originals.
- Local QR PASS requires manual phone scan evidence on the same reachable network.

### V3-013 — Guest-confirmed print queue

As a guest, I want to confirm printing from the Result screen without blocking my QR/result experience.

Acceptance criteria:

- Print policy for V1 is `GUEST_CONFIRM`.
- Result screen offers a print confirmation action when printing is enabled.
- Guest does not choose printer, paper, layout or print profile.
- Print profile comes from the selected template/event config.
- Print job has stable ID and duplicate prevention.
- Duplicate guest print taps create only one intended durable print job.
- Printer failure appears as print status but QR/result remains available.
- Printer failure never deletes or invalidates captured media.
- The UI does not display `Printed successfully` merely because a command was dispatched.
- Printer PASS requires named Canon SELPHY CP1000 evidence through the Windows Print System on the Windows 10 x64 booth PC target.

### V3-014 — Result, timeout and reset

As a guest, I want a clear final screen with local QR/fallback and print status while the booth resets safely after completion.

Acceptance criteria:

- Result screen shows final photo, QR or fallback, print status, Print action when enabled, Done and 120-second countdown.
- Done completes the session.
- Timeout completes the session.
- Completing persists final metadata and durable print/share job references before reset.
- Reset clears active guest selections, customization and result UI.
- Reset does not disconnect Canon EOS 6D/device camera, printer connection, event config or template cache.
- Reset does not delete originals, outputs or durable jobs.

### V3-015 — Evidence and release gates

As PM and verifier, I want every V3 claim mapped to evidence.

Acceptance criteria:

- Every story records commands, tests, browser/manual evidence and hardware status.
- Hardware status is PASS, PARTIAL, FAIL or Not applicable.
- No Canon/printer/kiosk/local QR PASS is claimed without named real hardware/network evidence.
- Canon Shadow evidence is labeled simulated and cannot satisfy Canon hardware PASS.
- QA, Reviewer and Verifier gates are required before completion.
