# Canon EOS 6D Engine Architecture

Status: Planning / future native-hardware track  
Source reference: `docs/product/MomentAI_CameraOS_Canon_6D_Photobooth_Flow_v1.2.md`  
Phase 1 policy: native Canon EDSDK implementation is not approved unless PM explicitly expands scope.

## Purpose

This document defines the target CameraOS engine structure for a Canon EOS 6D-backed PhotoBoothAI deployment.

It separates the current browser/local Phase 1 flow from the future native Canon EOS 6D hardware track so implementers can build clean adapter boundaries without making unsupported hardware claims.

## Scope boundary

### Current Phase 1 allowed scope

- Browser/local photobooth flow.
- Setup/readiness.
- Realtime setup preview.
- Browser camera or capture-card preview through browser APIs.
- Capture originals locally.
- Preserve originals before derivatives.
- Compose/customize/download final output.
- Honest hardware labeling.

### Not approved in Phase 1 without PM expansion

- Canon EDSDK native implementation.
- Native Camera Worker process.
- USB Canon EOS 6D production support claim.
- SQLite/filesystem migration as a hard runtime requirement.
- Print queue or printer adapter.
- Cloud-backed sharing.
- Production hardware PASS claims without named real-device evidence.

## Target engine architecture

```text
Photobooth UI
  ↓ local IPC / WebSocket / app API
App Backend / API Gateway
  ↓
Session Controller
  ├── Camera Worker
  │     └── CanonEdsdkAdapter
  │           └── Canon EOS 6D over USB
  ├── LiveViewService
  ├── Composition Worker
  ├── StorageService
  │     └── SQLite + filesystem in native runtime
  ├── PrintService
  │     └── Print Queue + CUPS/vendor adapter
  └── DeviceMonitor
```

## Required boundaries

- UI must not call Canon EDSDK directly.
- UI must not send print jobs directly to OS/vendor drivers.
- Camera Worker is the single owner of the Canon EDSDK session and camera handle.
- Session Controller owns capture sequencing and state transitions.
- Composition Worker must not block Camera Worker.
- Print Worker must not block Camera Worker.
- StorageService must preserve originals before processing, sharing or printing.
- Printer failure must never delete or invalidate captured media.

## Canon 6D connection model

For Canon EOS 6D đời đầu:

```text
Canon EOS 6D
  ├── USB + EDSDK: control, EVF Live View, shutter, object event, JPEG download
  └── HDMI + capture card: optional preview fallback only, not final image source
```

CCAPI is not the target implementation path for the original Canon EOS 6D.

## Camera Worker lifecycle

```text
START WORKER
  ↓
Initialize EDSDK
  ↓
Discover Canon EOS 6D
  ↓
Acquire CameraOS camera lock
  ↓
Open EDSDK session
  ↓
Register object/property/state callbacks
  ↓
Set save destination/capacity
  ↓
Start EVF Live View
  ↓
CAMERA_READY
  ↓
Keep session and pump event loop
```

Do not open and close the EDSDK session for every capture.

## Worker commands

The Camera Worker should expose bounded commands with `commandId`, `sessionId`, timeout and typed result:

```text
camera.connect
camera.disconnect
camera.startLiveView
camera.stopLiveView
camera.capture
camera.download
camera.getProperties
camera.setProperty
camera.keepAlive
camera.reset
```

## Worker events

```text
camera.connected
camera.ready
camera.liveViewFrame
camera.captureStarted
camera.imageAvailable
camera.imageDownloaded
camera.busy
camera.disconnected
camera.error
```

`commandId` correlates command/result and prevents duplicate shutter behavior. `sessionId` prevents a stale camera event from attaching to the wrong booth session.

## Live View target flow

```text
Canon EOS 6D EVF frame
  → Camera Worker
  → latest-frame buffer
  → local IPC/WebSocket
  → Photobooth UI
  → UI overlay guide/countdown
```

Rules:

- Prefer low latency over displaying every frame.
- Keep only the latest frame.
- Drop stale frames if UI is slow.
- Cap EVF frame delivery around 12–20 FPS until measured on target hardware.
- UI overlays are not written into originals.
- If frames stall, enter `LIVE_VIEW_DEGRADED` and restart EVF before full reconnect.

## Capture target flow

