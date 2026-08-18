---
name: code-review
description: Review a CameraOS diff for correctness, media safety, preview performance, hardware recovery, security and missing tests
compatibility: opencode
---

# Code Review

Before reviewing, map the diff to the approved story order in `docs/product/GUEST_FLOW_V3_DELIVERY_PLAN.md`, role ownership in `docs/product/GUEST_FLOW_V3_ROLE_TASK_MATRIX.md`, evidence expectations in `docs/testing/GUEST_FLOW_V3_ACCEPTANCE_EVIDENCE_MATRIX.md`, and story acceptance criteria in `docs/product/GUEST_FLOW_V3_BACKLOG.md`.

For frontend UI diffs, also check that local Design Taste Frontend guidance was applied without compromising preview performance, accessibility or recovery clarity.

Return:

- verdict
- blocking findings
- non-blocking findings
- missing tests
- hardware assumptions
- requirement traceability
