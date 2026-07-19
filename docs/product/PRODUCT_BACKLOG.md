# PhotoBoothAI Product Backlog

Status: PM approved for delivery on 2026-07-19.

## Product goal

Build PhotoBoothAI as the first complete application on MomentAI CameraOS: a local-first AI-assisted photobooth that guides event attendees through capture, preview, sharing and printing while preserving captured media and keeping hardware recovery explicit.

## Product principles

- Local core flow must work without cloud availability.
- Original captured media is preserved before processing, printing or sharing.
- Camera preview has priority over gesture inference and image processing.
- Touch input is the primary fallback when AI gesture recognition is unavailable.
- Printer failures never invalidate or delete captured media.
- Real hardware claims require real-device evidence.

## Actors

| Actor | Primary needs |
|---|---|
| Event attendee | Clear start guidance, countdown, fast preview, retake, QR/download, optional print |
| Booth operator | Camera/printer/storage status, recoverable error instructions, retry controls |
| Event organizer | Branding, templates, gallery/export, reliable event operation |
| System administrator | Setup, diagnostics, logs, hardware validation, configuration |

## Epics

| Epic | Priority | Points | Business value | Dependencies |
|---|---:|---:|---|---|
| E1 Core stabilization | Critical | 21 | Makes the POC buildable, testable and deployable | None |
| E2 Session and storage | Critical | 34 | Prevents silent media loss and enables recovery | E1 |
| E3 Complete booth state machine | Critical | 21 | Makes user flow predictable and testable | E1, E2 |
| E4 QR sharing | Critical | 13 | Provides immediate digital output | E2, E3 |
| E5 Error recovery | Critical | 21 | Keeps booth usable during camera/AI/storage failures | E3 |
| E6 Multi-shot and layouts | High | 34 | Enables classic strips and collages | E2, E3 |
| E7 Printing integration | High | 34 | Enables physical keepsakes and operator value | E2, E3 |
| E8 Gallery and review | High | 21 | Enables browsing, re-sharing and reprinting | E2, E4, E7 |
| E9 Admin configuration | High | 21 | Enables event setup and diagnostics without code changes | E5, E8 |
| E10 Enhancement features | Medium | 34 | Adds frames, filters and event branding | E6, E9 |
| E11 Advanced experiences | Low | TBD | Adds green screen, GIF/boomerang, SMS/social, payment | Post-MVP |

## Critical backlog

### PB-001: Stabilize lint configuration

As a developer, I want generated MediaPipe files excluded from lint so that lint reports actionable app issues only.

- Priority: Critical
- Points: 2
- Acceptance criteria:
  - ESLint ignores `public/mediapipe/**` or equivalent generated assets.
  - `pnpm lint` no longer fails on generated model/WASM assets.
  - Application source lint findings remain visible.
- Tests: `pnpm lint`

### PB-002: Resolve React hook lint errors

As a developer, I want hook effects to follow React rules so that camera and booth state remain predictable.

- Priority: Critical
- Points: 3
- Acceptance criteria:
  - No `react-hooks/set-state-in-effect` violations remain in booth/camera/gesture hooks.
  - Existing capture/countdown behavior is preserved.
  - Timers, animation frames and recognizers are cleaned up.
- Tests: hook unit tests and manual smoke test.

### PB-003: Restore production build

As a developer, I want the app to build successfully so that release gates can run.

- Priority: Critical
- Points: 2
- Acceptance criteria:
  - `pnpm build` completes successfully.
  - TypeScript compilation succeeds.
  - No production-only runtime errors are introduced.
- Tests: `pnpm build`

### PB-004: Establish test baseline

As a developer, I want unit and integration tests to run reliably so that future booth work is protected.

- Priority: Critical
- Points: 5
- Acceptance criteria:
  - `pnpm test` runs successfully.
  - At least one state transition test exists.
  - At least one storage/service test exists once storage is introduced.
  - Test setup documents how browser APIs are mocked.
- Tests: `pnpm test`

### PB-005: Replace starter landing page

As an event attendee, I want a clear PhotoBoothAI entry point so that I understand how to start.

- Priority: High
- Points: 3
- Acceptance criteria:
  - `app/page.tsx` no longer shows Next.js starter content.
  - Home page explains PhotoBoothAI and links to `/booth`.
  - Metadata describes PhotoBoothAI CameraOS.
- Tests: manual browser check.

