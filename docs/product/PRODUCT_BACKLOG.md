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

## Current Phase 1 delivery track

The legacy Sprint 1 backlog remains preserved for traceability. Current execution follows `docs/product/PHASE_1_DELIVERY_PLAN.md`.

PR1-PR6 are the merged Phase 1 baseline. PR7+ work must map to the Phase 1 backlog below, preserve media-safety invariants and pass the evidence gates in `docs/testing/ACCEPTANCE_EVIDENCE_MATRIX.md`.

### Phase 1 status summary

- Code baseline through PR6: merged.
- Next primary code task: PB-109 Realtime layout preview, PB-111 Realtime theme preview, PB-112 Realtime frame preview, PB-113 Realtime style preview, PB-114/PB-115 sticker/text setup preview, usually grouped as PR7.
- Evidence tasks still required: PB-129 Phase 1 manual browser smoke, PB-130 offline/no-cloud verification, PB-131 hardware evidence labeling and PB-132 final Phase 1 release report.
- Theme/frame/sticker asset libraries are investigation-only until PM and Architect approve implementation.

### Phase 1 backlog mapping

#### E1 — Project baseline and delivery gates

##### PB-101: Stabilize lint configuration

As a developer, I want lint to report only actionable app issues so delivery gates are reliable.

- Priority: Critical
- Phase: Phase 1
- Status: Done if already merged
- Acceptance criteria:
  - ESLint ignores generated MediaPipe/public assets where appropriate.
  - Application source remains linted.
  - `pnpm lint` passes.
  - No unrelated lint suppression hides real app issues.
- Tests/evidence: `pnpm lint`

##### PB-102: Resolve React hook lifecycle issues

As a developer, I want hooks to follow React rules so camera, gesture and booth state remain predictable.

- Priority: Critical
- Phase: Phase 1
- Status: Done if already merged
- Acceptance criteria:
  - No hook lint violations remain.
  - Timers, animation frames, recognizers and media tracks are cleaned up.
  - Duplicate async operations are guarded.
  - Existing capture/countdown behavior is preserved.
- Tests/evidence: `pnpm lint`, hook tests where feasible, manual smoke when camera behavior is touched

##### PB-103: Restore production build

As a developer, I want the app to build successfully so release gates can run.

- Priority: Critical
- Phase: Phase 1
- Status: Done if already merged
- Acceptance criteria:
  - `pnpm build` completes.
  - TypeScript build passes.
  - No production-only runtime errors are introduced.
- Tests/evidence: `pnpm build`

##### PB-104: Establish test and type baseline

As a developer, I want tests and type checks to run reliably so future changes are protected.

- Priority: Critical
- Phase: Phase 1
- Status: Active gate for every PR
- Acceptance criteria:
  - `pnpm test` passes.
  - `pnpm tsc --noEmit` passes when type/test surfaces are touched.
  - State/service/component tests exist for touched areas.
  - Browser API mocks are explicit and safe.
- Tests/evidence: `pnpm test`, `pnpm tsc --noEmit`

#### E2 — Entry, setup and readiness UX

##### PB-105: Replace starter landing page

As an attendee/operator, I want a clear PhotoBoothAI entry point so I know how to start.

- Priority: High
- Phase: Phase 1
- Status: Done if already merged
- Acceptance criteria:
  - Home page no longer shows Next.js starter content.
  - Home page explains PhotoBoothAI.
  - Home page links to `/booth`.
  - Metadata describes PhotoBoothAI CameraOS.
- Tests/evidence: browser/manual check, optional route/component test

##### PB-106: Add explicit capture error UI

As an attendee/operator, I want clear recovery when capture fails so I can retry safely.

- Priority: High
- Phase: Phase 1
- Status: Done if already merged
- Acceptance criteria:
  - Capture errors show understandable message.
  - Retry action exists when recoverable.
  - Back/setup/reset action exists when retry is unsafe.
  - Error context is logged without photos, blobs, secrets or sensitive local paths.
  - Critical capture failure is not toast-only.
- Tests/evidence: simulated capture failure, component/integration test where feasible

##### PB-107: Add AI gesture fallback UI

As an attendee, I want touch/manual capture available when AI fails so the booth remains usable.

