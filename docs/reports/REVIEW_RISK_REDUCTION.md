# Reduce Stabilize POC Risks — Review Report

Ngày review: 2026-07-16

## Scope reviewed

Phase: `Reduce Stabilize POC Risks`

Scoped changes reviewed:

- `package.json`
  - Added `test` script.
  - Added Node engine `>=20.19.0`.
  - Added test dependencies.
- `pnpm-lock.yaml`
  - Updated dependency lockfile for test tooling.
- `vitest.config.ts`
  - Configured Vitest with `jsdom` and `@` alias.
- `hooks/use-booth-machine.ts`
  - Improved countdown timeout cleanup.
  - Added timeout and resolver refs.
  - Reset/unmount invalidates active countdown and prevents late capture/state updates.
- `hooks/use-booth-machine.test.tsx`
  - Added hook tests for initial state, ready transition, countdown capture, reset cancellation, unmount cancellation, and capture failure retry.
- `hooks/use-gesture-recognizer.test.tsx`
  - Added MediaPipe lifecycle tests with mocked MediaPipe APIs.
  - Added timer cleanup with `vi.useRealTimers()` in `afterEach`.
- `docs/MANUAL_SMOKE_TEST_CHECKLIST.md`
  - Added manual smoke checklist for Mac/browser/camera POC verification.
- `docs/HARDWARE_VERIFICATION.md`
  - Documented current Mac-only verification and explicitly unverified hardware.

## Commands reviewed as evidence

The following commands were run after the final timer cleanup fix and completed successfully:

```bash
pnpm test
pnpm lint
pnpm build
```

Observed evidence:

```text
Test Files  2 passed (2)
Tests       10 passed (10)
```

`pnpm lint` exited successfully with no lint findings.

`pnpm build` completed successfully with Next.js production build output.

## Reviewer verdict

**PASS**

## Blocking findings

None.

## Non-blocking findings

No unresolved non-blocking finding remains from the final blocker-focused re-review.

A previous non-blocking finding noted that `hooks/use-gesture-recognizer.test.tsx` should restore real timers after each test. This was resolved by adding:

```ts
afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});
```

## Acceptance criteria traceability

| Criterion | Review status |
|---|---|
| Test framework and `pnpm test` script added | PASS |
| Vitest config with `@` alias and jsdom | PASS |
| Countdown timeout cleanup improved | PASS |
| Booth machine lifecycle tests added | PASS |
| Gesture recognizer lifecycle tests added | PASS |
| Manual smoke checklist added | PASS |
| Hardware verification doc added and honest about Mac-only current verification | PASS |
| `pnpm test` passed | PASS |
| `pnpm lint` passed | PASS |
| `pnpm build` passed | PASS |

## Remaining risks

These are not blockers for this phase:

- Hardware readiness remains unverified because capture card, HDMI capture, external camera, printer, and kiosk touchscreen are not currently available.
- MediaPipe tests use mocks; real browser/WASM/model loading still requires manual verification.
- Hook tests reduce lifecycle risk but do not replace full browser E2E testing.
- Persistent photo storage and printing are not implemented yet.

## Final review decision

The reviewed phase is acceptable for the approved POC risk-reduction scope.

Final decision: **PASS**