### PB-006: Add explicit capture error UI

As an event attendee, I want a clear recovery path when capture fails so that I can retry.

- Priority: High
- Points: 3
- Acceptance criteria:
  - Capture errors display an understandable message.
  - Retry action is available when recovery is possible.
  - Failure context is logged without exposing sensitive paths or media.
- Tests: simulated capture failure.

### PB-007: Add AI gesture fallback UI

As an event attendee, I want touch capture available when AI fails so that I can still use the booth.

- Priority: High
- Points: 3
- Acceptance criteria:
  - UI displays AI status: active, disabled or failed.
  - Touch/manual capture remains available when gesture recognition fails.
  - MediaPipe failure does not stop live preview.
- Tests: run with missing/broken MediaPipe asset and verify fallback.

### PB-008: Define session and photo domain types

As a developer, I want stable session and photo contracts so that services and UI share one model.

- Priority: Critical
- Points: 2
- Acceptance criteria:
  - `BoothSession`, `BoothPhoto`, `PhotoMetadata` and `SessionStatus` are typed.
  - Types separate original media from processed derivatives.
  - Types do not depend on React components.
- Tests: TypeScript compilation.

### PB-009: Implement session storage service

As a booth operator, I want sessions persisted locally so that sessions survive reloads and recovery flows.

- Priority: Critical
- Points: 5
- Acceptance criteria:
  - Create/read/update/delete session operations exist.
  - Active session can be restored after reload.
  - Storage failures return typed errors.
  - Unit tests cover happy path and failure path.
- Tests: unit tests with mocked storage.

### PB-010: Implement photo storage service

As an event attendee, I want captured photos saved immediately so that media is not lost.

- Priority: Critical
- Points: 5
- Acceptance criteria:
  - Original photo blob is saved before processing or output actions.
  - Photo retrieval by session and photo ID works.
  - Object URLs are created and revoked safely.
  - Storage quota errors are explicit.
- Tests: unit and integration tests.

### PB-011: Create unique booth sessions

As a booth operator, I want every customer flow to have a unique session ID so that photos are organized.

- Priority: Critical
- Points: 3
- Acceptance criteria:
  - Session ID is created when a flow starts.
  - Session metadata includes mode, timestamps and status.
  - Captures are linked to the active session.
- Tests: session creation test.

### PB-012: Preserve original capture before preview

As an event attendee, I want my original capture preserved before any effect is applied so that processing failures do not lose the photo.

- Priority: Critical
- Points: 5
- Acceptance criteria:
  - Capture success writes original media to storage before preview.
  - Processing/QR/printing failures do not delete original media.
  - UI blocks completion only when original cannot be preserved.
- Tests: capture-storage integration test.

### PB-013: Restore active session after reload

As an event attendee, I want to recover from accidental browser reload so that recently captured photos remain available.

- Priority: High
- Points: 5
- Acceptance criteria:
  - Active session is detected on app load.
  - User can continue or start a new session.
  - Abandoned sessions are archived based on retention rules.
- Tests: manual reload recovery and service test.

### PB-014: Test session and photo storage

As a developer, I want automated storage tests so that the media-preservation invariant is protected.

- Priority: High
- Points: 3
- Acceptance criteria:
  - CRUD tests cover sessions.
  - Save/retrieve/delete tests cover photos.
  - Quota/corrupt data failures are represented.
- Tests: `pnpm test`

### PB-015: Monitor storage quota

As a booth operator, I want storage usage warnings so that I can prevent session-blocking failures.

- Priority: Medium
- Points: 3
- Acceptance criteria:
  - Quota estimate is captured when available.
  - Warning threshold and blocking threshold are configurable.
  - Operator-facing message recommends cleanup/export.
- Tests: mocked quota scenario.

### PB-016: Export session archive

As an event organizer, I want a session export so that event photos and metadata can be backed up.

- Priority: Medium
- Points: 3
- Acceptance criteria:
  - Export includes photos and metadata JSON.
  - Export filename includes session ID and timestamp.
  - Export does not include secrets or local absolute paths.
- Tests: manual ZIP/archive verification.

### PB-017: Extract booth state machine

As a developer, I want booth state logic outside React so that transitions can be tested directly.

- Priority: Critical
- Points: 5
- Acceptance criteria:
  - Pure state machine module defines states, events, guards and transitions.
  - React hook becomes a coordinator around the machine.
  - Invalid transitions are rejected or ignored explicitly.
