# MomentAI Guest Flow V3 — Delivery Plan

Status: Active delivery plan after Guest Flow V3 reset, updated for Production Brief v3.1 PM decisions.
Source architecture: `docs/architecture/MomentAI_Guest_Internal_System_Design.md` and `docs/MomentAI_CameraOS_Production_Brief_v3.1.md`.
Target runtime: Windows 10 x64 booth PC / Mini PC form factor + Electron + Vite React renderer. Admin/operator is inside Electron and hidden from guests. macOS is allowed only as a development platform using Device/Fake adapters; React Native, iPad and macOS production runtimes are out of V1 scope.

## PM decisions applied

- Production OS target: Windows 10 x64 booth PC.
- V1 share mode: `LOCAL_NETWORK_URL` preferred, with explicit unavailable/disabled fallback when the phone cannot reach the booth endpoint. Cloud URL delivery is deferred unless PM approves a cloud provider.
- V1 print policy: `GUEST_CONFIRM`.
- Retake: deferred to a later phase; V1 Guest UI must not show retake. Admin-configurable retake policy is reserved for later work and V1 effective behavior is `allowGuestRetake=false`, `maxRetakesPerShot=0`.
- Canon Command Shadow Mode: implement after the fake/device capture loop and before the physical Canon integration spike. Shadow evidence never satisfies Canon hardware PASS.

## Delivery goal

Deliver the official MomentAI Photobooth Guest Flow V3:

```text
START / SHOWCASE
→ SELECT SHOT FORMAT
→ LIVE VIEW / AUTO CAPTURE
→ SELECT TEMPLATE
→ CUSTOMIZE, if template allows
→ FINAL COMPOSITION
→ RESULT + LOCAL QR when reachable / fallback when unavailable + optional GUEST-CONFIRMED PRINT
→ DONE or 120-second timeout
→ RESET GUEST SESSION
→ START
```

## Non-negotiable invariants

- Guest UI does not call hardware directly.
- SessionController owns guest session state.
- System readiness, guest session flow and side-effect jobs are separate state concerns.
- Canon EOS 6D support is behind CameraService/CanonAdapter/CanonCameraBridge.
- DeviceCameraAdapter and FakeCameraAdapter may be used for development and tests but cannot satisfy Canon hardware PASS.
- Originals are saved before composition, QR or print.
- Live View frames are preview only; final composition uses persisted still images.
- Templates do not contain guest photos.
- Guest does not choose layout, paper, printer, camera provider, photo order or print profile.
- Guest may confirm printing in V1, but the system derives printer, paper/profile and copies from event/template configuration.
- Printer failure never invalidates media or QR.
- Reset does not disconnect a healthy Canon/device camera service or printer service.
- Local QR is allowed only when it resolves to a reachable local network endpoint from the guest phone.
- QR must never point to `localhost`, local absolute filesystem paths or inaccessible private paths.
- Cloud QR URLs and local QR URLs must not expose local absolute paths or QR secrets in logs.
- Hardware PASS requires real named hardware evidence.
- Renderer screens, including admin/operator, never import filesystem, SQLite, Canon SDK, Windows print APIs or shell commands directly.
- Electron preload/IPC is the only renderer-to-platform boundary.
- Windows 10 x64 booth PC, Canon EOS 6D, CP1000 and touchscreen remain `Not tested` until purchased and evidenced.
- Canon Shadow Mode logs are simulated production-intent traces and never real Canon/EDSDK success evidence.

## Milestone order

### Same-day fast-track foundation — Windows 10 x64 booth PC / Electron runway

Owner: Delivery lead
Supporting: Architect, Backend, Frontend, QA

Scope for the approved foundation slice:

- Update source-of-truth docs to Windows 10 x64 booth PC + Electron as the V1 production target.
- Keep React Native, iPad app and macOS production runtime out of V1 scope.
- Keep macOS only as a development path using DeviceCameraAdapter/FakeCameraAdapter.
- Establish `apps/desktop` and `packages/*` skeletons without big-bang UI rewrite.
- Add typed contracts for session, system state, shot formats, camera, printer, storage, share and admin.
- Add fake adapters only; do not claim Canon/CP1000/kiosk support.
- Add Electron main/preload skeleton and keep renderer access behind typed APIs.
- Keep admin/operator inside Electron as a hidden/local operator surface.