- Priority: Critical
- Phase: Phase 1
- Status: Done; continue hardening when touched
- Acceptance criteria:
  - UI displays AI status: active, loading, disabled or failed.
  - Touch/manual capture remains available when AI fails.
  - MediaPipe failure does not stop live preview.
  - No sustained gesture can trigger unlimited captures.
  - Gesture confidence/cooldown behavior is visible or documented.
- Tests/evidence: mocked MediaPipe failure, manual broken/missing model check, preview remains usable, hardware status PARTIAL unless real target tested

##### PB-108: Setup/readiness screen

As a booth operator, I want a setup/readiness screen so I can confirm the booth is ready before attendees start.

- Priority: Critical
- Phase: Phase 1
- Suggested PR: PR7
- Acceptance criteria:
  - Setup page shows camera readiness: permission needed, initializing, ready or failed.
  - Setup page shows AI/gesture status if enabled.
  - Manual/touch fallback is visible.
  - Capture/start is blocked or clearly unavailable when camera preview is unavailable.
  - Recovery action exists for camera retry.
  - UI copy is readable from booth distance.
  - No print/cloud actions appear.
- Tests/evidence: component test for readiness states, browser/manual check, simulated camera unavailable/permission denied

#### E3 — Realtime setup preview UX

##### PB-109: Realtime layout preview

As an operator/attendee, I want layout selection to update preview immediately so I understand the output before capture.

- Priority: Critical
- Phase: Phase 1
- Suggested PR: PR7
- Acceptance criteria:
  - Selecting `2x2` updates preview to a 2x2 grid.
  - Selecting `1x4-vertical` updates preview to a vertical strip grid.
  - Selecting `2x3` updates preview to a 2x3 grid.
  - Preview shows shot count.
  - Preview update does not require Apply/Refresh.
  - Invalid layout falls back to default.
  - Preview remains usable without camera via placeholder/static preview.
- Tests/evidence: component test for layout selection, component test for preview output, manual browser check

##### PB-110: Realtime countdown preview

As an attendee, I want countdown choice to be visible before capture so I know how much time I have.

- Priority: Medium
- Phase: Phase 1
- Suggested PR: PR7
- Acceptance criteria:
  - Countdown options show approved values only: `3`, `6`, `8`, `10`.
  - Selected countdown is visually highlighted.
  - Preview summary updates immediately.
  - Capture flow receives selected countdown.
  - Invalid countdown normalizes to default.
- Tests/evidence: selection test, capture hook/machine test if countdown is touched

##### PB-111: Realtime theme preview

As an organizer/operator, I want theme selection to update preview colors immediately so the booth feels event-ready.

- Priority: High
- Phase: Phase 1
- Suggested PR: PR7
- Acceptance criteria:
  - Selecting theme updates preview background/accent/text treatment.
  - Selected theme is visually highlighted.
  - Theme preview does not require camera stream.
  - Unknown theme falls back to default.
  - Theme config remains local/static.
- Tests/evidence: component test for theme application, visual/manual browser check

##### PB-112: Realtime frame preview

As an organizer/operator, I want frame selection to update preview immediately so I know how output will be framed.

- Priority: High
- Phase: Phase 1
- Suggested PR: PR7
- Acceptance criteria:
  - Selecting frame updates preview border/frame treatment.
  - Frame name/label appears when relevant.
  - Missing/unknown frame falls back safely.
  - Frame preview is lightweight CSS/SVG/DOM, not a heavy live canvas loop.
  - No external frame dependency is introduced without PM/Architect approval.
- Tests/evidence: component test for frame selection, manual browser check

##### PB-113: Realtime style/filter preview

As an attendee/operator, I want style/filter selection to update preview immediately so I can see the intended look.

- Priority: High
- Phase: Phase 1
- Suggested PR: PR7
- Acceptance criteria:
  - Style selection updates preview with fast CSS approximation.
  - Supported initial styles include `none`, `grayscale` and `warm`.
  - Style preview does not claim pixel-perfect final output.
  - Final renderer remains authoritative.
  - Style preview does not block live camera preview.
- Tests/evidence: component test for style indicator/filter, manual browser check

##### PB-114: Realtime sticker preset preview

As an attendee, I want preset sticker choices to appear on setup preview so I can choose a playful output style.