- Tests: state transition unit tests.

### PB-018: Implement complete MVP state set

As an event attendee, I want the booth to move through clear phases so that the flow is understandable.

- Priority: Critical
- Points: 5
- Acceptance criteria:
  - States cover attract, camera initialization, ready, selection, countdown, capturing, processing, preview, actions, printing/share, complete and error states.
  - Every transition defines guard, side effect and failure behavior.
  - Docs state diagram is updated.
- Tests: state transition and integration tests.

### PB-019: Make countdown cancellable

As an event attendee, I want to cancel countdown if I am not ready so that I can reset safely.

- Priority: High
- Points: 3
- Acceptance criteria:
  - Countdown cancellation returns to ready/preview state.
  - Capture is not triggered after cancellation.
  - Timers are cleaned up.
- Tests: countdown cancel unit and UI test.

### PB-020: Add typed recoverable and fatal errors

As a booth operator, I want errors categorized so that recovery actions are obvious.

- Priority: High
- Points: 3
- Acceptance criteria:
  - Recoverable errors include retry action.
  - Fatal errors require operator reset/support.
  - Error context includes state, event and timestamp.
- Tests: error transition tests.

### PB-021: Test complete booth flows

As a developer, I want integration tests for major booth flows so that regressions are caught early.

- Priority: High
- Points: 5
- Acceptance criteria:
  - Happy path test: attract/start to completed.
  - Cancel countdown path is covered.
  - Recoverable error retry is covered.
  - Fatal error path is covered.
- Tests: `pnpm test`

### PB-022: Generate QR code for saved photo

As an event attendee, I want a QR code after capture so that I can download my photo.

- Priority: Critical
- Points: 5
- Acceptance criteria:
  - QR code is generated from a share URL or local share route.
  - QR code appears within 1 second after saved photo is ready.
  - QR size and contrast are scannable on phones.
- Tests: QR generation unit test and manual scan.

### PB-023: Implement share route

As an event attendee, I want scanning the QR code to open my photo so that I can download it.

- Priority: Critical
- Points: 5
- Acceptance criteria:
  - `/share/[photoId]` or equivalent route loads the photo.
  - Mobile layout supports preview and download.
  - Missing/expired photo shows a clear message.
- Tests: mobile browser manual test.

### PB-024: Support branded QR output

As an event organizer, I want optional QR branding so that the sharing screen matches the event.

- Priority: Medium
- Points: 3
- Acceptance criteria:
  - Logo is optional and configurable.
  - QR remains scannable with logo disabled/enabled.
  - Fallback to unbranded QR if logo cannot load.
- Tests: manual scan with logo.

### PB-025: Recover from camera disconnect

As a booth operator, I want camera disconnects detected and recoverable so that a loose cable does not kill the event.

- Priority: Critical
- Points: 5
- Acceptance criteria:
  - Track-ended events transition to recoverable camera error.
  - Captured media in the session remains preserved.
  - Reconnect action uses bounded retry.
  - UI explains operator action.
- Tests: real or simulated camera disconnect.

### PB-026: Handle camera permission denial

As a booth operator, I want permission failures explained so that setup can be fixed quickly.

- Priority: Critical
- Points: 3
- Acceptance criteria:
  - Permission denied maps to recoverable error.
  - Browser instruction is displayed.
  - Retry after permission grant works.
- Tests: deny camera permission manually.

### PB-027: Keep touch capture when MediaPipe fails

As an event attendee, I want the booth to remain usable without AI so that gesture failure does not block capture.

- Priority: Critical
- Points: 3
- Acceptance criteria:
  - MediaPipe model failure disables only gesture recognition.
  - Preview and touch capture remain active.
  - Operator status shows AI unavailable.
- Tests: broken MediaPipe asset manual test.

### PB-028: Handle storage failure explicitly

As a booth operator, I want storage failures surfaced before photos are lost so that I can clean up or export.

- Priority: High
- Points: 3
- Acceptance criteria:
  - Quota exceeded and write failure use typed errors.
  - UI explains cleanup/export action.
  - Photo remains in memory until user/operator acknowledges failure when possible.
- Tests: mocked quota failure.

### PB-029: Test error recovery flows

As a developer, I want error recovery tests so that real-event failures are expected paths.

