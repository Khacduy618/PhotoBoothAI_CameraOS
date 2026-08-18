# MediaPipe Troubleshooting

## Invalid or stalled recognition

Check:

- recognizer initialized
- video ready state
- video dimensions
- timestamp monotonicity
- no concurrent call
- model path accessible
- WASM loading
- cleanup and reinitialization

## XNNPACK log

Informational runtime logs are not necessarily application errors.

Focus on the actual exception, model loading, timestamp and concurrent-call behavior.
