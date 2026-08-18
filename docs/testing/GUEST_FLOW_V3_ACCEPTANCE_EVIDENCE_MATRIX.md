# MomentAI Guest Flow V3 — Acceptance Evidence Matrix

Status: Active acceptance evidence matrix for Guest Flow V3, updated for Production Brief v3.1 PM decisions.

## PM decisions applied

- Production target: Windows 10 x64 booth PC / Mini PC form factor.
- V1 Share/QR: `LOCAL_NETWORK_URL` preferred with explicit unavailable/disabled fallback; cloud provider deferred unless approved.
- V1 Print: `GUEST_CONFIRM` durable print queue.
- V1 Retake: deferred from Guest UI; later admin-configurable policy only.
- Canon Command Shadow Mode: after fake/device capture loop and before physical Canon spike; never hardware PASS evidence.

## Evidence labels

| Label | Meaning | Can satisfy hardware/network PASS? |
|---|---|---:|
| Unit evidence | Pure functions/state/services tested with automated tests | No |
| Integration evidence | Multiple modules tested together with fakes/mocks | No |
| Browser/manual evidence | Manual validation in browser/dev environment | Only if named real device/environment is used and documented |
| Electron smoke evidence | Electron main/preload/renderer starts and IPC responds in dev/runtime environment | No |
| IPC contract evidence | Typed preload/IPC APIs tested with fake services | No |
| Fake adapter evidence | Fake camera/printer/storage/share contract behavior tested | No |
| Device adapter evidence | DeviceCameraAdapter evidence in development environment | No for Canon PASS |
| Canon Shadow evidence | Simulated CANON:SHADOW command ordering/log/correlation evidence without Canon hardware/EDSDK/Bridge access | No for Canon PASS |
| Local QR evidence | QR scanned from a named phone on the same reachable local network and final-share output successfully retrieved from the booth endpoint | Yes for local QR claim only |
| Real Canon evidence | Tested on named Canon EOS 6D + Windows 10 x64 booth PC + Canon EDSDK/Bridge environment | Yes for Canon camera claims |
| Real printer evidence | Tested on named Canon SELPHY CP1000 + Windows 10 x64 booth PC + Windows Print System path | Yes for printer claims |
| Real kiosk evidence | Tested on named Windows 10 x64 booth PC touchscreen/kiosk environment | Yes for kiosk claims |
| Not applicable | No runtime/hardware/network claim | N/A |

## Hardware and network status rules

- `PASS`: tested on the claimed real device/environment and evidence names the device/environment.
- `PARTIAL`: tested with mock, simulation, dev browser only, fake/device/shadow adapter only or incomplete hardware/network coverage.
- `FAIL`: tested and did not meet acceptance criteria.
- `Not applicable`: no hardware/runtime/network claim applies.
- `Not tested`: a hardware/runtime/network claim exists but the target device/environment was not tested.

Never mark Canon, printer, Windows 10 x64 booth PC, CP1000, kiosk or Local QR support `PASS` from mocks/fakes/shadow evidence. Until the target hardware/network path is purchased/configured/tested, hardware-dependent and network-dependent stories remain `PARTIAL` or `Not tested`.

## Story evidence matrix

| Story | Acceptance focus | Unit evidence | Integration evidence | Browser/manual evidence | Hardware/network evidence | Minimum status |
|---|---|---|---|---|---|---|
| V3-001 | Session state plus separated SystemState/JobState | required | preferred | not required | Not applicable | unit PASS |
| V3-002 | Durable session model and reset semantics | required | preferred | optional | Not applicable | type/unit PASS |
| Milestone 1A | Event readiness and health gate | required | required | preferred admin/manual evidence | Not applicable unless kiosk/runtime claim | readiness PASS |
| V3-003 | Start/Showcase screen with readiness-aware Start | optional | optional | required | kiosk PARTIAL unless real kiosk tested | browser PASS/PARTIAL |
| V3-004 | Event-enabled shot format selection | required for format helpers | required for UI flow | required | Not applicable unless kiosk claim | component/manual PASS |
| V3-005 | Camera adapter boundary and fallback honesty | required for adapter contract | required with fake/device adapter + IPC contract | Electron/manual status if available | PASS only with Canon EOS 6D on Windows 10 x64 booth PC via EDSDK/Bridge | PARTIAL or PASS |
| V3-006 | Capture loop by shot count | required | required | required | PASS only with real camera capture | integration PASS, hardware labeled |
| V3-007 | Original preservation and storage safety | required | required | manual capture evidence | PASS only with real camera/storage environment | media safety PASS |
| Milestone 3S | Canon Shadow Mode | required for log shape | required for command ordering/correlation | Admin Dev Console evidence preferred | Canon Shadow evidence only; never Canon PASS | shadow PARTIAL/Not applicable for hardware |
| Milestone 3H | Canon physical spike | preferred | required with bridge path | required | PASS only with named Canon EOS 6D + Windows 10 x64 booth PC + EDSDK/Bridge | PASS/PARTIAL/FAIL |
| V3-008 | Template filtering and manifest validation | required | preferred | manual template list | Not applicable | unit/manual PASS |
| V3-009 | Shot-to-slot assignment | required | optional | optional | Not applicable | unit PASS |
| V3-010 | Conditional customization, separate model, no retake UI | required for text/draw helpers | required for UI flow | required | kiosk/touch PASS only with real touchscreen | component/manual PASS |
| V3-011 | Master/share/print derivatives and atomic outputs | required | required | visual output evidence | Not applicable unless hardware print claim | integration/manual PASS |
| V3-012 | Local Share/QR delivery and fallback | required for URL/token/path helpers | required for local share/fallback mock | required QR screen | PASS only with named phone + same reachable local network + successful retrieval | QR evidence PASS/PARTIAL |
| V3-013 | Guest-confirmed durable print queue | required | required with fake printer + IPC contract | print status manual/Electron evidence | PASS only with named Canon SELPHY CP1000 via Windows 10 x64 booth PC Windows Print System | PARTIAL or PASS |
| V3-014 | Result timeout/reset with durable completing | required | required | required | camera PASS only if real Canon stays connected | manual PASS/PARTIAL |
| Milestone 8A | Admin operations and maintenance minimum | preferred | required | required admin/manual evidence | Hardware PASS only for named tested devices | admin PASS/PARTIAL |
| Milestone 8H | Windows CP1000 physical printer spike | preferred | required with printer adapter | required | PASS only with named CP1000 + Windows 10 x64 booth PC print path | PASS/PARTIAL/FAIL |
| V3-015 | Release evidence | not required | not required | report review | PASS/PARTIAL/FAIL labels | verifier PASS/PARTIAL |