A capture is successful only after all required steps complete:

```text
Session Controller
  → camera.capture(commandId, sessionId, captureIndex)
  → Canon shutter command
  → object event for new image
  → download JPEG to temporary file
  → validate JPEG decode/dimensions
  → atomic rename to capture_NN.jpg
  → commit capture metadata
  → emit capture completed
```

Rules:

- Capture is single-flight.
- Do not send the next capture while current capture is `CAPTURING`, `WAITING_IMAGE`, `DOWNLOADING` or `VALIDATING`.
- Do not increment `captureIndex` just because the shutter command was accepted.
- Increment `captureIndex` only after the original JPEG is downloaded, validated and persisted.
- Preserve partial captures when later captures fail.

## Storage target structure

Native Canon 6D deployments should persist sessions under a predictable local structure:

```text
sessions/
└── YYYY-MM-DD/
    └── session_<timestamp>_<id>/
        ├── session.json
        ├── originals/
        │   ├── capture_01.jpg
        │   └── capture_02.jpg
        ├── archive/
        ├── thumbnails/
        ├── processed/
        ├── output/
        │   ├── final-master.png
        │   ├── final-share.jpg
        │   └── final-print.jpg
        ├── print/
        └── logs/
```

Use atomic writes:

```text
capture_01.jpg.part
  → validate
  → rename capture_01.jpg
  → commit metadata
```

## State machine additions for native track

Future native Canon states extend the Phase 1 browser/local state machine:

```text
DEVICE_CHECK
CONNECTING_CAMERA
CAMERA_READY
LIVE_VIEW
COUNTDOWN
CAPTURING
WAITING_IMAGE
DOWNLOADING
VALIDATING
CAPTURE_PREVIEW
REVIEW
COMPOSING
SHOW_RESULT
COMPLETED
```

Future/native error states:

```text
CAMERA_DISCONNECTED
CAMERA_BUSY
LIVE_VIEW_STALLED
CAPTURE_TIMEOUT
DOWNLOAD_FAILED
INVALID_IMAGE
STORAGE_FULL
COMPOSITION_FAILED
PRINTER_OFFLINE
PRINT_FAILED
FATAL
```

Printing states remain out of Phase 1 unless PM approves print scope.

## Recovery rules

### USB disconnect

```text
USB disconnected
  → Camera Worker emits camera.disconnected
  → Session Controller freezes current capture
  → mark session INTERRUPTED
  → preserve already downloaded originals
  → terminate stale worker if handle is invalid
  → detect Canon 6D again
  → create new Camera Worker
  → open session and start EVF
  → reconcile captureIndex from storage
  → allow retake/continue from safe point
```

Do not reuse a native camera handle after USB loss if EDSDK state is unknown.

### Download failure

- Retry download with bounded attempts.
- Do not advance capture index.
- Allow retake of the same capture index.
- Preserve previous valid originals.

### Storage failure

- Block successful completion if original cannot be preserved.
- Keep in-memory recovery only as temporary fallback when possible.
- Show operator-visible storage error.

### Printer failure

- Preserve output and print job.
- Allow retry/skip according to print policy.
- Keep download/share result available when approved.

## Adapter strategy

Current Phase 1 should keep browser/capture-card support as the primary runtime path:

```text
BrowserMediaStreamAdapter / CaptureCardAdapter
  → MediaStream preview
  → capture service returns CaptureResult
  → photo storage preserves original
```

Future Canon native adapter should return the same application-level result shape:

```text
CanonEdsdkAdapter
  → object event + downloaded JPEG
  → CaptureResult / StoredOriginal
```

This lets UI and booth domain logic remain adapter-independent.

## Evidence policy

- Browser webcam or mock camera evidence: `PARTIAL` for hardware claims.
- Canon EOS 6D PASS requires named real Canon body, OS, EDSDK version, connection path and successful capture/download evidence.
- Printer PASS requires named printer, driver/path and queue/retry evidence.
- Docs-only changes are `Not applicable` for hardware.

## Implementation gate

Before implementing native Canon 6D work, PM must approve:

- target OS,
- native runtime approach,
- EDSDK license/version,
- available Canon EOS 6D hardware,
- test plan,
- evidence owner,
- rollback/defer policy.

Until then, this document is an architecture target and planning reference only.