Foundation checklist:

- [x] Update source-of-truth docs from macOS to Windows/Electron foundation.
- [x] Keep React Native, iPad app and macOS runtime out of V1 production scope.
- [x] Establish `apps/desktop` and `packages/*` skeletons without big-bang UI rewrite.
- [x] Add typed contracts for session, shot formats, camera, printer, storage and admin.
- [x] Add fake camera, printer and storage adapters only.
- [x] Add Electron main/preload skeleton and keep renderer access behind typed APIs.
- [x] Reuse existing Guest UI source in the Electron renderer shell.
- [x] Reuse existing Admin Frame Import UI source in the Electron renderer shell.
- [x] Add admin passcode gate for the Electron admin surface.
- [x] Add Electron main admin service skeleton and admin IPC handler skeleton.
- [x] Add Electron main guest session service skeleton and guest IPC handler skeleton.
- [x] Add Electron main image storage skeleton through storage contract/fake adapter.
- [x] Add media retention/cleanup skeleton with active-session and print-active safeguards.
- [x] Expose cleanup summary/run-now through admin contract and IPC skeleton.
- [ ] Align any remaining source-of-truth target-runtime wording to Windows 10 x64 booth PC where applicable.
- [ ] Bind real Electron `ipcMain`/`ipcRenderer` after runtime dependencies are installed.
- [ ] Replace Next API calls in Guest/Admin UI with Electron preload clients.
- [ ] Implement LocalFilesystemSQLiteStorageAdapter.
- [ ] Implement CanonEdsdkAdapter after hardware arrives and the Canon physical integration spike starts.
- [ ] Implement WindowsPrintAdapter after CP1000 arrives and printer spike starts.

Exit criteria:

- Existing Next flow remains usable during migration.
- Typecheck and focused tests run or failures are documented.
- Hardware status remains `Not tested` / `PARTIAL` until devices are purchased and evidenced.

### Milestone 0 — Documentation reset and migration

Owner: Delivery lead / PM support

Scope:

- Replace old sprint/phase planning docs with Guest Flow V3 docs.
- Keep `MomentAI_Guest_Internal_System_Design.md` as architecture source.
- Apply Production Brief v3.1 PM decisions to delivery plan, backlog, role matrix and evidence matrix.
- Record PM decisions for Windows 10 x64, local QR, guest-confirmed print, retake deferral and Canon Shadow sequencing.
- Remove obsolete Sprint/Phase/production planning files after approval.

Evidence:

- Git diff of docs only.
- No code behavior claim.
- Hardware status: Not applicable.

### Milestone 1 — Session and state machine foundation

Owner: Backend
Supporting: Architect, QA, Verifier
Stories: V3-001, V3-002

Scope:

- Session model.
- Separate `SystemState`, `SessionState` and side-effect `JobState` contracts.
- Typed events and typed errors.
- Durable session creation contract at START.
- Persisted state boundaries for meaningful session transitions.
- Reset behavior and reset idempotency.
- Ensure reset does not tear down healthy camera/printer services.
- Testable domain module independent of React.

Required tests:

- State transition tests.
- Invalid transition tests.
- Reset does not clear platform-level camera/printer config.
- Reset is safe to call repeatedly.
- Job state is not overloaded into guest session state.

Exit criteria:

- SessionController is the only guest-flow coordinator.
- UI can dispatch typed events but does not own state transitions.
- System readiness and job lifecycle are not hidden inside guest UI state.

### Milestone 1A — Event readiness, health gate and production configuration

Owner: Backend + Architect
Supporting: Frontend, QA, Verifier
Stories: Foundation gate for V3-003/V3-004

Scope:

- Minimal `EventConfig` with active event ID, enabled 1/2/4/6 shot formats, timeout policy, capture policy, `PrintPolicy=GUEST_CONFIRM`, `ShareMode=LOCAL_NETWORK_URL`, template set, and V1 retake disabled.
- Health aggregation for camera, storage, database/persistence, composition, printer and share/network.
- `READY` / `DEGRADED` / `BLOCKED` gate before Guest Start.
- Guest Start disabled or blocked when event/system readiness fails.
- Operator/admin-readable readiness reason.
- Local share mode represented as `LOCAL_NETWORK_URL` with unavailable/disabled fallback when the endpoint is not reachable.
- Storage warning/block threshold contract.

Required tests/evidence:

- No active event blocks Guest Start.
- BLOCKED health prevents new session.
- Optional local share unavailable shows fallback, not a broken QR.
- Required printer unavailable blocks or degrades according to event policy.
- Event enabled shot formats drive format selection.

Exit criteria:

- Guest UI cannot start unsafe production flow.
- Operator/admin can see the readiness reason.
- Milestone 2 may consume event/readiness state instead of hardcoded readiness assumptions.

### Milestone 2 — Start and shot format selection

Owner: Frontend
Supporting: BA, Backend, QA, Reviewer
Stories: V3-003, V3-004

Scope:

- Start / Showcase screen.
- Select Shot Format screen.
- ShotFormatCard components.
- Read active event/readiness state from typed preload/domain contract.
- Start is disabled/blocked when readiness is not acceptable.
- Show shot formats from `EventConfig.enabledShotFormats`; current V1 event may enable 1/2/4/6.
- Store selected format on the durable session.
- Transition to ready-to-capture.

Design guidance:

- Apply local Design Taste Frontend guidance.
- One primary action per screen.
- Large readable kiosk copy.
- Clear selected state.
- Operator/recovery messages are clear without exposing Canon/SDK technical details to guests.

Required tests/evidence:

- Component tests for format selection.
- Start blocked with no active event/readiness failure.
- Browser/manual screen evidence.

### Milestone 3 — Camera service and capture loop with fake/device first

Owner: Backend + Frontend
Supporting: Architect, QA, Hardware QA, Reviewer
Stories: V3-005, V3-006, V3-007

Scope:

- CameraService and CameraAdapter boundary.
- FakeCameraAdapter first; DeviceCameraAdapter may be used for development.
- CanonAdapter contract remains behind CameraService but physical Canon implementation is a separate spike.
- Camera capabilities and provider status reporting.
- Fallback provider activation is explicit, visible in Admin state and logged; fallback never pretends to be Canon.
- CaptureManager loop.
- Countdown per shot.
- Shot progress UI.
- Capture lock and duplicate capture guard.
- Prevent Admin test capture/provider switch while guest capture owns the lock.
- Original photo validation and preservation before `shotComplete=true`.
- Partial capture handling.
- No provider switch mid-sequence.

Required tests/evidence:

- Capture loop tests for 1/2/4/6 shot counts.
- Duplicate capture guard tests.
- Storage failure tests.
- Capture failure does not increment saved shot count.
- Fake/device adapter evidence for software behavior.
- Real Canon EOS 6D evidence for PASS, otherwise PARTIAL/Not tested.

Exit criteria:

- Every captured original is saved before downstream output.
- Capture count equals selected shot count before template selection.
- Fake/device capture flow is complete before Canon Shadow Mode or physical Canon spike claims.

### Milestone 3S — Canon Command Shadow Mode

Owner: Backend
Supporting: Architect, QA, Verifier
Placement: after fake/device capture loop and before physical Canon integration spike.

Scope:

- Translate production-intent camera actions into Canon-domain shadow commands.
- Reuse the same `sessionId`, `shotIndex` and `correlationId` used by the capture transaction.
- Write structured `CANON:SHADOW` logs.
- Display shadow commands in the Admin Dev Console.
- Clearly mark commands as simulated/shadowed.
- Never contact Canon hardware, Canon EDSDK or Canon bridge.
- Never report shadow events as real Canon SDK success.

Required tests/evidence:

- Shadow command log evidence.
- Correlation ID evidence.
- Admin Dev Console evidence.
- Explicit hardware status: Canon PASS not satisfied by shadow evidence.

Exit criteria:

- Production-intent command ordering can be inspected during macOS/device/fake development.
- Shadow evidence is labeled PARTIAL/Not applicable for hardware claims.

