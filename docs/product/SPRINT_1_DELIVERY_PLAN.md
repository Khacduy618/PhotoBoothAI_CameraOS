# PhotoBoothAI Sprint 1 Delivery Plan

Status: PM requested for Sprint 1 execution readiness on 2026-07-19.

## Sprint 1 goal

Build a stable MVP core flow foundation:

```text
buildable app
→ tested baseline
→ single-photo session identity
→ original photo stored before preview/output
→ QR sharing route for saved media
→ explicit AI/capture fallback UI
```

Sprint 1 does not claim production camera/printer support. Hardware status remains `PARTIAL` unless tested on target real devices.

## Sprint 1 scope

Included stories:

- PB-001 Stabilize lint configuration
- PB-002 Resolve React hook lint errors
- PB-003 Restore production build
- PB-004 Establish test baseline
- PB-005 Replace starter landing page
- PB-006 Add explicit capture error UI
- PB-007 Add AI gesture fallback UI
- PB-008 Define session and photo domain types
- PB-009 Implement session storage service
- PB-010 Implement photo storage service
- PB-011 Create unique booth sessions
- PB-012 Preserve original capture before preview
- PB-013 Restore active session after reload
- PB-014 Test session and photo storage
- PB-022 Generate QR code for saved photo
- PB-023 Implement share route

Explicitly excluded from Sprint 1:

- multi-shot strips/collages
- printing integration
- gallery browsing
- admin dashboard
- filters, frames and event branding
- cloud sharing/email/SMS/social
- production hardware PASS claims

## Definition of Ready

A Sprint 1 story is ready only when:

- acceptance criteria exist in `docs/product/PRODUCT_BACKLOG.md`
- primary owner and supporting roles exist in `docs/product/ROLE_TASK_MATRIX.md`
- expected evidence exists in `docs/testing/ACCEPTANCE_EVIDENCE_MATRIX.md`
- implementation touches only the approved files/areas or PM approves scope change
- fallback behavior is known for any hardware/browser/API dependency

## Delivery order

### Phase 0: Pre-flight

Owner: Delivery lead

1. Inspect worktree.
2. Confirm branch is not `main`.
3. Read required source-of-truth docs and rules.
4. Confirm no unrelated changes are staged or modified.
5. Run baseline commands and record output:
   - `git status --short`
   - `pnpm lint`
   - `pnpm build`
   - `pnpm test`

Expected result:

- Existing failures are recorded before changes.
- No implementation starts without known baseline.

### Phase 1: Stabilize build and tests

Stories:

- PB-001
- PB-002
- PB-003
- PB-004

Primary roles:

- Backend: lint/build config and domain-safe fixes
- Frontend: hook lint fixes
- QA: test setup and baseline validation

Expected files/areas:

- `eslint.config.mjs`
- `hooks/`
- `vitest.config.ts`
- test setup files if needed
- existing test files or first state/service tests

Required validation:

- `pnpm lint`
- `pnpm build`
- `pnpm test`

Exit criteria:

- Pipeline commands pass or blockers are documented with PM decision.
- Hook cleanup avoids timers/recognizers/animation frame leaks.

### Phase 2: Attendee entry and fallback UI

Stories:

- PB-005
- PB-006
- PB-007

Primary roles:

- Frontend owns UI.
- Backend supports typed error/status shape.
- QA validates fallback behavior.

Required design step:

- Run a local Design Taste Frontend audit before implementation using `.opencode/skills/design-taste-frontend/SKILL.md` as guidance.
- Define design variance, motion intensity and visual density for the affected screens.
- Confirm the UI is not a generic placeholder and still protects preview performance, accessibility and recovery clarity.

Expected files/areas:

- `app/page.tsx`
- `app/layout.tsx` if metadata changes
- `components/booth/`
- `components/camera/`
- `hooks/use-gesture-recognizer.*`
- `hooks/use-booth-machine.*`

Required validation:

- manual browser check of home page and `/booth`
- simulated capture error
- MediaPipe failure fallback by missing/broken model path or mock

Exit criteria:

- Starter page is gone.
- AI failure does not block preview or touch capture.
- Capture failure shows clear recovery action.

### Phase 3: Domain contracts and local storage

Stories:

- PB-008
- PB-009
- PB-010
- PB-011
- PB-014

Primary roles:

- Backend owns types and services.
- QA owns storage tests.
- Architect reviews adapter/service boundaries.

Expected files/areas:

- `types/session.ts`
- `types/photo.ts`
- `types/errors.ts`
- `services/session/session.service.ts`
- `services/storage/session-storage.service.ts`
- `services/storage/photo-storage.service.ts`
- `services/storage/storage-adapter.interface.ts`
- service tests

Implementation notes:

- IndexedDB is preferred for browser local photo/session persistence.
- If IndexedDB wrapper is introduced, justify dependency or implement minimal wrapper.
- Original media and processed derivatives must be distinct.
- Object URL lifecycle must be explicit.

Required validation:

- session CRUD tests
- photo save/retrieve/delete tests
- storage write failure/quota scenario through mocks
- `pnpm test`

Exit criteria:

- Session ID exists before capture.
- Storage services return typed failures.
- Tests protect media-preservation invariant.

### Phase 4: Capture-to-storage integration

Stories:

