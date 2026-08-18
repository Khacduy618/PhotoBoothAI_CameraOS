# System Architecture

## Platform and app

MomentAI CameraOS provides reusable camera application infrastructure.

PhotoBoothAI provides the first product experience.

Reusable platform concerns:

- camera adapter
- preview lifecycle
- recognition scheduling
- capture service
- processing service
- session service
- storage
- print service
- observability

PhotoBooth-specific concerns:

- booth templates
- countdown UX
- photo selection
- customer flow
- kiosk experience
- operator controls

## Required boundaries

UI depends on application services.

Application services depend on adapter interfaces.

Adapters depend on browser, OS or device APIs.

Domain state must not depend directly on React components.

## Engine boundary target

The Phase 1 planning reset moves implementation toward an engine-oriented boundary:

```text
app/pages
  → components
    → hooks
      → services
        → adapters
      → domain
```

Rules:

- `domain/*` stays pure TypeScript and owns state/model rules.
- `hooks/*` coordinate lifecycle and side effects.
- `services/*` own use-case orchestration and typed failures.
- `adapters/*` isolate browser, OS, native hardware, storage and printer APIs.
- `components/*` render state and dispatch user intent.

## Canon EOS 6D target boundary

Canon EOS 6D native integration is a future hardware track unless PM approves scope expansion.

Target shape:

```text
Photobooth UI
  → local app API / IPC
  → Session Controller
  → Camera Worker
  → CanonEdsdkAdapter
  → Canon EOS 6D over USB
```

Current Phase 1 may use browser/capture-card input through adapter boundaries, but must not claim Canon EDSDK PASS without named real-device evidence.

See also:

- `docs/architecture/CAMERA_PIPELINE.md`
- `docs/architecture/CANON_6D_ENGINE.md`
- `docs/architecture/FOLDER_STRUCTURE.md`