### Milestone 3H — Canon physical integration spike

Owner: Backend + Hardware QA
Supporting: Architect, Reviewer, Verifier
Placement: after fake/device capture loop and Canon Shadow Mode, when hardware is available.

Scope:

- Validate Canon EOS 6D USB `A/V OUT / DIGITAL` connection on Windows 10 x64 booth PC.
- Validate Canon EDSDK version/bitness and CanonCameraBridge approach.
- Initialize SDK, enumerate camera, open session and start live view.
- Capture still, receive object/download event, validate JPEG and persist original.
- Structured Canon command/event logs with correlation ID.
- Disconnect/reconnect behavior.

Required tests/evidence:

- Named Canon EOS 6D evidence.
- Named Windows 10 x64 booth PC evidence.
- EDSDK/bridge path evidence.
- Live view/capture/download/persist evidence.

Exit criteria:

- Canon hardware status may be PASS only with real-device evidence.
- Without hardware evidence, Canon remains PARTIAL/Not tested.

### Milestone 4 — Template service and assignment

Owner: Backend
Supporting: Frontend, Architect, QA, Reviewer
Stories: V3-008, V3-009

Scope:

- Template schema and manifest validation.
- Local/template source and published filtering.
- Filter by event + capture format/shot count.
- Validate supported shot counts, slots, assets, customization capability, print profile and share profile.
- AssignmentEngine with `shotIndex = slotIndex`.
- No-template recovery.

Required tests/evidence:

- Template filtering tests.
- Manifest validation tests.
- Assignment tests.
- Browser/manual template list evidence.

Exit criteria:

- Guest sees only compatible templates.
- Slot assignments are stored before composition.
- Guest cannot reorder photos in V1.

### Milestone 5 — Template selection UI and conditional customize

Owner: Frontend
Supporting: BA, Backend, QA, Reviewer
Stories: V3-010

Scope:

- TemplateScreen.
- TemplateLivePreview.
- CustomizeScreen only when template allows.
- Editable text regions.
- Virtual keyboard.
- Drawing stroke data.
- Store customization model separately from raster output.
- Do not treat low-resolution UI canvas screenshots as print masters.
- Retake remains deferred and must not appear on Guest UI.

Required tests/evidence:

- Component tests for customize skip/show behavior.
- Text max length tests.
- Drawing stroke serialization tests.
- Browser/manual touch/mouse evidence.

Exit criteria:

- No sticker/theme/frame/style setup choices remain outside template system.
- Customization data is stored on session, not embedded into originals.
- Guest retake is not exposed in V1.

### Milestone 6 — Composition outputs

Owner: Backend / Composition
Supporting: Frontend, Architect, QA, Reviewer
Stories: V3-011

Scope:

- Render deterministically from originals + template version + assignments + customization + event branding.
- EXIF/orientation normalization where feasible.
- Render order compliance.
- Explicit output profiles.
- Master output.
- Share output.
- Print output.
- Atomic persistence for critical outputs.
- Output validation and output path/hash persistence.
- Composition failure recovery.

Required tests/evidence:

- Output separation tests.
- Composition failure tests.
- Render order tests where feasible.
- Manual visual output evidence.

Exit criteria:

- Originals remain preserved.
- Master/share/print derivatives are separate.
- Final print output is not produced from low-resolution UI screenshots.

### Milestone 7 — Local Share/QR capability and result screen

Owner: Backend + Frontend
Supporting: QA, Reviewer, Verifier
Stories: V3-012, V3-014

Scope:

- ShareService boundary.
- V1 ShareMode supports `DISABLED` and `LOCAL_NETWORK_URL`.
- Cloud URL provider is deferred unless PM approves a provider integration.
- Local ShareService serves final-share output through a tokenized session route.
- QR generation only after a retrieval URL exists.
- Local QR URL must be reachable from a guest phone on the same event network; it must not be `localhost`-only.
- QR unavailable/fallback state when the local endpoint/network is not reachable.
- Result screen.
- 120-second timeout.
- Done/reset flow.
- QR failure fallback.

Required tests/evidence:

- QR payload tests.
- Local share URL token/path tests.
- No local absolute path exposure tests.
- Local network unavailable fallback tests/mocks.
- Browser/manual QR screen evidence.
- Manual phone scan evidence before Local QR PASS.
- Timeout/reset tests.

Exit criteria:

- Result shows a QR to a real local network URL or a clear fallback.
- QR never exposes `localhost`-only URLs, local absolute paths or arbitrary filesystem routes.
- Reset returns to Start without camera disconnect.

### Milestone 8 — Guest-confirmed print queue

Owner: Backend
Supporting: Frontend, Hardware QA, Reviewer, Verifier
Stories: V3-013

Scope:

- `PrintPolicy=GUEST_CONFIRM` for V1.
- Result screen exposes a guest print confirmation action when printing is enabled.
- Guest does not choose printer, paper, layout or print profile.
- PrintProfile comes from selected template/event config.
- PrintService.
- Durable PrintQueue/PrintJob.
- Print job identity and duplicate prevention.
- PrintStatus on Result screen.
- Printer failure/retry.
- Fake printer first; WindowsPrintAdapter only after CP1000 arrives.

Required tests/evidence:

- Print queue unit tests.
- Duplicate print prevention tests.
- Printer offline/failure tests.
- Guest-confirm action creates one durable intended job.
- Real printer evidence for PASS, otherwise PARTIAL.

Exit criteria:

- Guest confirmation creates one durable print job while Result + QR remains usable.
- Duplicate taps do not create duplicate print jobs.
- Printer failure does not block QR or delete media.

### Milestone 8A — Admin operations and maintenance minimum

Owner: Frontend + Backend
Supporting: Architect, QA, Hardware QA, Reviewer
Stories: Production operations gate before final release evidence.

Scope:

- Admin passcode gate.
- Readiness dashboard.
- Active event status.
- Camera diagnostics.
- Printer diagnostics.
- Storage health.
- Share/network status.
- Failed job basic visibility.
- Logs/diagnostic view/export where feasible.
- Maintenance mode.
- Disable admin hardware commands while guest owns the relevant device lock.
- Exit maintenance only after readiness check.

Required tests/evidence:

- Admin readiness screen evidence.
- Maintenance mode blocks Guest Start.
- Admin camera/print diagnostics disabled during active guest capture/print lock.
- Basic diagnostics/log evidence.

Exit criteria:

- Operator can see why the booth is READY/DEGRADED/BLOCKED.
- Operator diagnostics cannot corrupt active guest capture/print operations.

### Milestone 8H — Windows CP1000 physical printer spike

Owner: Backend + Hardware QA
Supporting: Frontend, Reviewer, Verifier
Placement: after durable fake print queue, when CP1000 is available.

Scope:

- Validate Canon SELPHY CP1000 on Windows 10 x64 booth PC via Windows Print System.
- Validate OS print submission behavior.
- Validate offline/failure status where feasible.
- Validate duplicate prevention with real submission path.
- Verify result screen does not overclaim physical completion.

Required tests/evidence:

- Named Canon SELPHY CP1000 evidence.
- Named Windows 10 x64 booth PC evidence.
- Windows Print System submission evidence.
- Failure/offline behavior evidence where feasible.

Exit criteria:

- Printer PASS only with named hardware evidence.
- Without hardware evidence, printer remains PARTIAL/Not tested.

### Milestone 9 — Full-flow acceptance and release evidence

Owner: QA + Verifier
Supporting: Backend, Frontend, Reviewer, PM
Stories: V3-015

Scope:

- Full guest flow evidence.
- Local QR/fallback evidence.
- Guest-confirmed print evidence.
- Offline/local-network-unavailable fallback evidence.
- Hardware evidence labeling.
- Electron IPC/security boundary review.
- Boot readiness gate evidence.
- Reset/restart evidence where feasible.
- Final release package.

Required commands:

```text
git status --short
pnpm lint
pnpm build
pnpm test
pnpm tsc --noEmit, when type surfaces are touched
```

Exit criteria:

- QA PASS.
- Reviewer PASS.
- Verifier PASS or accepted PARTIAL only for missing hardware evidence.
- PM final approval.
- No Canon/printer/kiosk PASS claimed without named real hardware evidence.
