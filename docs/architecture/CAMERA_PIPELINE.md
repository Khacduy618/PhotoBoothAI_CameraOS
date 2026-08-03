# Camera Pipeline

This document defines the Phase 1 browser/local camera pipeline and the future Canon EOS 6D native pipeline boundary. Current Phase 1 implementation must not claim native Canon EDSDK support unless PM explicitly approves hardware scope and real-device evidence exists.

## Phase 1 browser/local pipeline

```text
device discovery
→ permission
→ stream open
→ preview ready
→ recognition sampling
→ capture readiness
→ countdown
→ capture from approved preview/source
→ preserve original
→ process derivative
→ persist session
→ download-ready output
```

## Future Canon EOS 6D native pipeline

```text
CameraOS boot
→ device/storage checks
→ start Camera Worker
→ initialize Canon EDSDK
→ discover Canon EOS 6D
→ open EDSDK session
→ register callbacks
→ start EVF Live View
→ live view frames to latest-frame buffer
→ UI displays preview with overlays
→ Session Controller sends camera.capture(commandId)
→ Canon shutter command
→ object event
→ download JPEG to temp file
→ validate JPEG
→ atomic rename to originals/capture_NN.jpg
→ commit metadata
→ next capture or compose
```

See `docs/architecture/CANON_6D_ENGINE.md` for the full native hardware track.

## Preview priority

Preview has priority over:

- MediaPipe recognition,
- composition/rendering,
- QR/share generation,
- print queue work,
- long storage scans.

Recognition and processing must be scheduled so they cannot block live preview.

## Capture success criteria

A capture is not successful until:

1. capture command is accepted by the active adapter,
2. source image exists,
3. original media is validated enough for the current adapter,
4. original media is persisted,
5. capture metadata is associated with a stable session/capture ID.

For future Canon native capture, success additionally requires object event correlation, JPEG download, decode/dimension validation and atomic file rename.

## Invariants

- one active preview stream/session owner unless explicitly supported
- no overlapping recognition call
- no duplicate capture in one capture transition
- original capture preserved before derivative/output actions
- failed print does not delete media
- camera disconnect creates explicit recoverable state
- browser/mock evidence is not Canon hardware PASS

## Adapter impact

Phase 1 should support browser/capture-card camera input behind an adapter boundary:

```text
BrowserMediaStreamAdapter / CaptureCardAdapter
  → preview stream
  → capture service
  → CaptureResult
  → photo storage
```

Future Canon native work should fit the same application contract:

```text
CanonEdsdkAdapter
  → command/event lifecycle
  → downloaded JPEG original
  → CaptureResult / StoredOriginal
```

UI and domain state should not depend on which adapter produced the capture.
