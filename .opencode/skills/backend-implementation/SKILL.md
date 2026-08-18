---
name: backend-implementation
description: Implement CameraOS services, adapters, session logic, storage and printing with retry-safe behavior
compatibility: opencode
---

# Backend Implementation

Before coding, confirm the story ID and execution order from `docs/product/GUEST_FLOW_V3_DELIVERY_PLAN.md`, `docs/product/GUEST_FLOW_V3_ROLE_TASK_MATRIX.md`, `docs/testing/GUEST_FLOW_V3_ACCEPTANCE_EVIDENCE_MATRIX.md` and `docs/product/GUEST_FLOW_V3_BACKLOG.md`. Do not skip ahead to later-milestone services without PM approval.

Checklist:

- validate input
- explicit typed error
- bounded retry
- idempotency
- preserve originals
- no hardcoded device IDs
- no hardcoded printer names
- adapter boundary for browser, OS, printer, storage and AI APIs
- focused tests
- actual command results

## PhotoBoothAI service priorities

1. session and photo storage before processing/output
2. pure booth state machine with typed events
3. camera disconnect and permission recovery
4. QR/share services over saved media
5. print queue with stable job identity and duplicate guards
6. processing pipeline that preserves original captures

## Media safety contract

- Original media is written before derivative processing, sharing or printing.
- Service methods must return typed success/failure results.
- Storage failures are never swallowed.
- Print failures preserve media and logical print job identity.
- Cloud/network failures must not block local capture.
