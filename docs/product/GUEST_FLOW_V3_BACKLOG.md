# MomentAI Guest Flow V3 — Product Backlog

Status: Active source of truth after Guest Flow V3 reset, updated for Production Brief v3.1 PM decisions.
Source architecture: `docs/architecture/MomentAI_Guest_Internal_System_Design.md`. Production decisions are recorded in the PM decisions applied section below.

## PM decisions applied

- Production target: Windows 10 x64 booth PC packaged as a local Windows `.exe` Electron app.
- Production app data root: `%LOCALAPPDATA%` under an app-owned MomentAI Photobooth directory; production media/session/job data must not depend on the source repo.
- Kiosk runtime: V1 launches directly into fullscreen Electron guest kiosk mode with hidden/passcode-gated Admin access and Windows startup/auto-launch support.
- Share/QR: V1 production share uses the approved `CLOUD_LANDING_PAGE` provider stack: Vercel landing page + Neon metadata/token records + R2 object storage for final-share media. `LOCAL_NETWORK_URL` remains allowed as fallback/dev/offline mode when configured and reachable.
- QR/share token lifetime: guest share token expires 10 minutes after the landing page/share record is created; app restart must not invalidate an unexpired durable token.
- Cleanup: default local/cloud session cleanup eligibility is 30 minutes, but cleanup must not delete active sessions, pending/printing/failed/review print jobs, active share upload state or files still required for Admin recovery.
- Print: V1 remains `GUEST_CONFIRM`; the guest must confirm printing before a durable print job is created, but cannot choose printer, paper, layout, photo order, copies or print profile. Confirmed print jobs run through a durable FIFO queue.
- Print queue failure policy: no automatic retry; a failed print job stops the queue, preserves media, leaves later jobs queued and requires Admin manual reprint/resume.
- V1 certified hardware targets: Canon EOS 6D camera and Canon SELPHY CP1000 printer only; adapters remain extensible for later PM-approved hardware.
- Retake: deferred to a later phase; V1 Guest UI does not expose retake. Admin-configurable retake policy is reserved for later work and V1 effective behavior is `allowGuestRetake=false`, `maxRetakesPerShot=0`.
- Canon Command Shadow Mode: after fake/device capture loop and before the physical Canon integration spike; shadow evidence never satisfies Canon PASS.
- Touch/kiosk UX: scrollable guest/operator areas must support natural touch drag scrolling, not scrollbar-only interaction.

## Product goal

Build MomentAI Photobooth on CameraOS as a Windows 10 x64 booth PC / Mini PC form factor packaged as a local Windows `.exe` Electron kiosk app with Canon EOS 6D over USB/Canon EDSDK and Canon SELPHY CP1000 over USB/Windows Print System as the only V1 certified production hardware. Guests select only the shot format and template, then receive a cloud landing-page QR through the approved Vercel + Neon + R2 stack when cloud share succeeds, or a clear fallback/local mode state when unavailable. Printing is guest-confirmed from the Result screen and runs through a durable FIFO print queue that survives guest reset and app restart. React Native, iPad and macOS production runtimes are out of V1 scope; macOS remains a development path using Device/Fake adapters.

## Core guest flow

