# Performance Rules

Measure before optimizing.

Track:

- preview FPS
- inference duration
- capture latency
- processing latency
- storage write latency
- QR generation latency
- print queue latency
- memory growth
- CPU usage
- long-session stability

Never block preview with synchronous heavy work.

## PhotoBoothAI targets

Targets are acceptance goals, not unverified claims:

- preview FPS: at least 15 FPS on target kiosk hardware
- capture latency: less than 500 ms from trigger to blob where hardware permits
- original storage write: less than 100 ms for typical photo blob where storage permits
- QR generation: less than 1 second
- 4-photo layout processing: less than 2 seconds where hardware permits

If targets are not measured on real hardware, report `PARTIAL` and include the test environment.
