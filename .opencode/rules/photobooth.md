# PhotoBoothAI Rules

These rules apply to all PhotoBoothAI product work on MomentAI CameraOS.

## Media safety

- Preserve the original capture before processing, sharing, printing or deleting anything.
- Processing derivatives may fail; originals must remain accessible.
- Print failures must never delete photos or invalidate the session.
- Retake must not delete previous originals unless the session cleanup policy explicitly applies.
- Storage failures must be explicit and user/operator visible.

## Booth flow

- Use explicit booth states and events.
- Avoid booleans that can describe impossible flow combinations.
- Every attendee action must be duplicate guarded.
- Sustained gestures must have confidence threshold and cooldown.
- Touch capture is the required fallback when AI is unavailable.
- Timeout behavior must be explicit and documented.

## Hardware

- Do not hardcode production camera device IDs or printer names.
- Camera, printer, storage, sharing and AI integrations must sit behind adapters.
- Hardware support requires real-device evidence before PASS claim.
- Mock evidence may be used for development but must be reported as PARTIAL.

## UI, taste and recovery

- Frontend tasks must apply the local Design Taste Frontend guidance or equivalent taste audit before implementing customer/operator screens; this is a project guidance reference unless exposed as a runtime-loadable skill.
- Avoid generic placeholder UI for approved attendee-facing screens.
- UI may be cinematic and expressive, but preview performance, accessibility and recovery clarity are non-negotiable.
- Critical errors use full-screen recovery UI, not toast alone.
- Toasts may be used for non-critical success/info feedback.
- Operator-facing errors must include likely cause and next action.
- Customer-facing text must be short, large and action-oriented.
- The booth must always prefer a usable fallback over a dead end.

## Privacy

- Do not log media blobs, customer photos, biometric templates, secrets or sensitive local paths.
- Share links must not expose local absolute paths.
- Email/SMS/social features require explicit user consent when implemented.
- Retention and cleanup policy must be configurable and documented.
