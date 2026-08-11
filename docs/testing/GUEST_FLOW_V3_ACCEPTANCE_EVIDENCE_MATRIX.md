# MomentAI Guest Flow V3 — Acceptance Evidence Matrix

Status: Active acceptance evidence matrix for Guest Flow V3.

## Evidence labels

| Label | Meaning | Can satisfy hardware PASS? |
|---|---|---:|
| Unit evidence | Pure functions/state/services tested with automated tests | No |
| Integration evidence | Multiple modules tested together with fakes/mocks | No |
| Browser/manual evidence | Manual validation in browser/dev environment | Only if named real device is used and documented |
| Real Canon evidence | Tested on named Canon EOS 6D + macOS environment | Yes for Canon camera claims |
| Real printer evidence | Tested on named physical printer/driver/path | Yes for printer claims |
| Real kiosk evidence | Tested on named kiosk/touchscreen | Yes for kiosk claims |
| Not applicable | No runtime/hardware claim | N/A |

## Hardware status rules

- `PASS`: tested on the claimed real device and evidence names the device/environment.
- `PARTIAL`: tested with mock, simulation, dev browser only or incomplete hardware coverage.
- `FAIL`: tested and did not meet acceptance criteria.
- `Not applicable`: no hardware/runtime claim.

Never mark Canon, printer or kiosk support `PASS` from mocks.

## Story evidence matrix

| Story | Acceptance focus | Unit evidence | Integration evidence | Browser/manual evidence | Hardware evidence | Minimum status |
|---|---|---|---|---|---|---|
| V3-001 | State machine and SessionController | required | preferred | not required | Not applicable | unit PASS |
| V3-002 | Session model and reset semantics | required | preferred | optional | Not applicable | type/unit PASS |
| V3-003 | Start/Showcase screen | optional | optional | required | kiosk PARTIAL unless real kiosk tested | browser PASS/PARTIAL |
| V3-004 | Shot format selection | required for format helpers | required for UI flow | required | Not applicable unless kiosk claim | component/manual PASS |
| V3-005 | Canon camera boundary | required for adapter contract | required with mock adapter | manual status if available | PASS only with Canon EOS 6D | PARTIAL or PASS |
| V3-006 | Capture loop by shot count | required | required | required | PASS only with real camera capture | integration PASS, hardware labeled |
| V3-007 | Original preservation | required | required | manual capture evidence | PASS only with real camera/storage environment | media safety PASS |
| V3-008 | Template filtering | required | preferred | manual template list | Not applicable | unit/manual PASS |
| V3-009 | Shot-to-slot assignment | required | optional | optional | Not applicable | unit PASS |
| V3-010 | Conditional customization | required for text/draw helpers | required for UI flow | required | kiosk/touch PASS only with real touchscreen | component/manual PASS |
| V3-011 | Master/share/print derivatives | required | required | visual output evidence | Not applicable unless hardware print claim | integration/manual PASS |
| V3-012 | Cloud QR delivery | required for URL/QR | required for cloud failure mock | required QR screen | Not applicable unless device scan claim | QR evidence PASS/PARTIAL |
| V3-013 | Background auto print | required | required with mock printer | print status manual | PASS only with named real printer | PARTIAL or PASS |
| V3-014 | Result timeout/reset | required | required | required | camera PASS only if real Canon stays connected | manual PASS/PARTIAL |
| V3-015 | Release evidence | not required | not required | report review | PASS/PARTIAL/FAIL labels | verifier PASS/PARTIAL |

## Critical flow evidence

### F1 — Full Guest Flow V3

Required evidence:

- Start screen appears.
- Guest selects 1/2/4/6 shot format.
- Capture completes selected shot count.
- Originals are saved before template/composition/output.
- Compatible templates only are shown.
- Template is selected.
- Customization appears only if allowed.
- Final composition creates master/share/print derivatives.
- QR appears from cloud share output or clear fallback appears.
- Auto print starts in background if printer enabled.
- Done or 120-second timeout resets guest UI.
- Reset does not disconnect Canon camera service.

### F2 — Media safety

Pass criteria:

- Originals are never overwritten.
- Partial captures are preserved.
- Composition failure preserves originals.
- QR failure preserves originals and outputs.
- Printer failure preserves originals and outputs.
- Session cannot be successfully completed if required originals failed to save.

### F3 — Camera and capture recovery

Pass criteria:

- Camera unavailable blocks or recovers before capture.
- Capture failure does not increment saved shot count.
- Previous successful shots remain in photo pool.
- Recovery action is explicit and bounded.

### F4 — Template/customization recovery

Pass criteria:

- No compatible template has explicit operator/user message.
- Incompatible templates are hidden.
- Text respects template max length.
- Drawing stroke data can be serialized for high-resolution render.

### F5 — QR/cloud failure

Pass criteria:

- Cloud/QR failure is visible.
- Local media remains preserved.
- Print can continue if available.
- No local absolute path is exposed.

### F6 — Print failure

Pass criteria:

- Failed print job does not block Result + QR screen.
- QR remains available.
- Job status is failed/retryable when feasible.
- No media is deleted.

## Story signoff template

```text
Story: V3-___
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

## Final acceptance summary template

```text
Guest Flow V3 status: PASS | PARTIAL | FAIL
Completed stories:
Deferred stories:
Commands:
- pnpm lint: PASS | FAIL | Not run
- pnpm build: PASS | FAIL | Not run
- pnpm test: PASS | FAIL | Not run
- pnpm tsc --noEmit: PASS | FAIL | Not run
Critical flows:
- F1 Full Guest Flow V3: PASS | PARTIAL | FAIL
- F2 Media safety: PASS | FAIL
- F3 Camera/capture recovery: PASS | PARTIAL | FAIL
- F4 Template/customization recovery: PASS | PARTIAL | FAIL
- F5 QR/cloud failure: PASS | PARTIAL | FAIL
- F6 Print failure: PASS | PARTIAL | FAIL
Hardware:
- Canon EOS 6D: PASS | PARTIAL | FAIL | Not tested
- Printer: PASS | PARTIAL | FAIL | Not tested
- Kiosk/touch: PASS | PARTIAL | FAIL | Not tested
Remaining risks:
```
