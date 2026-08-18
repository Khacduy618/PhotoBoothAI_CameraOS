# Complete PhotoBoothAI Architecture

Status: PM approved for delivery on 2026-07-19.

## System boundary

MomentAI CameraOS provides reusable local-first camera infrastructure. PhotoBoothAI provides the event-facing booth product experience.

Reusable CameraOS concerns:

- camera adapters and stream lifecycle
- live preview lifecycle
- gesture/recognition scheduling
- capture service
- media processing pipeline
- session and storage services
- print queue and printer adapters
- sharing adapters
- observability and error handling

PhotoBoothAI-specific concerns:

- attract loop and kiosk screens
- booth mode selection
- countdown UX
- photo strip/collage templates
- event branding
- attendee actions and completion flow
- operator dashboard

## Layered architecture

```text
React screens and UI components
        ↓
Hooks and state-machine coordinator
        ↓
Application services
        ↓
Adapter interfaces
        ↓
Browser, OS, printer, storage and AI runtimes
```

Rules:

- React components do not own domain decisions.
- Hooks coordinate lifecycle and dispatch events.
- Services own domain operations and typed failures.
- Adapters isolate browser/OS/hardware APIs.
- Core capture and local storage do not depend on cloud availability.

## Primary runtime flow

```text
attract
→ camera-initializing
→ camera-ready
→ mode-selection/theme-selection (optional)
→ preview-ready
→ countdown
→ capturing
→ preserve original
→ processing derivative
→ preview
→ actions
→ qr-display and/or printing
→ session-complete
→ attract
```

## State model

### MVP states

- `attract`
- `camera-initializing`
- `camera-ready`
- `mode-selection`
- `theme-selection`
- `preview-ready`
- `countdown`
- `capturing`
- `capture-complete`
- `multi-shot-progress`
- `multi-shot-complete`
- `processing`
- `processing-complete`
- `preview`
- `actions`
- `qr-generation`
- `qr-display`
- `print-queued`
- `printing`
- `print-complete`
- `session-complete`
- `gallery`
- `admin`
- `camera-error`
- `capture-error`
- `processing-error`
- `storage-error`
- `print-error`
- `share-error`
- `fatal-error`

### Transition requirements

Every transition must define:

- current state
- event
- guard
- next state
- side effect
- failure state
- retry behavior

Example transitions:

| Current | Event | Guard | Next | Side effect | Failure |
|---|---|---|---|---|---|
| `attract` | `START_SESSION` | not storage-blocked | `camera-initializing` | create session | `storage-error` |
| `camera-initializing` | `CAMERA_READY` | stream valid | `camera-ready` | bind disconnect handlers | `camera-error` |
| `preview-ready` | `START_COUNTDOWN` | capture allowed | `countdown` | start timer | none |
| `countdown` | `CANCEL` | before capture | `preview-ready` | clear timer | none |
| `countdown` | `COUNTDOWN_COMPLETE` | capture allowed | `capturing` | start capture | `capture-error` |
| `capturing` | `CAPTURE_SUCCEEDED` | blob valid | `capture-complete` | write original | `storage-error` |
| `capture-complete` | `PROCESS` | original saved | `processing` | start derivative pipeline | `processing-error` |
| `processing` | `PROCESSING_FAILED` | original exists | `preview` or `processing-error` | use original fallback | `processing-error` |
| `actions` | `PRINT` | printer configured | `print-queued` | submit print job | `print-error` |
| `printing` | `PRINT_FAILED` | attempts remaining | `print-error` | preserve job identity | `fatal-error` |
| `actions` | `SHARE_QR` | photo available | `qr-generation` | generate QR | `share-error` |

## Services

### Camera service

Responsibilities:

- device discovery
- permission request
- stream open/reconnect/release
- track-ended detection
- requested vs actual constraints recording

Interface shape:

```ts
interface CameraService {
  discover(): Promise<CameraDevice[]>;
  connect(deviceId?: string): Promise<MediaStream>;
  disconnect(): void;
  reconnect(): Promise<MediaStream>;
  getStatus(): CameraStatus;
}
```

### Capture service

Responsibilities:

- single-flight capture from video/canvas
- capture ID generation
- original blob validation
- duplicate-capture guard

### Session service

Responsibilities:

- session ID creation
- active/completed/abandoned session lifecycle
- session timeout and restore decisions
- metadata updates

### Storage service

Responsibilities:

- persist original and processed media
- read photo/session by ID
- quota estimation
- retention cleanup
- session export

Storage implementation for MVP should prefer IndexedDB in browser contexts, with adapter isolation for later Node/local file system use.

### Processing service

Responsibilities:

- generate derivatives after original persistence
- compose photo strips/collages
- apply frames, text, logos and filters
- report latency and fallback to original on failure

