# MomentAI Guest Flow V3 — Delivery Plan

Status: Active delivery plan after Guest Flow V3 reset.
Source architecture: `docs/architecture/MomentAI_Guest_Internal_System_Design.md`.

## Delivery goal

Deliver the official MomentAI Photobooth Guest Flow V3:

```text
START / SHOWCASE
→ SELECT SHOT FORMAT
→ LIVE VIEW / AUTO CAPTURE
→ SELECT TEMPLATE
→ CUSTOMIZE, if template allows
→ FINAL COMPOSITION
→ RESULT + QR
→ BACKGROUND AUTO PRINT
→ DONE or 120-second timeout
→ RESET GUEST SESSION
→ START
```

## Non-negotiable invariants

- Guest UI does not call hardware directly.
- SessionController owns guest session state.
- Canon EOS 6D support is behind CameraService/CanonAdapter.
- Originals are saved before composition, QR or print.
- Templates do not contain guest photos.
- Guest does not choose layout, paper, printer or photo order.
- Auto print runs in the background after final composition on the Result + QR screen.
- Printer failure never invalidates media or QR.
- Reset does not disconnect Canon EOS 6D.
- Cloud QR URLs must not expose local absolute paths.
- Hardware PASS requires real named hardware evidence.

## Milestone order

### Milestone 0 — Documentation reset and migration

Owner: Delivery lead / PM support

Scope:

- Replace old sprint/phase planning docs with Guest Flow V3 docs.
- Keep `MomentAI_Guest_Internal_System_Design.md` as architecture source.
- Create V3 backlog, delivery plan, role matrix and acceptance matrix.
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
- State machine.
- Typed events and typed errors.
- Reset behavior.
- Testable domain module independent of React.

Required tests:

- State transition tests.
- Invalid transition tests.
- Reset does not clear platform-level camera/printer config.

Exit criteria:

- SessionController is the only guest-flow coordinator.
- UI can dispatch events but does not own state transitions.

### Milestone 2 — Start and shot format selection

Owner: Frontend
Supporting: BA, QA, Reviewer
Stories: V3-003, V3-004

Scope:

- Start / Showcase screen.
- Select Shot Format screen.
- ShotFormatCard components.
- Store selected format.
- Transition to ready-to-capture.

Design guidance:

- Apply local Design Taste Frontend guidance.
- One primary action per screen.
- Large readable kiosk copy.
- Clear selected state.

Required tests/evidence:

- Component tests for format selection.
- Browser/manual screen evidence.

### Milestone 3 — Canon camera service and capture loop

Owner: Backend + Frontend
Supporting: Architect, QA, Hardware QA, Reviewer
Stories: V3-005, V3-006, V3-007

Scope:

- CameraService and CanonAdapter boundary.
- CaptureManager loop.
- Countdown per shot.
- Shot progress UI.
- Original photo preservation.
- Partial capture handling.

Required tests/evidence:

- Capture loop tests for 1/2/4/6 shot counts.
- Duplicate capture guard tests.
- Storage failure tests.
- Real Canon EOS 6D evidence for PASS, otherwise PARTIAL.

Exit criteria:

- Every captured original is saved before downstream output.
- Capture count equals selected shot count before template selection.

### Milestone 4 — Template service and assignment

Owner: Backend
Supporting: Frontend, Architect, QA, Reviewer
Stories: V3-008, V3-009

Scope:

- Template schema.
- Local/template source and published filtering.
- Filter by event + capture format.
- AssignmentEngine with `shotIndex = slotIndex`.
- No-template recovery.

Required tests/evidence:

- Template filtering tests.
- Assignment tests.
- Browser/manual template list evidence.

Exit criteria:

- Guest sees only compatible templates.
- Slot assignments are stored before composition.

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

Required tests/evidence:

- Component tests for customize skip/show behavior.
- Text max length tests.
- Drawing stroke serialization tests.
- Browser/manual touch/mouse evidence.

Exit criteria:

- No sticker/theme/frame/style setup choices remain outside template system.
- Customization data is stored on session, not embedded into originals.

### Milestone 6 — Composition outputs

Owner: Backend / Composition
Supporting: Frontend, Architect, QA, Reviewer
Stories: V3-011

Scope:

- Render from originals + template + assignments + customization.
- Render order compliance.
- Master output.
- Share output.
- Print output.
- Composition failure recovery.

Required tests/evidence:

- Output separation tests.
- Composition failure tests.
- Render order tests where feasible.
- Manual visual output evidence.

Exit criteria:

- Originals remain preserved.
- Master/share/print derivatives are separate.

### Milestone 7 — Cloud QR delivery and result screen

Owner: Backend + Frontend
Supporting: QA, Reviewer, Verifier
Stories: V3-012, V3-014

Scope:

- Cloud delivery integration boundary.
- QR generation from share output cloud URL.
- Result screen.
- 120-second timeout.
- Done/reset flow.
- QR failure fallback.

Required tests/evidence:

- QR payload tests.
- Cloud delivery failure tests/mocks.
- Browser/manual QR screen evidence.
- Timeout/reset tests.

Exit criteria:

- Result shows QR or clear fallback.
- Reset returns to Start without camera disconnect.

### Milestone 8 — Background auto print

Owner: Backend
Supporting: Frontend, Hardware QA, Reviewer, Verifier
Stories: V3-013

Scope:

- PrintProfile from template.
- PrintService.
- PrintQueue.
- Print job identity and duplicate prevention.
- PrintStatus on Result screen.
- Printer failure/retry.

Required tests/evidence:

- Print queue unit tests.
- Duplicate print prevention tests.
- Printer offline/failure tests.
- Real printer evidence for PASS, otherwise PARTIAL.

Exit criteria:

- Auto print starts after final composition while Result + QR remains usable.
- Printer failure does not block QR or delete media.

### Milestone 9 — Full-flow acceptance and release evidence

Owner: QA + Verifier
Supporting: Backend, Frontend, Reviewer, PM
Stories: V3-015

Scope:

- Full guest flow evidence.
- Offline/cloud-failure fallback evidence.
- Hardware evidence labeling.
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
