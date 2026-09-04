# MomentAI Guest Flow V3 — Acceptance Evidence Matrix

Status: Active acceptance evidence matrix for Guest Flow V3, updated for Production Brief v3.1 PM decisions.

## PM decisions applied

- Production target: Windows 10 x64 booth PC / Mini PC form factor packaged as a Windows `.exe` Electron kiosk app.
- Production storage root: `%LOCALAPPDATA%` under an app-owned MomentAI Photobooth directory.
- V1 kiosk/startup: fullscreen guest kiosk, hidden/passcode-gated Admin access and Windows startup/auto-launch support.
- V1 Share/QR: `CLOUD_LANDING_PAGE` through approved Vercel + Neon + R2 provider stack, with `LOCAL_NETWORK_URL` fallback/dev/offline mode when configured and reachable.
- QR token TTL: 10 minutes from share/landing creation; cleanup eligibility defaults to 30 minutes with print/share recovery guards.
- V1 Print: `GUEST_CONFIRM` durable FIFO print queue; printer slowness queues jobs, print failure stops queue with no auto retry and requires Admin manual reprint/resume.
- V1 hardware: Canon EOS 6D and Canon SELPHY CP1000 are the only certified production targets; adapters remain extensible for later PM-approved hardware.
- V1 Retake: deferred from Guest UI; later admin-configurable policy only.
- Canon Command Shadow Mode: after fake/device capture loop and before physical Canon spike; never hardware PASS evidence.
- Touch/kiosk UX: scrollable guest/operator views must support natural touch drag scrolling.

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
| Cloud QR evidence | QR scanned from a named phone, deployed Vercel landing page reached, Neon token validation succeeded, R2 final-share media retrieved, 10-minute expiry verified and no secrets/paths exposed | Yes for cloud QR claim only |
| Local QR evidence | QR scanned from a named phone on the same reachable local network and final-share output successfully retrieved from the booth endpoint | Yes for local QR fallback claim only |
| Windows `.exe` evidence | Packaged Windows executable/installer launches without dev server, preload/IPC works, data resolves under `%LOCALAPPDATA%`, startup/fullscreen kiosk behavior is evidenced | Yes for packaged Windows runtime claim when named Windows booth PC is documented |
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
| V3-012 | Cloud/local Share/QR delivery, token expiry and fallback | required for URL/token/path/TTL helpers | required for cloud/local share/fallback mocks | required QR screen and expired-token page | Cloud PASS only with named phone + deployed Vercel/Neon/R2 retrieval; Local PASS only with named phone + reachable local network | QR evidence PASS/PARTIAL |
| V3-013 | Guest-confirmed durable FIFO print queue, backlog, stop-on-fail/manual recovery | required | required with fake printer + IPC contract | print status manual/Electron evidence | PASS only with named Canon SELPHY CP1000 via Windows 10 x64 booth PC Windows Print System | PARTIAL or PASS |
| V3-014 | Result timeout/reset with durable completing and print/share preservation | required | required | required | camera PASS only if real Canon stays connected | manual PASS/PARTIAL |
| Milestone 8A | Admin operations and maintenance minimum | preferred | required | required admin/manual evidence | Hardware PASS only for named tested devices | admin PASS/PARTIAL |
| Milestone 8B | Windows `.exe`, kiosk startup and packaged runtime | preferred | required packaged IPC/storage smoke | required packaged/kiosk/startup evidence | PASS only with named Windows booth PC/touchscreen as claimed | package/kiosk PASS/PARTIAL |
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
- QR appears from a tokenized cloud landing-page URL, configured local fallback URL or clear unavailable fallback.
- Guest-confirmed print creates a durable FIFO print job if printer is enabled.
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

### F5 — Cloud/local QR/share failure

Pass criteria:

- Cloud QR points to a tokenized Vercel landing page backed by Neon/R2 and does not expose local absolute paths, raw R2 keys or secrets.
- QR/share token expires 10 minutes after share/landing creation and expired access is denied safely.
- Local QR fallback, when configured, points to a tokenized local network URL, not `localhost` only.
- Local QR fallback does not expose a local absolute path.
- Local ShareService does not serve arbitrary files or directory listings.
- Cloud upload/retrieval or local network/phone retrieval failure is visible as QR unavailable/fallback.
- Local media remains preserved.
- Print can continue if available.
- 30-minute cleanup does not remove share/print recovery dependencies.

### F6 — Print failure

Pass criteria:

- Print requires guest confirmation under V1 `GUEST_CONFIRM` policy; no print job is created before guest confirmation.
- Duplicate print taps create only one intended durable print job.
- Confirmed print jobs are durable FIFO jobs and printer busy/slowness leaves later jobs queued.
- Failed print job does not block Result + QR/fallback screen.
- QR/fallback remains available.
- Any print job failure stops the queue, leaves later jobs queued, performs no automatic retry and requires Admin manual reprint/resume.
- No media is deleted.
- Cleanup does not delete queued, printing, failed or review-required print jobs/files.
- UI does not claim physical print completion merely because a command was dispatched.

### F7 — Cloud/local QR retrieval

Pass criteria:

- Final-share output exists before QR generation.
- Cloud QR points to a tokenized Vercel landing page with Neon token validation and R2 final-share retrieval.
- Cloud token expires after 10 minutes and expired access is denied safely.
- Local QR fallback, when configured, points to a tokenized local network URL reachable from a named phone on the same event network.
- QR does not use `localhost`-only URL for guest phone retrieval.
- QR does not expose local absolute path, raw R2 key or QR secrets in logs.
- Named phone retrieves final-share output successfully through the claimed cloud or local path.
- If cloud/network is unavailable or local mode is blocked by firewall/router/client isolation, Result screen shows explicit QR unavailable/fallback state.

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
- F5 Cloud/local QR/share failure: PASS | PARTIAL | FAIL
- F6 Print failure: PASS | PARTIAL | FAIL
- F7 Cloud/local QR retrieval: PASS | PARTIAL | FAIL
- F8 Readiness and maintenance: PASS | PARTIAL | FAIL
Hardware/network/runtime:
- Windows 10 x64 booth PC: PASS | PARTIAL | FAIL | Not tested
- Packaged Windows `.exe`: PASS | PARTIAL | FAIL | Not tested
- Canon EOS 6D: PASS | PARTIAL | FAIL | Not tested
- Printer / Canon SELPHY CP1000: PASS | PARTIAL | FAIL | Not tested
- Kiosk/touch: PASS | PARTIAL | FAIL | Not tested
- Cloud QR Vercel/Neon/R2 phone retrieval: PASS | PARTIAL | FAIL | Not tested
- Local QR fallback phone/network: PASS | PARTIAL | FAIL | Not tested
Remaining risks:
```