### Sharing service

Responsibilities:

- generate QR payloads
- create local share route URLs
- support future cloud/email/SMS adapters

### Printing service

Responsibilities:

- print job identity and queue
- duplicate-print guard
- printer status and retry
- adapter-based OS/printer integration

### Recognition service

Responsibilities:

- MediaPipe initialization/disposal
- inference throttling
- normalized gesture events
- confidence and cooldown guards
- graceful fallback to touch

## Adapter interfaces

Adapters must not leak implementation details into UI or domain logic.

Required adapters:

- `CameraAdapter`: webcam first, future DSLR/Raspberry Pi camera.
- `StorageAdapter`: IndexedDB first, future file system/cloud.
- `PrinterAdapter`: mock first, CUPS/Windows/DNP future.
- `SharingAdapter`: local QR first, future cloud/email/SMS.
- `RecognitionAdapter`: MediaPipe first, mock/off fallback.

## Screen architecture

Required screen components:

- `AttractScreen`
- `CameraInitScreen`
- `ModeSelectionScreen`
- `ThemeSelectionScreen`
- `PreviewReadyScreen`
- `CountdownScreen`
- `CaptureScreen`
- `ProcessingScreen`
- `PreviewScreen`
- `ActionsScreen`
- `QRDisplayScreen`
- `PrintingScreen`
- `SessionCompleteScreen`
- `GalleryScreen`
- `AdminScreen`
- `ErrorScreen`

Screen rules:

- Screens render from current state; they do not mutate hardware directly.
- User actions dispatch booth events.
- Critical errors use full-screen recovery UI, not transient toast only.
- Toasts are allowed for non-critical success/info feedback.

## Complete folder structure target

```text
app/
  page.tsx
  booth/
    page.tsx
  share/
    [photoId]/
      page.tsx
  gallery/
    page.tsx
  admin/
    page.tsx
components/
  screens/
    attract-screen.tsx
    mode-selection-screen.tsx
    countdown-screen.tsx
    capture-screen.tsx
    processing-screen.tsx
    preview-screen.tsx
    actions-screen.tsx
    qr-display-screen.tsx
    printing-screen.tsx
    gallery-screen.tsx
    admin-screen.tsx
    error-screen.tsx
  booth/
  camera/
  ui/
hooks/
  use-booth-machine.ts
  use-camera.ts
  use-gesture-recognizer.ts
  use-session.ts
  use-printing.ts
services/
  camera/
    camera.service.ts
    camera-adapter.interface.ts
    webcam-camera.adapter.ts
  capture/
    capture.service.ts
  recognition/
    recognition.service.ts
    mediapipe-recognition.adapter.ts
  processing/
    processing.service.ts
    layout-compositor.service.ts
    frame-overlay.service.ts
  session/
    session.service.ts
  storage/
    storage-adapter.interface.ts
    indexeddb-storage.adapter.ts
    session-storage.service.ts
    photo-storage.service.ts
  sharing/
    qr-generator.service.ts
    share-url.service.ts
  printing/
    printer-adapter.interface.ts
    mock-printer.adapter.ts
    print-queue.service.ts
  logging/
    error-logger.service.ts
features/
  booth/
    machine/
      booth-machine.ts
      booth-machine.types.ts
      booth-machine.test.ts
types/
  camera.ts
  capture.ts
  errors.ts
  photo.ts
  session.ts
  printing.ts
  sharing.ts
config/
  booth.config.ts
  layout-templates.ts
  printer.config.ts
lib/
  ids.ts
  time.ts
  result.ts
  media.ts
docs/
  product/
  architecture/
  testing/
```

## Error handling

Typed error kinds:

- `camera-permission-denied`
- `camera-disconnected`
- `camera-open-failed`
- `capture-failed`
- `storage-quota-exceeded`
- `storage-write-failed`
- `processing-failed`
- `printer-offline`
- `print-job-failed`
- `share-generation-failed`
- `ai-initialization-failed`

Rules:

- Recoverable errors expose retry or skip where safe.
- Fatal errors require operator reset/support.
- Error logging excludes media blobs, secrets and sensitive paths.

## Testing architecture

- Unit: pure state machine, services, adapters, guards.
- Integration: capture → storage → preview → QR; multi-shot → compositor; print queue retry.
- E2E: attendee flow, operator recovery, gallery/share.
- Hardware: camera disconnect, printer offline, long-session stability.

## Rollback strategy

- Keep feature flags for gesture recognition, printing, multi-shot and processing enhancements.
- If a new output feature fails, fall back to saved original plus QR/local download.
- If MediaPipe fails, disable gesture and keep touch capture.
- If printer fails, preserve job and allow QR/share.
