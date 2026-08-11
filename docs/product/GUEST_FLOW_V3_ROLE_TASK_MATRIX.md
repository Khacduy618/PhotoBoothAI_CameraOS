# MomentAI Guest Flow V3 — Role Task Matrix

Status: Active role ownership matrix for Guest Flow V3.

## Role rules

| Role | Owns |
|---|---|
| PM | scope, priority, deletion approval, final acceptance |
| BA | guest flow clarity, copy, business rules, acceptance criteria |
| Architect | boundaries, state machine, service/adapters, hardware lifecycle |
| Backend | SessionController, services, storage, capture, composition, QR, print queue |
| Frontend | guest screens, kiosk UI, preview, customization, result UI |
| QA | risk-based software/browser/hardware tests |
| Reviewer | correctness, media safety, preview performance, security, maintainability |
| Verifier | evidence mapping and PASS/PARTIAL/FAIL status |
| Hardware QA | Canon EOS 6D, macOS, printer and kiosk evidence when available |

## Story ownership

| Story | Primary owner | Supporting roles | Expected output | QA focus | Reviewer focus | Verifier evidence |
|---|---|---|---|---|---|---|
| V3-001 Session controller/state machine | Backend | Architect, QA, Verifier | Pure state machine and SessionController boundary | transition tests, invalid states | domain not tied to React, explicit errors | unit evidence, architecture evidence |
| V3-002 Guest session data model | Backend | Architect, QA | Session types and persistence mapping | data shape, reset behavior | media references separated from templates | type/test evidence |
| V3-003 Start / Showcase | Frontend | BA, QA, Reviewer | StartScreen, event branding, samples | browser/manual screen check | design taste, no scope creep | manual evidence |
| V3-004 Select Shot Format | Frontend | Backend, BA, QA | SelectShotScreen and format cards | valid/invalid selection | no layout/order/paper/printer guest choice | component/browser evidence |
| V3-005 Canon camera service/adapter | Backend | Architect, Hardware QA, Reviewer | CameraService and CanonAdapter boundary | camera status/capture failure | no direct UI hardware call, no hardcoded IDs | hardware PASS/PARTIAL evidence |
| V3-006 Capture loop | Backend + Frontend | QA, Reviewer | CaptureManager, countdown/progress UI | 1/2/4/6 counts, duplicate guard | original preservation, async safety | unit/integration/manual evidence |
| V3-007 Photo storage/photo pool | Backend | QA, Reviewer | photo storage and photo pool updates | storage failures, partial captures | original never overwritten | storage evidence |
| V3-008 Template service | Backend | Architect, QA | template schema/filter service | compatibility filtering | template no guest photos | unit evidence |
| V3-009 Assignment engine | Backend | QA, Reviewer | shot-to-slot assignment | deterministic mapping | no reorder scope creep | unit evidence |
| V3-010 Conditional customization | Frontend | Backend, BA, QA, Reviewer | CustomizeScreen, text/draw data | text limits, drawing strokes, skip behavior | performance/accessibility, derivative-only customization | component/manual evidence |
| V3-011 Composition engine | Backend | Frontend, Architect, QA, Reviewer | master/share/print derivatives | output separation, failure fallback | media safety, render order | unit/integration/manual evidence |
| V3-012 Cloud QR delivery | Backend + Frontend | QA, Reviewer, Verifier | cloud delivery boundary and QR UI | QR payload/failure | privacy, no local path exposure | QR/cloud evidence |
| V3-013 Background auto print | Backend | Frontend, Hardware QA, Reviewer, Verifier | PrintService, queue, status UI | duplicate jobs, printer failure | print cannot block QR or delete media | printer PASS/PARTIAL evidence |
| V3-014 Result, timeout and reset | Frontend + Backend | QA, Reviewer | ResultScreen, Done, timeout, reset | timeout/reset flow | camera not disconnected | browser/manual evidence |
| V3-015 Evidence/release gates | Verifier | QA, Reviewer, PM | final evidence package | complete checklist | evidence honesty | PASS/PARTIAL/FAIL mapping |

## Frontend design requirement

All guest/operator screens must apply local Design Taste Frontend guidance before implementation. Required evidence summary:

- primary action
- fallback action
- hierarchy/readability from booth distance
- motion level
- preview/recovery safety
- accessibility notes

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
- fallback behavior
- known risks
- QA verdict
- Reviewer verdict
- Verifier verdict
