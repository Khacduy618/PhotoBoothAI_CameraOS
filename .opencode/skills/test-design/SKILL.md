---
name: test-design
description: Design risk-based unit, integration, E2E and hardware tests for CameraOS changes
compatibility: opencode
---

# Test Design

Always consider:

- lost media
- duplicate capture
- duplicate print
- frozen preview
- disconnect
- AI failure
- storage failure
- printer failure
- restart recovery

Separate software evidence from real-device evidence.
