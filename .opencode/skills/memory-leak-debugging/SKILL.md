---
name: memory-leak-debugging
description: Diagnostic procedures for inspecting memory growth, Heap Snapshots, and GPU buffer retention in long-running PhotoBooth kiosk applications.
---

# Memory Leak Debugging & Kiosk Profiling Skill

## Objectives
PhotoBoothAI CameraOS runs in long-standing kiosk mode. Memory allocations must remain flat over hundreds of session cycles.

## Key Inspection Points
1. **Video & Canvas Contexts**: Ensure `<video>` streams and 2D/WebGL canvas contexts are explicitly cleaned up when resetting sessions (`video.srcObject = null`, `canvas.width = 0`).
2. **MediaPipe Model Lifecycle**: Ensure model memory buffers and WebGL textures are freed upon component unmount.
3. **Event Listeners**: Ensure custom DOM and EventTarget listeners (e.g. keypress, resize, hardware events) are removed.

## Heap Profiling Steps
1. Use `chrome-devtools` MCP or Chrome DevTools Memory Panel.
2. Take baseline snapshot (`HeapSnapshot_1`) at Idle state.
3. Trigger 5 complete photo capture & print sessions.
4. Force Garbage Collection and take `HeapSnapshot_2`.
5. Delta must show zero growing detached DOM nodes or uncollected `ArrayBuffer` objects.