## Critical flow evidence

### F1 — Full Guest Flow V3

Required evidence:

- Start screen appears.
- Guest Start respects active event/readiness gate.
- Guest selects enabled 1/2/4/6 shot format.
- Capture completes selected shot count.
- Originals are saved before template/composition/output.
- Compatible templates only are shown.
- Template is selected.
- Customization appears only if allowed.
- Guest retake is not shown in V1.
- Final composition creates master/share/print derivatives.
- QR appears from a reachable tokenized local share URL or clear fallback appears.
- Guest-confirmed print creates a durable print job if printer is enabled.
- Done or 120-second timeout persists completion and resets guest UI.
- Reset does not disconnect Canon/device camera service.

### F2 — Media safety

Pass criteria:

- Originals are never overwritten.
- Partial captures are preserved.
- Composition failure preserves originals.
- QR/share failure preserves originals and outputs.
- Printer failure preserves originals and outputs.
- Reset does not delete originals, outputs or durable jobs.
- Session cannot be successfully completed if required originals failed to save.

### F3 — Camera and capture recovery

Pass criteria:

- Camera unavailable blocks or recovers before capture.
- Capture failure does not increment saved shot count.
- Previous successful shots remain in photo pool.
- Recovery action is explicit and bounded.
- Provider switch is blocked during an active capture sequence.
- Canon Shadow Mode, when enabled, is clearly labeled simulated and cannot satisfy Canon PASS.

### F4 — Template/customization recovery

Pass criteria:

- When no compatible template exists, the UI shows an explicit guest/operator recovery message.
- Incompatible templates are hidden.
- Text respects template max length.
- Drawing stroke data can be serialized for high-resolution render.
- Low-resolution UI screenshots are not used as print masters.
- Guest retake UI is absent in V1.

### F5 — Local QR/share failure

Pass criteria:

- Local QR points to a tokenized local network URL, not `localhost` only.
- Local QR does not expose a local absolute path.
- Local ShareService does not serve arbitrary files or directory listings.
- Network/phone retrieval failure is visible as QR unavailable/fallback.
- Local media remains preserved.
- Print can continue if available.

### F6 — Print failure

Pass criteria:

- Print requires guest confirmation under V1 `GUEST_CONFIRM` policy.
- Duplicate print taps create only one intended durable print job.
- Failed print job does not block Result + QR/fallback screen.
- QR/fallback remains available.
- Job status is failed/retryable when feasible.
- No media is deleted.
- UI does not claim physical print completion merely because a command was dispatched.

### F7 — Local QR retrieval

Pass criteria:

- Final-share output exists before QR generation.
- QR points to a tokenized local network URL reachable from a named phone on the same event network.
- QR does not use `localhost`-only URL.
- QR does not expose local absolute path or QR secrets in logs.
- Named phone retrieves final-share output successfully.
- If network is unavailable or blocked by firewall/router/client isolation, Result screen shows explicit QR unavailable/fallback state.

### F8 — Readiness and maintenance

Pass criteria:

- No active event blocks Guest Start.
- BLOCKED health prevents new sessions.
- DEGRADED health allows sessions only when the missing capability is optional by event policy.
- Operator sees readiness reason.
- Maintenance mode blocks Guest Start.
- Admin hardware diagnostics are disabled while Guest operation owns the relevant device lock.

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
Network evidence, when Local QR is claimed: PASS | PARTIAL | FAIL | Not applicable
Hardware tested:
Hardware not tested:
Network tested:
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
- F5 Local QR/share failure: PASS | PARTIAL | FAIL
- F6 Print failure: PASS | PARTIAL | FAIL
- F7 Local QR retrieval: PASS | PARTIAL | FAIL
- F8 Readiness and maintenance: PASS | PARTIAL | FAIL
Hardware/network:
- Windows 10 x64 booth PC: PASS | PARTIAL | FAIL | Not tested
- Canon EOS 6D: PASS | PARTIAL | FAIL | Not tested
- Printer / Canon SELPHY CP1000: PASS | PARTIAL | FAIL | Not tested
- Kiosk/touch: PASS | PARTIAL | FAIL | Not tested
- Local QR phone/network: PASS | PARTIAL | FAIL | Not tested
Remaining risks:
```
