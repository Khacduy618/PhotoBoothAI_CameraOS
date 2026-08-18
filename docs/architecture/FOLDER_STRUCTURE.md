# Recommended Folder Structure

This structure supports a complete PhotoBoothAI product on MomentAI CameraOS while keeping platform services separate from booth-specific UI.

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
lib/
  ids.ts
  media.ts
  result.ts
  time.ts
types/
  camera.ts
  capture.ts
  errors.ts
  photo.ts
  printing.ts
  session.ts
  sharing.ts
config/
  booth.config.ts
  layout-templates.ts
  printer.config.ts
tests/
docs/
  product/
  architecture/
  testing/
.opencode/
  rules/
  skills/
```

## Phase 1 engine normalization target

For the Phase 1 planning reset, implementers should migrate incrementally toward the following engine-oriented structure without performing a big-bang rewrite:

```text
app/
  page.tsx
  booth/
    page.tsx
  share/
    [photoId]/
      page.tsx
components/
  app/
  booth/
  camera/
  composition/
  print/              # later only unless PM approves

domain/
  booth/
    booth-machine.ts
    booth-events.ts
    booth-state.ts
    booth-guards.ts
    booth-effects.ts
  session/
    session.model.ts
    session-policy.ts
  photo/
    photo.model.ts
    photo-policy.ts
  camera/
    camera.model.ts
    camera-capabilities.ts
  print/              # later only

services/
  camera/
    camera.service.ts
    camera-device.service.ts
    capture.service.ts
  recognition/
    recognition-scheduler.service.ts
    gesture-capture-policy.ts
  session/
    session.service.ts
  storage/
    storage-adapter.interface.ts
    indexeddb-storage.adapter.ts
    session-storage.service.ts
    photo-storage.service.ts
    object-url.service.ts
    quota.service.ts
  render/
    layout-compositor.service.ts
    render-plan.service.ts
    canvas-renderer.service.ts
    composition.service.ts
  print/              # later only

adapters/
  camera/
    camera-adapter.interface.ts
    browser-media-stream.adapter.ts
    capture-card.adapter.ts
    mock-camera.adapter.ts
    canon-6d.adapter.ts       # shell/doc only until PM approves native
  recognition/
    gesture-recognizer.interface.ts
    mediapipe-hand.adapter.ts
    noop-recognition.adapter.ts
  storage/
    browser-indexeddb.adapter.ts
    memory-storage.adapter.ts
  print/                       # later only

workers/
  recognition/                 # optional
  render/                      # later if needed
  print/                       # later only

hooks/
  use-booth-machine.ts
  use-camera.ts
  use-capture.ts
  use-gesture-recognizer.ts
  use-session-restore.ts
  use-output-customizer.ts
```

## Dependency direction

```text
app/pages
  → components
    → hooks
      → services
        → adapters
      → domain

services
  → domain/types
  → adapter interfaces

adapters
  → browser/native APIs

domain
  → pure TypeScript only
```

Do not allow:

```text
domain → React
domain → DOM
domain → navigator.mediaDevices
domain → canvas
domain → IndexedDB
domain → printer API
```

## Migration rules

- Current files may remain in place until touched by approved task work.
- Move toward `domain/*` only when extracting pure state/model logic.
- Move browser and hardware APIs behind `adapters/*`.
- Keep hooks as lifecycle coordinators, not domain owners.
- Keep render/composition services separate from setup preview components.
- Keep print folders/docs as future-only unless PM approves print scope.
- Keep Canon native files as doc/interface/shell only unless PM approves native EDSDK implementation.

Rules:

- screens render current booth state and dispatch events only
- hooks coordinate UI lifecycle, timers and subscriptions
- services own domain operations and typed failures
- adapters isolate browser, OS, printer, storage, AI and hardware APIs
- types define stable contracts and must not depend on React components
- tests mirror critical services, state transitions and hardware recovery paths
- original media must be stored before processing, sharing or printing derivatives
- optional features such as gesture recognition, printing and cloud sharing must have safe fallbacks

See also `docs/architecture/PHOTOBOOTH_COMPLETE_ARCHITECTURE.md`.