- Priority: High
- Phase: Phase 1
- Suggested PR: PR7 or PR8 if split
- Acceptance criteria:
  - Sticker preset list appears in setup.
  - Selecting sticker shows it on preview immediately.
  - Selecting another sticker replaces setup-generated sticker, not append unlimited stickers.
  - `No sticker` option clears setup sticker.
  - Sticker selection persists into capture/final output config.
  - Stickers are local/offline.
  - Emoji rendering variability is documented if emoji-based.
- Tests/evidence: pure helper test for stable setup sticker replacement, component test for preview sticker, manual browser check

##### PB-115: Realtime text preset/custom label preview

As an attendee/operator, I want text preset/custom label preview so event text can be seen before capture.

- Priority: High
- Phase: Phase 1
- Suggested PR: PR7 or PR8 if split
- Acceptance criteria:
  - Text preset list appears in setup.
  - Selecting text preset shows text on preview immediately.
  - Custom text input supports max length.
  - Blank text does not create label.
  - Repeated text changes replace setup-generated text label.
  - Text label persists into capture/final output config.
  - Text contrast remains readable.
- Tests/evidence: helper tests for trim/max/blank/replacement, component test for preview label, manual browser check

#### E4 — Capture state, multi-shot and media safety

##### PB-116: Define session/photo domain types

As a developer, I want stable domain contracts so services and UI share one model.

- Priority: Critical
- Phase: Phase 1
- Status: Done if already merged
- Acceptance criteria:
  - `BoothSession`, `BoothPhoto`, `PhotoMetadata` and `SessionStatus` are typed.
  - Types separate original media from derivatives.
  - Types do not depend on React components.
  - Selection/config is attached to session/capture where needed.
- Tests/evidence: TypeScript compile, `pnpm build`

##### PB-117: Implement local session storage service

As an operator, I want sessions persisted locally so recovery is possible.

- Priority: Critical
- Phase: Phase 1
- Status: Done or verify current implementation
- Acceptance criteria:
  - Create/read/update/delete session operations exist.
  - Active session restore is possible where supported.
  - Storage errors return typed failures.
  - No sensitive local paths exposed.
  - Session stores selected setup config.
- Tests/evidence: session storage unit tests, failure path tests

##### PB-118: Implement photo storage service

As an attendee, I want captured photos saved immediately so media is not lost.

- Priority: Critical
- Phase: Phase 1
- Status: Done or verify current implementation
- Acceptance criteria:
  - Original photo blob is saved before preview/output actions.
  - Retrieval by session/photo ID works.
  - Derivatives are stored separately from originals.
  - Object URLs are created/revoked safely.
  - Quota/write errors are explicit.
- Tests/evidence: photo storage tests, quota/failure mock tests

##### PB-119: Create unique booth sessions

As an operator, I want every customer flow to have unique session ID so captures are organized.

- Priority: Critical
- Phase: Phase 1
- Status: Done or verify current implementation
- Acceptance criteria:
  - Session ID is created when flow starts.
  - Session metadata includes mode/layout/setup choices.
  - Captures link to active session.
  - Retake/reset behavior is explicit.
- Tests/evidence: session creation tests, integration tests

##### PB-120: Preserve original capture before preview/output

As an attendee, I want original capture preserved before effects so processing failure cannot lose my photo.

- Priority: Critical
- Phase: Phase 1
- Status: Done; invariant for all future PRs
- Acceptance criteria:
  - Capture success writes original before preview/result.
  - Processing/customization/share/print failure never deletes original.
  - UI blocks successful completion if original cannot be preserved.
  - Retake does not delete preserved original unless cleanup policy applies.
- Tests/evidence: capture-storage integration test, failure path test, manual/browser capture evidence

##### PB-121: Implement multi-shot countdown flow

As an attendee, I want a countdown before each photo so each pose is intentional.

- Priority: High
- Phase: Phase 1 current chain
- Status: Done if PR3 merged; verify evidence
- Acceptance criteria:
  - Each shot has independent countdown.
  - UI shows progress such as `1/4`, `2/4`.
  - Partial captures are preserved if failure occurs.
  - Capture is single-flight.
  - Sustained gesture does not trigger unlimited captures.
  - Retake-all is available.
- Tests/evidence: state/hook tests, browser/manual flow, media preservation evidence

##### PB-122: Implement layout compositor

As an attendee, I want captured photos composed into a strip/collage so the output feels complete.

