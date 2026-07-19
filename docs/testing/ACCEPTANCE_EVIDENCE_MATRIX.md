# PhotoBoothAI Acceptance Evidence Matrix

Status: PM requested for Sprint 1 readiness on 2026-07-19.

## Purpose

This matrix defines the evidence required to mark Sprint 1 stories complete. It prevents ambiguous claims such as treating mocks as hardware PASS.

## Evidence labels

| Label | Meaning | Can satisfy hardware PASS? |
|---|---|---:|
| Unit evidence | Pure functions, state machine, service logic tested in Vitest or equivalent | No |
| Integration evidence | Multiple app modules tested together with mocks/fakes | No |
| Browser/manual evidence | Manual validation in browser on development machine | No, unless it uses the claimed real device and is documented |
| Real camera evidence | Tested with named physical camera/capture hardware | Yes for camera-only claims |
| Real printer evidence | Tested with named physical printer and driver/path | Yes for printer-only claims |
| Real kiosk evidence | Tested on target kiosk/touchscreen machine | Yes for kiosk operation claims |
| Not applicable | Story has no hardware or runtime behavior claim | Not applicable |

## Hardware status rules

- `PASS`: tested on the claimed real device and evidence names the device/environment.
- `PARTIAL`: tested with mock, simulation, development browser only, or incomplete hardware coverage.
- `FAIL`: tested and did not meet acceptance criteria.
- `Not applicable`: docs/types/config-only behavior without hardware claim.

Never mark hardware-dependent behavior `PASS` from mocks.

## Sprint 1 evidence matrix

Frontend/UI stories must include a short design-taste audit note in browser/manual evidence: primary action, fallback action, visual hierarchy, motion level and preview/recovery safety.

| Story | Acceptance focus | Unit evidence | Integration evidence | Browser/manual evidence | Hardware evidence | Minimum completion status |
|---|---|---|---|---|---|---|
| PB-001 | Lint ignores generated MediaPipe assets without hiding app issues | Not required | Not required | Not required | Not applicable | `pnpm lint` output PASS |
| PB-002 | Hook lint fixes preserve behavior and cleanup | Hook tests where feasible | Booth hook/component flow where feasible | Manual capture/countdown smoke | PARTIAL unless tested on real camera | lint PASS + smoke evidence |
| PB-003 | Production build restored | Not required | Not required | Not required | Not applicable | `pnpm build` PASS |
| PB-004 | Test framework baseline | sample state/service test | test setup works with mocks | Not required | Not applicable | `pnpm test` PASS |
| PB-005 | Starter landing page replaced | Not required | route/component test optional | Home page and `/booth` navigation checked | Not applicable | browser/manual PASS |
| PB-006 | Capture error UI is explicit and retry-safe | error mapping test preferred | simulated capture failure | manual simulated error screen | PARTIAL unless real capture failure tested | simulated failure PASS |
| PB-007 | AI fallback UI keeps touch capture | gesture status logic test | broken MediaPipe mock/fake | broken/missing model browser check | PARTIAL unless target hardware tested | fallback PASS with no preview block |
| PB-008 | Session/photo types defined | TypeScript compilation | Not required | Not required | Not applicable | `pnpm build` or `tsc` PASS |
| PB-009 | Session storage CRUD and typed failure | service CRUD/failure tests | storage adapter integration | reload optional | Not applicable for hardware | unit/integration PASS |
| PB-010 | Photo storage saves/retrieves originals | service tests with blobs | storage integration with session | object URL manual check optional | Not applicable for hardware | unit/integration PASS |
| PB-011 | Unique session identity and metadata | session creation tests | booth session flow test | session ID visible/debug check optional | Not applicable for hardware | unit/integration PASS |
| PB-012 | Original capture saved before preview/output | capture-storage invariant test | capture → storage → preview | manual capture flow | PARTIAL unless real camera capture tested | integration PASS and hardware status labeled |
| PB-013 | Active session restored after reload | restore decision tests | storage/session restore integration | browser reload recovery | PARTIAL unless target kiosk tested | reload evidence PASS/PARTIAL |
| PB-014 | Storage tests cover happy and failure paths | CRUD/quota/corrupt tests | storage integration | Not required | Not applicable | `pnpm test` PASS |
| PB-022 | QR generated from saved photo/share route | QR payload tests | storage → QR service test | manual phone scan if available | Not applicable for printer/camera | unit + browser/manual PASS |
| PB-023 | Share route previews/downloads photo and handles missing/expired | route helper tests optional | storage-backed route test | mobile/browser route check | Not applicable | browser/manual PASS |

