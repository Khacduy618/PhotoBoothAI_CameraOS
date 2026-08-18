# MomentAI Guest Flow V3 — Role Task Matrix

Status: Active role ownership matrix for Guest Flow V3, updated for Production Brief v3.1 PM decisions.

## PM decisions applied

- Production target: Windows 10 x64 booth PC / Mini PC form factor.
- V1 Share/QR: `LOCAL_NETWORK_URL` preferred with explicit unavailable/disabled fallback; cloud provider deferred unless approved.
- V1 Print: `GUEST_CONFIRM` durable print queue.
- V1 Retake: deferred from Guest UI; later admin-configurable policy only.
- Canon Command Shadow Mode: after fake/device capture loop and before physical Canon spike; never hardware PASS evidence.

## Role rules

| Role | Owns |
|---|---|
| PM | scope, priority, deletion approval, product configuration decisions, final acceptance |
| BA | guest flow clarity, copy, business rules, acceptance criteria |
| Architect | boundaries, state machine, Electron main/preload/renderer split, service/adapters, hardware lifecycle, readiness gates |
| Backend | SessionController, Electron main services, system health, storage, capture, composition, local share/QR, print queue |
| Frontend | guest screens, Electron renderer UI, hidden admin/operator UI, kiosk UI, preview, customization, result UI |
| QA | risk-based software/browser/hardware/network tests |
| Reviewer | correctness, media safety, preview performance, security, maintainability |
| Verifier | evidence mapping and PASS/PARTIAL/FAIL status |
| Hardware QA | Windows 10 x64 booth PC / Mini PC form factor, Canon EOS 6D via EDSDK/Bridge, Canon SELPHY CP1000 via Windows Print System, local QR phone/network evidence and touchscreen kiosk evidence when available |

## Windows 10 x64 booth PC / Mini PC form factor platform ownership

| Area | Primary owner | Rule |
|---|---|---|
| Electron main/preload | Backend + Architect | Owns IPC, filesystem/SQLite, native boundary and platform lifecycle |
| Electron renderer guest UI | Frontend | Renders state and dispatches typed events only |
| Electron renderer admin UI | Frontend + Backend | Hidden operator surface; calls admin IPC only |
| System readiness / health gate | Backend + Architect | Computes READY/DEGRADED/BLOCKED from event and component health |
| Event configuration | Backend + BA + PM | Owns enabled formats, timeout, print/share policy and V1 retake disabled policy |
| Camera adapter | Backend + Hardware QA | Fake/device first, Canon EDSDK only with real hardware evidence |
| Canon Command Shadow Mode | Backend + Architect | Development diagnostics only; never Canon PASS evidence |
| Local Share/QR | Backend + Frontend + QA | Tokenized local endpoint plus result/fallback UI; phone scan PASS requires named phone and reachable network |
| Printer adapter | Backend + Hardware QA | Fake printer first, Windows Print/CP1000 only with real hardware evidence |
| Evidence gates | QA + Verifier | Hardware/network PASS requires named target device/environment evidence |

## Story ownership