- Priority: High
- Points: 5
- Acceptance criteria:
  - Tests cover camera disconnect, permission denial, MediaPipe failure and storage failure.
  - Mock evidence is not labeled as hardware PASS.
- Tests: automated with mocks plus manual checklist.

### PB-030: Add structured error logging

As a system administrator, I want structured logs so that event issues can be diagnosed.

- Priority: Medium
- Points: 2
- Acceptance criteria:
  - Logs include timestamp, session ID, state, event and error type.
  - Logs exclude photo data, secrets and sensitive local paths.
  - Recent logs can be exported later from admin.
- Tests: log format unit test.

## High-priority backlog

### PB-031: Add mode selection

As an event attendee, I want to choose single photo or photo strip so that the output matches my preference.

- Priority: High
- Points: 5
- Acceptance criteria:
  - Modes include single, strip-2, strip-3, strip-4 and 2x2 collage.
  - Template previews are visible.
  - Timeout returns to attract/idle or default mode.
- Tests: UI test for each mode.

### PB-032: Implement multi-shot countdown flow

As an event attendee, I want a countdown between photos so that each pose is intentional.

- Priority: High
- Points: 5
- Acceptance criteria:
  - Each shot has independent countdown.
  - UI displays photo progress such as “2 of 4”.
  - Partial captures are preserved if failure occurs.
- Tests: integration test for 4-photo strip.

### PB-033: Implement layout compositor

As an event attendee, I want captured photos composed into strips/collages so that the output is print-ready.

- Priority: High
- Points: 8
- Acceptance criteria:
  - Compositor supports 1x2, 1x3, 1x4 and 2x2 layouts.
  - Output dimensions are configurable for 4x6 print.
  - Composition preserves original captures separately.
  - Composition failure falls back to original gallery.
- Tests: output dimension and fixture comparison tests.

### PB-034: Preview composed layout

As an event attendee, I want to preview the final strip/collage so that I can retake or accept it.

- Priority: High
- Points: 5
- Acceptance criteria:
  - Preview shows composed layout, not just individual photos.
  - Retake all is available for MVP.
  - Future retake-individual hook is not blocked architecturally.
- Tests: manual preview for each layout.

### PB-035: Add custom layout templates

As an event organizer, I want layout templates so that event branding can be applied consistently.

- Priority: Medium
- Points: 8
- Acceptance criteria:
  - Templates are config-driven.
  - Template validation rejects impossible layouts.
  - Missing assets fall back to default template.
- Tests: template validation tests.

### PB-036: Define printer adapter interface

As a developer, I want printing behind an adapter so that printer implementations can vary by OS/hardware.

- Priority: High
- Points: 5
- Acceptance criteria:
  - Printer adapter exposes list, status, submit, job status and cancel operations.
  - No production printer name is hardcoded.
  - Mock adapter exists for tests.
- Tests: adapter contract tests.

### PB-037: Implement print queue service

As a booth operator, I want print jobs queued reliably so that multiple users can print without conflicts.

- Priority: High
- Points: 8
- Acceptance criteria:
  - Print jobs have stable IDs and attempt counts.
  - Duplicate print submissions are guarded.
  - Failed jobs are preserved for retry.
  - Queue survives application restart where supported.
- Tests: queue unit and retry tests.

### PB-038: Implement first printer adapter

As a booth operator, I want one real printer path supported so that physical output can be tested.

- Priority: High
- Points: 13
- Acceptance criteria:
  - CUPS or Windows spooler adapter is implemented based on PM hardware decision.
  - Printer offline maps to recoverable error.
  - Real hardware evidence is recorded before claiming PASS.
- Tests: mock tests plus real printer checklist.

### PB-039: Add print status UI

As an event attendee, I want to see print progress so that I know whether to wait.

- Priority: High
- Points: 5
- Acceptance criteria:
  - UI shows queued, printing, complete and failed states.
  - Print failure keeps QR/download available.
  - Operator retry action exists.
- Tests: simulated queue states.

### PB-040: Build session gallery

As an event attendee, I want to browse session photos so that I can choose what to share or print.

- Priority: High
- Points: 8
- Acceptance criteria:
  - Gallery shows session thumbnails.
  - Full preview opens from thumbnail.
  - Download/share/print actions reuse existing services.
- Tests: storage-backed gallery test.

### PB-041: Build operator admin dashboard

As a booth operator, I want system status and recovery actions so that event downtime is reduced.

