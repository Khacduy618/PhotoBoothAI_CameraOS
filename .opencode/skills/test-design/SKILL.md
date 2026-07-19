---
name: test-design
description: Design risk-based unit, integration, E2E and hardware tests for CameraOS changes
compatibility: opencode
---

# Test Design

Before designing tests, confirm the story ID, sprint order and evidence requirements from `docs/product/SPRINT_1_DELIVERY_PLAN.md`, `docs/product/ROLE_TASK_MATRIX.md` and `docs/testing/ACCEPTANCE_EVIDENCE_MATRIX.md`. Do not validate future-sprint features as Sprint 1 acceptance without PM approval.

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

## PhotoBoothAI risk-based matrix

High-risk flows:

- attract/start to QR output
- capture succeeds but storage fails
- original saved but processing fails
- sustained gesture tries repeated captures
- user cancels countdown near zero
- camera disconnects during countdown/capture
- MediaPipe fails while preview is active
- print job is submitted repeatedly
- printer goes offline after job submission
- browser reload occurs after capture

Evidence categories:

- Unit: state machine, service contracts, guards
- Integration: capture-storage-preview-share, print queue retry
- Browser manual: camera permission, QR scan, reload recovery
- Hardware: real camera disconnect, real printer offline/paper-out, long-session stability

Never mark hardware-dependent acceptance `PASS` from mocks.
