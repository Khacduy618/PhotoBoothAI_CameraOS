# State Machine Rules

Use explicit states and events.

Every transition defines:

- current state
- event
- guard
- next state
- side effect
- failure
- retry

Avoid conflicting booleans that represent impossible states.

## PhotoBoothAI state coverage

State coverage follows the approved sprint plan. Do not require later-sprint states during Sprint 1 unless PM explicitly expands scope.

Sprint 1 state families:

- attract and idle states
- camera initialization and camera-ready states
- live preview and capture readiness states
- countdown, cancellation and single capture states
- original-preservation and storage states
- preview and QR/share states
- recoverable error states for capture, AI and storage failures
- fatal error states where recovery is not safe

Later-sprint state families:

- mode/theme selection states
- multi-shot progress states
- advanced processing and derivative generation states
- print queue and printing states
- gallery and admin states

State machine logic should be testable without React. Hooks coordinate lifecycle and side effects; pure transition rules belong in a domain module.

## Recovery rules

- camera disconnect transitions to a recoverable camera error
- AI initialization failure disables gesture and preserves touch capture
- storage failure blocks completion if original media is not preserved
- printer failure returns to actions or recoverable print error without deleting media
- processing failure may fall back to original media when safe
