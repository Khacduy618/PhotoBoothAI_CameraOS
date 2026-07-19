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