- Priority: High
- Points: 13
- Acceptance criteria:
  - Dashboard shows camera, AI, storage, printer and recent errors.
  - Operator can retry camera/printer and export logs.
  - Admin access is protected by configurable PIN or hidden operator route.
- Tests: manual dashboard scenarios.

### PB-042: Add event branding configuration

As an event organizer, I want logo/text/theme configuration so that photos match the event.

- Priority: Medium
- Points: 8
- Acceptance criteria:
  - Event logo, title and theme color are configurable.
  - Missing assets fall back safely.
  - Branding affects attract screen and output templates.
- Tests: config validation and manual preview.

## Future backlog

- PB-050: Email delivery with offline queue.
- PB-051: Green screen/background replacement.
- PB-052: Animated GIF and boomerang capture mode.
- PB-053: Stickers, drawing and virtual props.
- PB-054: SMS sharing through configurable provider.
- PB-055: Social sharing with privacy-preserving consent.
- PB-056: Payment or print-credit gateway.
- PB-057: Multi-language kiosk UI.
- PB-058: Remote event analytics dashboard.

## Sprint backlog

### Sprint 1: MVP core flow and media preservation

- Duration: 2 weeks
- Goal: Buildable app with single-photo capture, persistent local session/photo storage and QR sharing.
- Stories: PB-001 through PB-014, PB-022 and PB-023.
- Deliverables:
  - `pnpm lint`, `pnpm build`, `pnpm test` pass or documented blockers.
  - Original photo is persisted before preview/output actions.
  - QR sharing route works for stored photo.
  - Basic capture and AI fallback UI are explicit.
- Risks:
  - IndexedDB mocking complexity.
  - Share URL is local-only without backend.
- Acceptance:
  - 20 mock/manual sessions without media loss.
  - Hardware status: PARTIAL unless real target kiosk is tested.

### Sprint 2: State machine and recovery

- Duration: 2 weeks
- Goal: Move booth logic to explicit state machine with recoverable camera/AI/storage errors.
- Stories: PB-017 through PB-030.
- Deliverables:
  - Pure state machine with transition tests.
  - Camera disconnect and permission denial recovery.
  - MediaPipe failure does not block touch capture.
  - Structured errors and logs.
- Risks:
  - Refactor can regress current preview/capture behavior.
- Acceptance:
  - Happy path, cancel, recoverable error and fatal error paths covered by tests.

### Sprint 3: Multi-shot and printing beta

- Duration: 2 weeks
- Goal: Add photo strip/collage modes and first printer path.
- Stories: PB-031 through PB-039.
- Deliverables:
  - Mode selection and 2/3/4-photo capture flow.
  - Layout compositor with 4x6-ready output.
  - Print queue and first printer adapter.
- Risks:
  - Printer hardware/driver availability.
  - Layout performance with high-resolution images.
- Acceptance:
  - Mock print PASS, real printer PASS or clearly documented PARTIAL.

### Sprint 4: Gallery, admin and production polish

- Duration: 2 weeks
- Goal: Add gallery, operator dashboard, branding and production readiness.
- Stories: PB-040 through PB-042 plus selected polish/bug stories.
- Deliverables:
  - Gallery browse/re-share/reprint.
  - Operator status dashboard.
  - Event branding configuration.
  - Operator setup and recovery docs.
- Risks:
  - Scope creep into advanced enhancements.
- Acceptance:
  - Controlled event test with 50+ sessions or documented PARTIAL.

## Definition of Done

A story is done only when:

- It satisfies acceptance criteria.
- It preserves the media-safety invariants.
- Focused tests are added or justified as not applicable.
- Lint/build/test evidence is recorded.
- Hardware-dependent behavior is marked PASS, PARTIAL or FAIL with evidence.
- Docs are updated when architecture, state machine, hardware support or release process changes.

## Release gates

### Alpha

- Single-photo flow works from start to QR output.
- Session/photo storage preserves original captures.
- Basic errors are explicit.
- Hardware evidence may be PARTIAL.

### Beta

- Multi-shot and first printer path work.
- Error recovery is demonstrable.
- At least one target camera and one target printer are tested or documented PARTIAL.

### Production

- Critical and high backlog complete or intentionally deferred by PM.
- Real event/venue validation completed.
- Hardware evidence PASS for claimed camera and printer support.
- Operator manual and recovery procedures exist.
