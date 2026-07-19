# PhotoBoothAI Requirements Specification

Status: PM approved for delivery on 2026-07-19.

## Goal

Define the product requirements for a complete PhotoBoothAI experience on MomentAI CameraOS. The product must guide non-technical event attendees through capture, output and recovery while keeping captured media safe.

## Actors

### Event attendee

- Starts a booth session without staff help.
- Uses touch or gesture to trigger capture.
- Expects clear countdown, immediate preview, retake and output options.
- Needs QR/download and optional physical print.

### Booth operator

- Keeps the booth running during an event.
- Needs explicit camera, AI, storage and printer status.
- Needs clear recovery actions for common failures.
- Needs print queue and log visibility.

### Event organizer

- Wants branded output and a reliable guest experience.
- Needs access to gallery/export after the event.
- Wants usage signals without collecting unnecessary personal data.

### System administrator

- Sets up hardware and configuration.
- Validates cameras, printers, storage and software health.
- Needs logs and repeatable diagnostics.

## Critical user journeys

### J1: Single-photo capture and QR output

1. Booth shows attract screen.
2. Attendee starts session by touch or approved gesture.
3. Camera initializes and shows live preview.
4. Attendee triggers countdown.
5. Booth captures photo.
6. Original photo is preserved.
7. Booth processes optional derivative.
8. Attendee previews result.
9. Attendee chooses QR/share, print, retake or done.
10. Booth returns to attract screen after completion or timeout.

Acceptance criteria:

- Start action transitions to camera flow within 1 second on supported hardware.
- Countdown clearly shows 3, 2, 1 and does not trigger duplicate captures.
- Original capture is stored before preview/output actions.
- QR code opens a photo download or local share page.
- Retake does not delete previous original until session cleanup policy applies.

### J2: Multi-shot strip/collage

1. Attendee chooses a layout mode.
2. Booth captures 2-4 photos with countdown before each shot.
3. Each original capture is saved independently.
4. Layout compositor generates print/share-ready derivative.
5. Attendee previews final strip/collage.

Acceptance criteria:

- UI displays current shot progress.
- Partial captures survive failure.
- Layout output dimensions are configurable.
- Composition failure does not delete original captures.

### J3: Print output

1. Attendee chooses print from actions screen.
2. Booth submits a print job with stable job identity.
3. Print queue shows queued/printing/complete/failed.
4. Printer failure preserves the photo and job for retry.

Acceptance criteria:

- Duplicate print taps do not submit duplicate logical jobs.
- Printer offline is recoverable and does not invalidate captured media.
- Real printer support is not claimed without evidence.

### J4: Operator recovery

1. Camera disconnect, permission denial, AI failure, storage failure or printer failure occurs.
2. Booth enters explicit recoverable or fatal error state.
3. UI shows clear recovery action.
4. Operator retries, skips optional output, or escalates.

Acceptance criteria:

- Camera disconnect cancels countdown/capture safely.
- AI failure disables only gesture recognition, not preview/touch capture.
- Storage failure blocks completion if original cannot be preserved.
- Printer failure keeps QR/download available.

## Functional requirements

### Attract and start

- Show event branding, clear call-to-action and optional recent-safe slideshow.
- Support touch start and approved gesture start.
- Timeout incomplete flows back to attract screen.

### Camera and preview

- Request camera permission explicitly.
- Show live mirrored preview if configured.
- Keep one intended active stream per session unless multi-camera support is explicitly introduced.
- Stop tracks on release.
- Detect track-ended disconnects.

### Gesture recognition

- MediaPipe inference must be scheduled so it never blocks preview.
- Gesture events require confidence threshold and cooldown.
- Sustained gesture must not trigger unlimited captures.
- Touch remains fallback.

### Capture

- Countdown must be cancellable before capture.
- Capture operation must be single-flight.
- Original capture must be persisted before processing/output.
- Capture failures must be explicit and retry-safe.

### Processing

- Apply derivatives such as layout, overlay, frame, filter or QR embedding only after original preservation.
- Processing failure falls back to original or a recoverable error.
- Processing must report latency.

### Sharing

- Generate QR code for saved photo/session.
- Share route must show preview/download or clear missing/expired state.
- Cloud sharing and email are optional post-MVP features unless PM approves backend scope.

### Printing

- Printing uses adapter interface.
- Print jobs have stable identity and bounded retry.
- Printer failure never deletes captured media.
- Print support requires real-device evidence before PASS claim.

### Gallery

- Browse sessions/photos stored locally.
- Re-share and reprint through existing sharing/printing services.
- Honor retention and cleanup policies.

### Admin and configuration

- Provide status for camera, AI, storage, printer and recent errors.
- Support event branding configuration.
- Avoid hardcoded production camera device IDs, printer names or sensitive local paths.

## Non-functional requirements

### Performance

- Preview FPS target: at least 15 FPS on target kiosk hardware.
- Capture latency target: less than 500 ms from trigger to blob on target hardware.
- Processing target: less than 2 seconds for 4-photo layout where possible.
- QR generation target: less than 1 second.
- Never run heavy synchronous work on the live preview path.

### Reliability

- Session recovery after browser reload should restore active session where local storage permits.
- Storage writes should fail explicitly.
- Retention cleanup must not delete active sessions.

### Privacy and security

- Do not store biometric templates or raw MediaPipe internals.
- Do not log customer photos, secrets, tokens or sensitive absolute paths.
- Retain photos based on configurable policy, default 7 days.
- Email/SMS/social sharing require explicit consent when introduced.

## Hardware assumptions

- Camera: USB webcam or capture-card camera, 1080p preferred.
- Touch: touchscreen or mouse fallback.
- Printer: OS-supported photo printer; exact model must be validated.
- Deployment browser: Chromium-based desktop browser for MVP.

## Open PM decisions

- Is DSLR/gphoto2 required for MVP or post-MVP?
- Which printer model is the first target for real hardware testing?
- Should QR sharing be local-only for MVP or backed by cloud storage?
- What is the production retention period per event/customer?
- What access control is required for admin panel?