## Critical flow evidence

### Flow F1: Attract/start to QR output

Required evidence:

- browser/manual: attendee can start flow
- integration: saved photo can be used for QR/share route
- command: `pnpm lint`, `pnpm build`, `pnpm test`
- hardware: PARTIAL unless real target camera/kiosk used

Pass criteria:

- No original photo loss in the tested path.
- QR/share route opens saved media or safe placeholder when missing.

### Flow F2: AI failure fallback

Required evidence:

- MediaPipe unavailable scenario: missing asset, mocked initialization failure or equivalent
- preview remains available
- touch/manual capture remains available
- UI clearly labels AI disabled/failed

Pass criteria:

- AI failure does not transition booth to fatal error.
- User can continue via touch.

### Flow F3: Capture/storage failure recovery

Required evidence:

- simulated capture failure shows recoverable UI
- simulated storage write failure shows explicit storage error
- no successful capture is silently discarded

Pass criteria:

- Storage failure blocks completion if original cannot be preserved.
- Capture failure allows retry when safe.

### Flow F4: Session reload recovery

Required evidence:

- capture or create active session
- reload browser
- session restore or clear continue/start-new choice appears
- no active stored media is deleted unexpectedly

Pass criteria:

- Active session can be recovered where local storage permits.
- Abandoned cleanup does not affect active session.

## Story signoff template

Use this template in PR or delivery report:

```text
Story: PB-___
Owner:
Files changed:
Acceptance criteria:
- [ ] ...
Commands run:
- ...
Unit evidence:
Integration evidence:
Browser/manual evidence:
Hardware evidence: PASS | PARTIAL | FAIL | Not applicable
Hardware tested:
Hardware not tested:
Fallback behavior:
Known risks:
QA verdict:
Reviewer verdict:
Verifier verdict:
```

## Sprint 1 acceptance summary template

```text
Sprint 1 status: PASS | PARTIAL | FAIL
Stories completed:
Stories deferred by PM:
Commands:
- pnpm lint: PASS | FAIL
- pnpm build: PASS | FAIL
- pnpm test: PASS | FAIL
Critical flows:
- F1 attract/start to QR: PASS | PARTIAL | FAIL
- F2 AI fallback: PASS | PARTIAL | FAIL
- F3 capture/storage recovery: PASS | PARTIAL | FAIL
- F4 reload recovery: PASS | PARTIAL | FAIL
Hardware:
- Camera: PASS | PARTIAL | FAIL | Not tested
- Touchscreen/kiosk: PASS | PARTIAL | FAIL | Not tested
- Printer: Not applicable in Sprint 1
Media safety: PASS | FAIL
Remaining risks:
```

## QA checklist for Sprint 1

- Confirm all changed files are in approved scope.
- Confirm generated MediaPipe assets are not linted while app source remains linted.
- Confirm no customer media, blobs, secrets or sensitive local paths are logged.
- Confirm original capture is persisted before preview/output actions.
- Confirm object URLs/timers/recognizers are cleaned up.
- Confirm QR route does not expose local absolute paths.
- Confirm AI failure leaves touch capture usable.
- Confirm storage errors are explicit.
- Confirm hardware evidence is labeled correctly.

## Reviewer checklist for Sprint 1

- Architecture boundaries are preserved.
- Domain logic does not depend on React components.
- Storage services return typed failures.
- No hardcoded production camera IDs or printer names.
- MediaPipe inference cannot block live preview.
- Duplicate capture/action guards exist.
- Original media is not deleted by processing/share failures.

## Verifier checklist for Sprint 1

- Each completed PB story has acceptance evidence.
- QA PASS and Reviewer PASS are present; Reviewer did not return REQUEST_CHANGES.
- Any missing hardware evidence is marked PARTIAL, not PASS.
- Commands and test results are included.
- Fallback behavior is documented.
- Remaining risks are visible to PM.
