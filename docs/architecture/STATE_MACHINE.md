# Booth State Machine

Recommended states:

```text
idle
camera-initializing
camera-ready
countdown
capturing
processing
previewing
selecting
printing
completed
recoverable-error
fatal-error
```

Every transition defines:

- current state
- event
- guard
- side effect
- next state
- failure state
- retry behavior

Examples:

```text
camera-ready + START_COUNTDOWN → countdown
countdown + COUNTDOWN_FINISHED → capturing
capturing + CAPTURE_SUCCEEDED → processing
processing + PROCESSING_SUCCEEDED → previewing
printing + PRINT_FAILED → recoverable-error
```
