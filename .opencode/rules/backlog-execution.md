# Backlog Execution Rules

These rules govern how agents execute PhotoBoothAI tasks after PM approval.

## Source order

Agents must follow this priority order when deciding what to do:

1. PM-approved scope and current user instruction
2. `docs/product/SPRINT_1_DELIVERY_PLAN.md` for Sprint 1 execution order
3. `docs/product/ROLE_TASK_MATRIX.md` for story ownership and role handoffs
4. `docs/testing/ACCEPTANCE_EVIDENCE_MATRIX.md` for required evidence
5. `docs/product/PRODUCT_BACKLOG.md` for story acceptance criteria
6. `docs/product/REQUIREMENTS_SPEC.md` for product intent
7. architecture docs and `.opencode/rules/*`

If these conflict, stop and ask PM rather than improvising.

## Task order

- Do not skip ahead to later sprint work without explicit PM approval.
- Sprint 1 implementation follows the phases in `SPRINT_1_DELIVERY_PLAN.md`.
- Work one approved story or tightly-related story group at a time.
- Do not introduce features from future backlog while implementing Sprint 1 foundations.
- If a blocker appears, document it and request PM decision before expanding scope.

## Role discipline

- Each story has one primary role owner.
- Supporting roles must review or validate their required area.
- Backend owns services, adapters, storage, capture and domain state.
- Frontend owns screens, hooks coordination, kiosk UX and visual implementation.
- QA owns risk-based validation and failure scenarios.
- Reviewer owns independent correctness/media-safety/security review.
- Verifier owns acceptance evidence mapping.

## Evidence discipline

- Every story report must map to acceptance criteria.
- Include commands run, test results, hardware tested/not tested and fallback behavior.
- Mock/browser evidence must not be reported as real hardware PASS.
- Hardware-dependent work ends with PASS, PARTIAL or FAIL.

## UI/UX discipline

- Frontend stories must include a taste/design audit before implementation.
- Apply local Design Taste Frontend guidance for layout, hierarchy, spacing, motion and anti-generic UI.
- Do not let visual polish compromise preview FPS, camera recovery, accessibility or media safety.
