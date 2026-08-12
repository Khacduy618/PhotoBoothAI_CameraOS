---
name: state-machine-verification
description: Standards for verifying deterministic state transitions in PhotoBoothAI (Idle -> Countdown -> Capture -> Preview -> Print -> Reset).
---

# State Machine Integrity Verification Skill

## Rules for State Machine Design
1. **Deterministic Transitions**: State changes must be driven strictly through typed actions/events (`START_COUNTDOWN`, `CAPTURE_SUCCESS`, `PRINT_REQUESTED`, `RESET`).
2. **Gesture Guarding**: Prevent gesture events from triggering state transitions when not in allowed states (e.g., ignore hand gestures during `CAPTURE` or `PRINTING`).
3. **Recovery State**: If hardware fails, the state machine must transition to an explicit `HARDWARE_ERROR` or fallback state without discarding captured media.

## Verification Protocol
- Run Vitest state machine test suite: `pnpm test`
- Ensure all invalid transition attempts (e.g. `PRINT` directly from `IDLE`) throw or return unmodified state cleanly.
