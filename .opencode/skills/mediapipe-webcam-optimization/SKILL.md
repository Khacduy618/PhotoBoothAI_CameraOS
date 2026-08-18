---
name: mediapipe-webcam-optimization
description: Guidelines and architecture patterns for optimizing MediaPipe gesture/face detection alongside live webcam preview without causing main thread UI stutter or dropping frames.
---

# MediaPipe & Live Webcam Optimization Skill

## Core Principles
1. **Never block the Live Preview**: Main video element rendering must maintain a consistent 60 FPS.
2. **Offscreen Canvas & Web Worker Execution**: Run heavy MediaPipe inference models (`@mediapipe/tasks-vision` or `@mediapipe/camera_utils`) in background Web Workers or using `requestIdleCallback` / `OffscreenCanvas`.
3. **Throttled Inference Frequency**: Decouple camera frame rate (e.g. 30/60 fps) from gesture detection rate (e.g. 10-15 fps). Do not run inference on every single video frame.

## Implementation Standard

```typescript
// Example: Decoupled Worker Message Flow for MediaPipe
let lastInferenceTime = 0;
const INFERENCE_INTERVAL_MS = 80; // ~12 fps inference rate

function onCameraFrame(videoFrame: ImageBitmap) {
  const now = performance.now();
  if (now - lastInferenceTime >= INFERENCE_INTERVAL_MS) {
    lastInferenceTime = now;
    worker.postMessage({ type: 'DETECT_GESTURE', frame: videoFrame }, [videoFrame]);
  }
}
```

## Verification Checklist
- [ ] Camera preview video maintains 60 FPS during active gesture detection.
- [ ] No sustained gesture triggers continuous photo capture loops.
- [ ] Worker terminates cleanly when leaving active booth state.
