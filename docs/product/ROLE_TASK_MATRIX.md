# PhotoBoothAI Role Task Matrix

Status: PM requested for Sprint 1 readiness on 2026-07-19.

## Purpose

This matrix makes backlog ownership explicit so Sprint 1 can start without ambiguity. It maps each backlog item to the primary role, supporting roles, recommended guidance references, expected outputs, QA focus and verifier evidence.

## Role definitions

| Role | Owns | Must not own alone |
|---|---|---|
| PM | scope, priority, sprint acceptance, final approval | technical implementation details |
| BA | requirements clarity, user impact, acceptance criteria | architecture implementation decisions |
| Architect | system boundaries, state machine, service/adapters, risk tradeoffs | unchecked scope expansion |
| Backend | services, state machine domain, storage, capture, sharing, printing adapters | kiosk UI decisions |
| Frontend | screens, hooks coordination, kiosk UX, recovery UI, accessibility | hardware/service internals |
| QA | test strategy, risk-based validation, failure scenario coverage | implementation ownership |
| Reviewer | correctness, maintainability, media safety, security, architecture compliance | scope approval |
| Verifier | acceptance evidence mapping and final PASS/PARTIAL/FAIL | implementation or review fixes |

## Guidance references by work type

These names refer to project guidance documents or role capabilities. They are not mandatory runtime-loadable skills unless the current agent environment lists them as available.

| Work type | Guidance/reference |
|---|---|
| storage/session/capture/printing service | Backend implementation guidance |
| kiosk screens/hooks/countdown/recovery UI | Frontend implementation guidance plus Design Taste Frontend guidance |
| tests, evidence and failure scenarios | Test design guidance |
| media safety, preview performance and hardware recovery review | Code review guidance |
| release acceptance and evidence mapping | Release verification guidance |
| toast/status feedback | Toast feedback guidance |

## Sprint 1 story ownership

| Story | Primary owner | Supporting roles | Guidance/reference | Expected output files | QA focus | Reviewer focus | Verifier evidence |
|---|---|---|---|---|---|---|---|
| PB-001 Stabilize lint config | Backend | QA | Backend implementation guidance | `eslint.config.mjs` if needed | `pnpm lint` no generated-file errors | generated assets ignored without hiding app source issues | command output |
| PB-002 Resolve hook lint errors | Frontend | Backend, QA | Frontend implementation guidance | `hooks/use-booth-machine.ts`, `hooks/use-gesture-recognizer.tsx` or related hooks | hook behavior smoke test | timer/track/recognizer cleanup, no duplicate async operations | lint/test output, manual flow |
| PB-003 Restore production build | Backend | Frontend, QA | Backend implementation guidance | source files causing build failures | `pnpm build` | no production-only regressions | build output |
| PB-004 Establish test baseline | QA | Backend, Frontend | Test design guidance | `vitest.config.ts`, test setup, sample tests | `pnpm test` stable | meaningful tests, not superficial snapshots | test output |
| PB-005 Replace starter landing page | Frontend | BA, PM | Frontend implementation guidance plus Design Taste Frontend guidance | `app/page.tsx`, `app/layout.tsx` if metadata changes | browser/manual route check | clear user entry point, no scope creep | screenshot/manual evidence |
| PB-006 Add capture error UI | Frontend | Backend, QA | Frontend implementation guidance plus Design Taste Frontend guidance, Toast feedback guidance only for non-critical status | camera/booth components and error UI | simulated capture failure | full-screen or visible recovery, no toast-only critical errors | failure scenario evidence |
| PB-007 Add AI fallback UI | Frontend | Backend, QA | Frontend implementation guidance plus Design Taste Frontend guidance, Toast feedback guidance | gesture status UI/components/hooks | broken MediaPipe asset manual test | preview not blocked, touch fallback prominent | browser/manual evidence |
| PB-008 Define session/photo types | Backend | Architect, QA | Backend implementation guidance | `types/session.ts`, `types/photo.ts`, `types/errors.ts` | type compilation | stable contracts, React-independent types | TypeScript/build evidence |
| PB-009 Implement session storage service | Backend | QA, Architect | Backend implementation guidance | `services/storage/session-storage.service.ts`, tests | CRUD and failure path tests | typed errors, local-first, no silent storage failure | unit test output |
| PB-010 Implement photo storage service | Backend | QA, Architect | Backend implementation guidance | `services/storage/photo-storage.service.ts`, tests | save/retrieve/delete and object URL cleanup | original preservation, quota handling | unit/integration evidence |
| PB-011 Create unique booth sessions | Backend | Frontend, QA | Backend implementation guidance | `services/session/session.service.ts`, hook integration | session ID creation test | stable session identity and metadata | unit/integration evidence |
| PB-012 Preserve original capture before preview | Backend | Frontend, QA, Reviewer | Backend implementation guidance | capture-storage integration code/tests | capture → storage → preview test | media safety invariant is enforced | integration evidence |
| PB-013 Restore active session after reload | Backend | Frontend, QA | Backend implementation guidance, Frontend implementation guidance plus Design Taste Frontend guidance | session restore service/hook/UI | reload recovery test | no active media loss, clear user choice | browser/manual + test evidence |
| PB-014 Test session and photo storage | QA | Backend | Test design guidance | storage test files | quota/corrupt/happy-path tests | tests validate real behavior | `pnpm test` output |
| PB-022 Generate QR code for saved photo | Backend | Frontend, QA | Backend implementation guidance, Frontend implementation guidance plus Design Taste Frontend guidance | `services/sharing/qr-generator.service.ts`, QR UI/tests | QR generated from saved media | no sensitive paths in URL, scannability | unit + manual scan evidence |
| PB-023 Implement share route | Frontend | Backend, QA | Frontend implementation guidance plus Design Taste Frontend guidance | `app/share/[photoId]/page.tsx`, storage read integration | mobile/manual route test | missing/expired states, privacy | browser/manual evidence |

## Sprint 1 support tasks

| Task | Primary owner | Supporting roles | Output | Evidence |
|---|---|---|---|---|
| Confirm Sprint 1 scope before code starts | PM | BA, Architect | sprint kickoff note or issue milestone | PM approval |
| Review target architecture before first implementation PR | Architect | Backend, Frontend | architecture notes on PR/issue | reviewer/verifier trace |
| Prepare test fixtures/mocks | QA | Backend | mock media blob/session fixtures | test output |
| Maintain acceptance evidence during implementation | Verifier | QA, Backend, Frontend | evidence checklist updates | PASS/PARTIAL/FAIL mapping |
| Scope review after each merged story | PM | Reviewer | story acceptance update | PM note |

## Ownership rules

- One primary owner per story.
- Supporting roles are required reviewers or contributors, not passive observers.
- Backend must not implement kiosk UI without frontend review.
- Frontend must not bypass services/adapters for hardware or storage work.
- QA must validate failure paths before Reviewer/Verifier signoff.
- Reviewer may request changes for media safety, preview performance or architecture violations.
- Verifier may mark a story PARTIAL if hardware evidence is missing, even when software tests pass.

## Sprint 1 readiness checklist

- PM has approved Sprint 1 story list.
- Architect confirms no architecture blockers for storage/session/QR.
- Backend confirms storage and state integration approach.
- Frontend confirms screens/hooks impacted by PB-005/PB-006/PB-007/PB-013/PB-023.
- QA confirms test setup and evidence matrix.
- Reviewer confirms media-safety checklist.
- Verifier confirms acceptance evidence checklist.