- Priority: High
- Phase: Phase 1 current chain
- Status: Done if PR4 merged; verify evidence
- Acceptance criteria:
  - Supports approved layouts: `2x2`, `1x4-vertical`, `2x3`.
  - Output dimensions are defined per layout.
  - Composition uses preserved originals.
  - Composition creates derivative and does not overwrite originals.
  - Composition failure is recoverable.
  - Original captures remain available.
- Tests/evidence: layout dimension tests, compositor tests, failure path tests

##### PB-123: Preview composed layout result

As an attendee, I want to preview the composed output so I can decide whether to keep or retake.

- Priority: High
- Phase: Phase 1 current chain
- Status: Done if PR5 merged; verify browser evidence
- Acceptance criteria:
  - Result preview shows composed layout, not just one individual photo.
  - Retake-all is available.
  - Layout composition failure shows safe fallback.
  - Original media remains preserved.
  - UI clearly distinguishes layout output from original capture.
- Tests/evidence: component/integration tests, browser/manual preview check

#### E5 — Final customization

##### PB-124: Add output customizer sticker picker

As an attendee, I want to add stickers to the final output so it feels personalized.

- Priority: High
- Phase: Phase 1
- Status: Done if PR6 merged; browser evidence still needed
- Acceptance criteria:
  - Sticker picker appears on result/customizer screen.
  - Selected sticker is applied to derivative.
  - Clicking a sticker applies that exact sticker.
  - No stale selected-sticker state.
  - Original/composed layout remains separate.
  - No print/cloud introduced.
- Tests/evidence: focused helper tests, component/manual evidence, verifier status PARTIAL without browser visual check

##### PB-125: Add output customizer text label/custom text

As an attendee, I want to add custom text to the final output.

- Priority: High
- Phase: Phase 1
- Status: Done if PR6 merged; browser evidence still needed
- Acceptance criteria:
  - Text input exists.
  - Text is trimmed.
  - Blank text is ignored.
  - Max length is enforced.
  - Text appears in final derivative.
  - Text contrast remains readable.
- Tests/evidence: text helper tests, manual browser visual evidence

##### PB-126: Add output customizer canvas pen drawing

As an attendee, I want to draw on the final output.

- Priority: High
- Phase: Phase 1
- Status: Done if PR6 merged; touch/browser evidence still needed
- Acceptance criteria:
  - Pointer/mouse drawing works.
  - Touch drawing is supported where browser supports pointer events.
  - Strokes are normalized to output coordinates.
  - Drawing applies to derivative only.
  - Original/composed layout remains preserved.
- Tests/evidence: manual browser test required, touchscreen evidence if available, hardware PARTIAL unless target touchscreen tested

##### PB-127: Add undo/clear customization

As an attendee, I want undo/clear so I can recover from mistakes.

- Priority: High
- Phase: Phase 1
- Status: Done if PR6 merged; browser evidence still needed
- Acceptance criteria:
  - Undo removes latest customization action.
  - Clear removes all current customization actions.
  - Undo/clear do not affect original capture.
  - Controls are disabled when no actions exist.
  - UI remains clear and touch-friendly.
- Tests/evidence: helper tests, manual browser evidence

##### PB-128: Download customized final output

As an attendee, I want to download the customized final image.

- Priority: High
- Phase: Phase 1
- Status: Done if PR6 merged; download/open-file evidence still needed
- Acceptance criteria:
  - Download link uses customized derivative when available.
  - Original composed layout remains separately downloadable or recoverable.
  - Download filename is safe.
  - Downloaded output does not require cloud.
  - Failed customization render falls back to original composed layout.
- Tests/evidence: manual browser download/open JPEG evidence, no cloud/network evidence

#### E6 — Evidence, manual validation and release readiness

##### PB-129: Manual browser smoke test for Phase 1

As QA/verifier, I want manual browser evidence so runtime behavior is honestly classified.

- Priority: Critical
- Phase: Phase 1
- Status: Remaining
- Acceptance criteria:
  - Browser and OS are recorded.
  - `/booth` setup opens.
  - Setup preview updates for layout/theme/frame/style/sticker/text.
  - Camera permission flow is recorded.
  - Capture flow completes.
  - Multi-shot flow completes if enabled.
  - Composed result is shown.
  - Customizer actions are tested.
  - Downloaded JPEG is opened and visually checked.
  - Retake/reset is tested.
  - No print/cloud UI appears.
  - Hardware status is labeled PASS/PARTIAL/FAIL.