- PB-012
- PB-013

Primary roles:

- Backend owns storage integration.
- Frontend owns recovery/restore UI.
- QA validates reload recovery.
- Reviewer focuses on media safety.

Expected files/areas:

- capture service or adapter files
- booth machine/hook integration
- session restore hook/UI
- tests for capture → storage → preview

Required validation:

- capture success writes original before preview actions
- reload after capture restores active session or provides clear continue/start-new choice
- processing/QR/print failures cannot delete original media

Exit criteria:

- No captured original is lost in tested happy path and failure path.
- Session recovery behavior is clear and tested.

### Phase 5: QR generation and share route

Stories:

- PB-022
- PB-023

Primary roles:

- Backend owns QR/share service.
- Frontend owns QR display/share route UI.
- QA validates manual scan and missing photo state.

Expected files/areas:

- `services/sharing/qr-generator.service.ts`
- `services/sharing/share-url.service.ts`
- `app/share/[photoId]/page.tsx`
- QR display component/screen as needed
- tests for QR payload and missing photo route

Implementation notes:

- MVP QR may be local-route based.
- Share URLs must not expose absolute local paths.
- Missing/expired media must show a safe user-facing message.

Required validation:

- QR generated from saved photo/session
- phone/manual scan if available
- missing/expired photo route check
- `pnpm test`

Exit criteria:

- Saved photo can be opened through QR/share route.
- Share route is mobile-readable.

## Role schedule by week

### Week 1

| Day | Backend | Frontend | QA | Reviewer/Architect |
|---|---|---|---|---|
| Day 1 | baseline, PB-001/PB-003 | inspect hooks, PB-002 start | baseline command evidence | architecture impact check |
| Day 2 | PB-004 support | PB-002 finish | test setup | review hook cleanup |
| Day 3 | PB-008 types | PB-005 landing | test first transition/service | review source boundaries |
| Day 4 | PB-009 session storage | PB-006 error UI | storage mock strategy | review typed errors |
| Day 5 | PB-010 photo storage | PB-007 AI fallback UI | fallback tests | review media safety |

### Week 2

| Day | Backend | Frontend | QA | Reviewer/Verifier |
|---|---|---|---|---|
| Day 6 | PB-011 session service | integrate active session UI | session tests | review session identity |
| Day 7 | PB-012 capture-storage | capture/error UI polish | capture-storage test | media safety review |
| Day 8 | PB-013 restore service | restore UI | reload recovery test | recovery review |
| Day 9 | PB-022 QR service | PB-023 share route | QR route/missing tests | privacy/security review |
| Day 10 | fix blockers | fix blockers | final QA | Reviewer + Verifier gates |

## Required commands

Run at baseline and before QA handoff:

```text
git status --short
pnpm lint
pnpm build
pnpm test
```

Run focused commands after affected changes:

- storage services: `pnpm test -- services/storage` or available equivalent
- hooks/components: `pnpm test -- hooks components` or available equivalent
- full Sprint 1 gate: `pnpm lint && pnpm build && pnpm test`

If the command runner does not support targeted patterns, run `pnpm test` and record evidence.

## QA handoff checklist

QA receives:

- changed files list
- story IDs implemented
- baseline command output
- final command output
- known failures or PARTIAL evidence
- manual browser steps taken
- hardware used or explicitly not used
- screenshots/video where UI behavior is relevant

QA must validate:

- no original-media loss in happy path
- capture/storage failure visible and recoverable
- AI failure does not block touch capture
- QR route does not expose sensitive paths
- reload recovery behavior

## Reviewer handoff checklist

Reviewer must inspect:

- architecture boundaries
- React components do not own service internals
- no hardcoded camera IDs/printer names
- no secrets/customer media/logged blobs
- duplicate action guards
- timers/tracks/object URLs cleanup
- original-media preservation before derivatives

## Verifier handoff checklist

Verifier maps each Sprint 1 story to:

- implementation evidence
- test evidence
- browser/manual evidence
- hardware evidence status: PASS/PARTIAL/FAIL/not applicable
- known risks
- acceptance criteria status

Sprint 1 cannot be reported complete while:

- QA returns FAIL
- Reviewer requests changes
- Verifier returns FAIL
- media-preservation evidence is missing

## Sprint 1 demo script

1. Open home page.
2. Start booth from PhotoBoothAI entry point.
3. Grant camera permission.
4. Confirm live preview.
5. Trigger capture/countdown.
6. Confirm original photo saved before preview/output.
7. Show preview/result.
8. Generate QR code.
9. Scan/open share route.
10. Reload browser and confirm active session restore or safe session choice.
11. Simulate MediaPipe failure and show touch fallback.
12. Simulate capture/storage error and show recovery.

## Sprint 1 done criteria

Sprint 1 is ready for PM acceptance when:

- all included stories meet acceptance criteria or PM explicitly defers them
- `pnpm lint`, `pnpm build`, `pnpm test` pass or PM accepts documented blocker
- QA PASS
- Reviewer PASS and not REQUEST_CHANGES
- Verifier PASS or acceptable PARTIAL only for hardware evidence
- frontend stories include a brief design-taste audit summary
- final report includes summary, files changed, commands, tests, pipeline impact, hardware tested/not tested, fallback behavior, acceptance status and risks
