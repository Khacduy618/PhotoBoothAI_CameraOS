---
name: hardware-recovery-testing
description: Standard operating procedure for simulating hardware failure modes (WebCam unplugged, Printer out of paper, printer disconnected) and testing recovery UI.
---

# Hardware Recovery & Failure Mode Testing Skill

## Critical Invariants
- **Never lose captured media silently.**
- **Never claim hardware support without real-device or simulated hardware evidence.**
- **Explicit recovery UI required for all hardware failures.**

## Test Matrix
1. **Camera Disconnect**:
   - Action: Unplug camera USB or disable media stream tracks.
   - Requirement: UI shows clear recovery dialog ("Camera Disconnected. Reconnecting..."). Media previously captured remains intact.
2. **Printer Failure / Out of Paper**:
   - Action: Mock printer error response / offline state.
   - Requirement: Capture media is preserved locally. Retry / Skip print options presented to user.
