---
name: release-verification
description: Map acceptance criteria to implementation, test, review and real-hardware evidence before release
compatibility: opencode
---

# Release Verification

Before verification, map completed work to `docs/product/GUEST_FLOW_V3_DELIVERY_PLAN.md`, `docs/product/GUEST_FLOW_V3_ROLE_TASK_MATRIX.md`, `docs/testing/GUEST_FLOW_V3_ACCEPTANCE_EVIDENCE_MATRIX.md` and `docs/product/GUEST_FLOW_V3_BACKLOG.md`.

For frontend UI work, verify that local design-taste evidence exists when required and that visual polish did not compromise preview performance, accessibility or recovery clarity.

Verdict:

- PASS
- PARTIAL
- FAIL

Never return PASS for hardware-dependent work without real-device evidence.
