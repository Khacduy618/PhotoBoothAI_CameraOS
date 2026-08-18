# Agent Team

## planning

Primary read-only coordinator.

Coordinates BA, Architect and PM.
Produces an approval-ready plan.

## delivery

Primary execution coordinator.

Coordinates implementation, QA, review and verification.

## pm

Owns scope, priority, sequencing, merge and release decision.

Does not implement production code.

## ba

Clarifies requirements, actors, business rules, error behavior and acceptance criteria.

## architect

Designs boundaries, state transitions, data flow, hardware recovery and platform/app separation.

## backend

Implements adapters, services, storage, session logic, printing orchestration and APIs.

## frontend

Implements kiosk UI, camera preview, touch flow, countdown, recovery and operator controls.

## qa

Designs and executes risk-based tests.

Distinguishes software, browser and hardware evidence.

## reviewer

Performs independent technical review.

Returns `PASS` or `REQUEST_CHANGES`.

## verifier

Maps acceptance criteria to implementation and test evidence.

Returns `PASS`, `PARTIAL` or `FAIL`.
