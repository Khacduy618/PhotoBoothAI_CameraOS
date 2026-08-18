# Event Flow

## Gesture capture

```text
MediaPipe result
→ normalized gesture event
→ confidence and cooldown guard
→ booth event: CAPTURE_REQUESTED
→ countdown
→ capture
```

## Touch capture

```text
touch action
→ duplicate-action guard
→ booth event: CAPTURE_REQUESTED
→ countdown
→ capture
```

## Camera disconnect

```text
track ended
→ camera adapter event
→ booth recoverable error
→ show operator action
→ bounded reconnect
```

## Print retry

```text
print failed
→ preserve print job identity
→ recoverable error
→ operator retry
→ same logical job, new attempt
```
