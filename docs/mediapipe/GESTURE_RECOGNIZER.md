# Gesture Recognizer

Gesture recognition is optional.

## Requirements

- preview remains active if recognition fails
- touch/operator input remains available
- raw MediaPipe output is normalized
- confidence threshold is explicit
- cooldown prevents repeated capture
- recognizer resources are closed during cleanup

## Event contract

```ts
type GestureEvent =
  | { type: "capture-requested"; confidence: number }
  | { type: "cancel-requested"; confidence: number }
  | { type: "none" };
```