- Tests/evidence: manual checklist, screenshots/video optional but preferred

##### PB-130: Offline/no-cloud verification

As an organizer, I want Phase 1 to work locally without cloud dependency.

- Priority: High
- Phase: Phase 1
- Status: Remaining
- Acceptance criteria:
  - Core flow does not require cloud upload.
  - Setup preview assets are local.
  - Download is local browser download.
  - No email/SMS/social cloud action appears.
  - No sensitive media paths or blobs are logged.
  - If network is disabled, local UI remains usable.
- Tests/evidence: browser/manual offline or network-disabled note, log inspection note

##### PB-131: Hardware evidence labeling

As PM/verifier, I want hardware claims labeled honestly.

- Priority: Critical
- Phase: Phase 1
- Status: Remaining
- Acceptance criteria:
  - Camera PASS only with named real camera evidence.
  - Kiosk/touch PASS only with named target kiosk/touchscreen evidence.
  - Printer is Not applicable in Phase 1.
  - Mock/browser-only evidence is PARTIAL.
  - Reports always include hardware tested/not tested.
- Tests/evidence: verifier report, hardware checklist if available

##### PB-132: Phase 1 release report

As PM, I want a final Phase 1 report so stakeholders know what is complete and what remains partial.

- Priority: Critical
- Phase: Phase 1
- Status: Remaining
- Acceptance criteria:
  - Summarizes PB-101 through PB-136.
  - Lists merged PRs.
  - Lists commands and results.
  - Lists QA/reviewer/verifier status.
  - Lists browser/manual evidence.
  - Lists hardware tested/not tested.
  - Lists remaining risks.
  - Clearly states no print/cloud claim.
  - Clearly states final status: PASS/PARTIAL/FAIL.
- Tests/evidence: report review, PM approval

#### E7 — Theme/frame/sticker asset system investigation

##### PB-133: Theme/frame/sticker library investigation

As product/engineering, I want to evaluate sticker/frame/theme asset options before adding dependencies.

- Priority: Medium
- Phase: Investigation
- Status: Proposed
- Acceptance criteria:
  - Compare asset/render libraries.
  - Compare sticker sources.
  - Compare frame/template approaches.
  - Review license, offline use, bundle/runtime impact, browser/kiosk compatibility, visual quality and implementation complexity.
  - Recommend native implementation, library adoption or deferral.
  - No production dependency is added in this task.
- Tests/evidence: written investigation note

##### PB-134: Define local theme/frame asset format

As developer/operator, I want a local asset format so future themes/frames are predictable.

- Priority: Medium
- Phase: Later Phase 1 or Phase 2 candidate
- Status: Proposed
- Acceptance criteria:
  - Define theme config shape.
  - Define frame config shape.
  - Define sticker pack format.
  - Define text preset format.
  - Define supported asset types: SVG, PNG and optionally WebP.
  - Define recommended dimensions.
  - Define local-first storage rules.
  - Define missing asset fallback.
- Tests/evidence: config validation tests, docs review

##### PB-135: Implement curated local sticker pack

As an attendee, I want a beautiful default sticker pack.

- Priority: Medium
- Phase: Later Phase 1 or Phase 2 candidate
- Status: Proposed, requires PM approval before implementation
- Acceptance criteria:
  - Uses local/offline sticker assets.
  - Stickers have stable IDs.
  - Stickers are visually consistent.
  - Supports emoji fallback if image asset unavailable.
  - No cloud asset fetch is required.
  - License allows app usage.
  - Pack is not too large.
- Tests/evidence: asset/license note, UI smoke, bundle size note

##### PB-136: Implement curated local frame/theme pack

As an organizer, I want attractive default frames/themes.

- Priority: Medium
- Phase: Phase 2 candidate unless PM approves
- Status: Proposed, requires PM approval before implementation
- Acceptance criteria:
  - At least three local frames exist: classic white, party/neon and minimal/elegant.
  - At least three local themes exist: classic, party and minimal.
  - Frames work in setup preview.
  - Frames work in final renderer.
  - Missing frame falls back to default.
  - License/assets are documented.
- Tests/evidence: visual browser check, config validation, final render smoke

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