| Story | Primary owner | Supporting roles | Expected output | QA focus | Reviewer focus | Verifier evidence |
|---|---|---|---|---|---|---|
| V3-001 Session controller/state machine | Backend | Architect, QA, Verifier | Pure SessionState plus separate SystemState/JobState contracts | transition tests, invalid states, separated states | domain not tied to React, explicit errors | unit evidence, architecture evidence |
| V3-002 Guest session data model | Backend | Architect, QA | Durable session types and persistence mapping | data shape, reset behavior, persisted boundaries | media references separated from templates, reset safety | type/test evidence |
| Milestone 1A Readiness/Event/Health gate | Backend + Architect | Frontend, QA, Verifier | EventConfig, HealthCheckResult, READY/DEGRADED/BLOCKED gate | no active event, blocked/degraded health, policy effects | system state not hidden in guest UI, operator clarity | readiness evidence |
| V3-003 Start / Showcase | Frontend | BA, Backend, QA, Reviewer | StartScreen, event branding, samples, readiness-aware Start | browser/manual screen check, blocked Start | design taste, no scope creep, guest-safe copy | manual evidence |
| V3-004 Select Shot Format | Frontend | Backend, BA, QA | SelectShotScreen and event-enabled format cards | valid/invalid selection, disabled format behavior | no layout/order/paper/printer/camera guest choice | component/browser evidence |
| V3-005 Camera service/adapter boundary | Backend | Architect, Hardware QA, Reviewer | CameraService, CameraAdapter capabilities, fake/device adapters, Canon boundary | camera status/capture failure/fallback visibility | no direct UI hardware call, no hardcoded IDs, fallback honesty | fake/device PARTIAL; Canon PASS only with hardware |
| V3-006 Capture loop | Backend + Frontend | QA, Reviewer | CaptureManager, countdown/progress UI, capture lock | 1/2/4/6 counts, duplicate guard, capture failure no false increment | original preservation, async safety, no provider switch mid-sequence | unit/integration/manual evidence |
| V3-007 Photo storage/photo pool | Backend | QA, Reviewer | photo storage, photo pool updates, atomic write policy | storage failures, partial captures, cleanup safety | original never overwritten, active session protected | storage evidence |
| Milestone 3S Canon Command Shadow Mode | Backend | Architect, QA, Verifier | CANON:SHADOW structured logs and Admin Dev Console trace | simulated labels, correlation IDs, no hardware calls | cannot be confused with real Canon success | shadow evidence only, no Canon PASS |
| Milestone 3H Canon physical integration spike | Backend + Hardware QA | Architect, Reviewer, Verifier | Canon EOS 6D bridge/live view/capture/download/persist evidence | USB/EDSDK, disconnect/reconnect, image persist | command/event correlation, media safety | real Canon PASS/PARTIAL/FAIL |
| V3-008 Template service | Backend | Architect, QA | template schema/filter/manifest validation service | compatibility filtering, invalid manifest rejection | template no guest photos, profile references valid | unit evidence |
| V3-009 Assignment engine | Backend | QA, Reviewer | shot-to-slot assignment | deterministic mapping | no reorder scope creep | unit evidence |
| V3-010 Conditional customization | Frontend | Backend, BA, QA, Reviewer | CustomizeScreen, text/draw data, separate model | text limits, drawing strokes, skip behavior, no retake UI | performance/accessibility, derivative-only customization | component/manual evidence |
| V3-011 Composition engine | Backend | Frontend, Architect, QA, Reviewer | master/share/print derivatives, atomic output persistence | output separation, failure fallback, render order | media safety, not UI screenshot for print master | unit/integration/manual evidence |
| V3-012 Local Share/QR delivery | Backend + Frontend | QA, Reviewer, Verifier | ShareService LOCAL_NETWORK_URL boundary, tokenized QR route, fallback UI | QR payload, local network retrieval, unavailable fallback, no local path exposure | privacy, no arbitrary file serving, no localhost-only QR | local QR evidence; phone scan PASS only with named phone + reachable network |
| V3-013 Guest-confirmed print queue | Backend | Frontend, Hardware QA, Reviewer, Verifier | PrintPolicy GUEST_CONFIRM, durable PrintJob, duplicate prevention, print status UI | duplicate print taps, printer unavailable, job idempotency | print cannot block QR or delete media; no false Printed success | fake PARTIAL; CP1000 PASS only with hardware |
| V3-014 Result, timeout and reset | Frontend + Backend | QA, Reviewer | ResultScreen, QR/fallback, print action/status, Done, timeout, reset | timeout/reset flow, completing persists jobs | camera not disconnected, durable jobs/media preserved | browser/manual evidence |
| Milestone 8A Admin operations/maintenance minimum | Frontend + Backend | Architect, QA, Hardware QA, Reviewer | readiness dashboard, diagnostics, maintenance lock, failed job visibility | blocked/degraded reasons, device lock behavior | operator clarity, diagnostics cannot corrupt active guest operations | admin/manual evidence |
| Milestone 8H Windows CP1000 physical printer spike | Backend + Hardware QA | Frontend, Reviewer, Verifier | CP1000 Windows Print System submission evidence | real printer status, offline/failure, duplicate prevention | no overclaim of physical completion | printer PASS/PARTIAL/FAIL evidence |
| V3-015 Evidence/release gates | Verifier | QA, Reviewer, PM | final evidence package | complete checklist | evidence honesty | PASS/PARTIAL/FAIL mapping |

## Frontend design requirement

All guest/operator screens must apply local Design Taste Frontend guidance before implementation. Required evidence summary:

- primary action
- fallback action
- hierarchy/readability from booth distance
- motion level
- preview/recovery safety
- accessibility notes
- guest-safe error copy and operator-visible next action for blocked/degraded states

## Handoff requirements

Each story handoff must include:

- story ID
- goal
- changed files
- acceptance criteria status
- tests run
- browser/manual evidence
- hardware tested
- hardware not tested
- network tested, when Local QR is claimed
- fallback behavior
- known risks
- QA verdict
- Reviewer verdict
- Verifier verdict
