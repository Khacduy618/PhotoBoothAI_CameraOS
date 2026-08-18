# MediaPipe Performance

Use:

- one inference at a time
- minimum inference interval
- monotonic timestamps
- frame skipping
- measured inference duration
- cleanup on unmount

Do not run recognition at full preview frame rate unless profiling proves it is safe.