```text
START / SHOWCASE
→ SELECT SHOT FORMAT
→ LIVE VIEW / AUTO CAPTURE
→ SELECT TEMPLATE
→ CUSTOMIZE, only if template allows typing/drawing
→ FINAL COMPOSITION
→ RESULT + CLOUD QR / fallback, with guest-confirmed queued print
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
- Cloud QR must point to a tokenized Vercel landing page backed by Neon/R2 and must not expose local absolute paths, raw R2 keys or secrets; local fallback QR, when configured, must not be `localhost`-only.
- QR/share tokens expire after 10 minutes from share/landing creation and remain durable across app restart until expiry.
- Cleanup eligibility defaults to 30 minutes for local/cloud session data, but print/share recovery guards must prevent unsafe deletion.
- Print/share side effects are idempotent and recoverable.
- Guest-confirmed print jobs are durable FIFO jobs; printer slowness queues jobs, while print failure stops the queue with no automatic retry until Admin manual reprint/resume.
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

### V3-012 — Cloud landing-page QR delivery with local fallback

As a guest, I want a QR code to download my final photo from the event landing page while the booth preserves local media and shows a clear fallback if sharing is unavailable.

Acceptance criteria:

- Share mode supports `DISABLED`, `CLOUD_LANDING_PAGE` and `LOCAL_NETWORK_URL` fallback/dev/offline mode for V1.
- V1 production cloud provider stack is Vercel landing page + Neon metadata/token records + R2 object storage for final-share media.
- 2-Phase Upload Workflow:
  * **Phase 1 (Lần 1 - Background Upload sau khi kết thúc chụp)**: Upload toàn bộ ảnh đơn gốc (`RAW_PHOTO`) và 1 video tổng hợp timelapse/sequence ghép từ các raw clip (`RAW_CLIP` / `TIMELAPSE_VIDEO`). Không upload các clip riêng lẻ.
  * **Phase 2 (Lần 2 - Upload sau khi render tại Màn hình QR)**: Upload ảnh khung hoàn thiện (`FINAL_IMAGE`) và video hoạt họa hoàn thiện (`FINAL_VIDEO`).
- Cloud Landing Page Viewer Experience:
  * Khách quét QR thấy ngay Final Image và Final Video ở vị trí nổi bật.
  * Có 2 nút tải riêng biệt cho Final Image và Final Video.
  * Có nút tải toàn bộ ảnh gốc và video timelapse chất lượng cao.
- QR uses a tokenized cloud landing-page URL for the final-share output when cloud share succeeds.
- QR/share token expires 10 minutes after share/landing creation and expiry is enforced server-side.
- App restart does not invalidate an unexpired durable QR/share token.
- QR URL does not expose local absolute paths, raw R2 object keys, bucket internals, signed secrets or full token secrets in logs.
- Cloud upload/retrieval failure shows an explicit QR unavailable/fallback state and does not delete outputs or originals.
- `LOCAL_NETWORK_URL` fallback, when configured, uses a tokenized local network URL that is not `localhost`-only and does not serve arbitrary files or directory listings.
- Cleanup for local/cloud share artifacts is eligible after 30 minutes only when no active session, share upload or print recovery dependency remains.
- Cloud QR PASS requires manual phone scan evidence against the deployed Vercel/Neon/R2 path; local QR PASS requires manual phone scan evidence on the same reachable network.

### V3-013 — Guest-confirmed print queue

As a guest, I want to confirm printing from the Result screen without blocking my QR/result experience.

Acceptance criteria:

- Print policy for V1 is `GUEST_CONFIRM`; no print job is created until the guest confirms printing from Result.
- Result screen offers one print confirmation action when printing is enabled and disables/guards duplicate taps after the request is accepted.
- Guest does not choose printer, paper, layout, photo order, copies or print profile.
- Print profile and copy count come from the selected template/event config; draft copy policy is Premium=2, Sheet=2 and Strip=1 pending final design approval.
- Print job has stable ID, durable persistence and duplicate prevention.
- Duplicate guest print taps, Result rerenders, Done, timeout or reset create only one intended durable print job.
- Confirmed jobs are processed through a durable FIFO print queue; printer slowness/busy state leaves later jobs queued and does not lose print intent.
- Guest session reset does not cancel, delete or stop queued/active print jobs.
- Printer failure appears as print status but QR/result remains available.
- Printer failure never deletes or invalidates captured media, share output, print output or durable job records.
- Any print job failure stops the queue, leaves later jobs queued, performs no automatic retry and requires Admin manual reprint/resume.
- Admin can view failed/pending jobs and manually reprint/resume through the hidden operator surface.
- Cleanup must not delete queued, submitting, submitted, printing, failed or review-required print jobs or their required files.
- The UI does not display `Printed successfully` merely because a command was dispatched.
- Printer PASS requires named Canon SELPHY CP1000 evidence through the Windows Print System on the Windows 10 x64 booth PC target.

### V3-014 — Result, timeout and reset

As a guest, I want a clear final screen with cloud QR/fallback and guest-confirmed print status while the booth resets safely after completion.

Acceptance criteria:

- Result screen shows final photo, cloud QR/local fallback or unavailable fallback, print status, Print action when enabled, Done and 120-second countdown.
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
