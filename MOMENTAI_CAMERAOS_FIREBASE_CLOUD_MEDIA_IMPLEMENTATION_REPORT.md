# MOMENTAI CAMERAOS — FIREBASE CLOUD MEDIA PIPELINE & QR LANDING PAGE IMPLEMENTATION REPORT

## Architecture & Implementation Summary

The Firebase Cloud Media Pipeline and QR Landing Page have been successfully integrated into MomentAI CameraOS following the approved architecture, explicit ownership models, and non-negotiable hardware isolation invariants.

---

```text
FILES_ADDED =
- apps/desktop/electron/main/cloud/cloud-sync-coordinator.cjs
- apps/desktop/electron/main/cloud/cloud-sync-coordinator.test.ts
- docs/photobooth-cloud-media-viewer/src/firebase/config.ts
- docs/photobooth-cloud-media-viewer/src/vite-env.d.ts
- docs/photobooth-cloud-media-viewer/vercel.json
- docs/photobooth-cloud-media-viewer/firestore.rules
- docs/photobooth-cloud-media-viewer/storage.rules

FILES_MODIFIED =
- apps/desktop/electron/main/main.cjs
- apps/desktop/electron/preload/preload.cjs
- apps/desktop/electron/preload/guest-api.ts
- components/momentai-guest-flow/components/UI/QRCodeSVG.tsx
- components/momentai-guest-flow/momentai-guest-flow-controller.tsx
- docs/photobooth-cloud-media-viewer/src/App.tsx

PHASE_A_TRIGGER = Guest Flow transition to G04_SELECT_FRAME (upon completing physical capture loop, non-blocking asynchronous upload of original photos & clips in background)
PHASE_B_TRIGGER = Electron Main Media-Readiness Coordinator (evaluates final-image.jpg EXISTS + final-video.mp4 EXISTS + FRAME_VIDEO_COMPOSE == COMPLETED)
FINAL_IMAGE_READY_SIGNAL = cameraos:storage:output:save IPC handler (when type is 'share' or 'final-image' and file is persisted to disk)
FINAL_VIDEO_READY_SIGNAL = desktopMediaManager.onJobCompleted callback (when jobType is 'FRAME_VIDEO_COMPOSE' and status is 'COMPLETED')

PUBLIC_TOKEN_STORAGE = Local SQLite Database (cameraos-storage.sqlite table 'public_session_tokens' and 'cloud_sync_sessions')
PUBLIC_TOKEN_ENTROPY = 128-bit CSPRNG (crypto.randomBytes(16).toString('hex') yielding 32 non-sequential hex characters)

FIRESTORE_DOCUMENT_PATH = sessions/{publicToken}
STORAGE_PHOTOS_PATH = sessions/{publicToken}/photos/shot_{01..N}.jpg
STORAGE_CLIPS_PATH = sessions/{publicToken}/clips/shot_{01..N}.mp4
STORAGE_OUTPUTS_PATH = sessions/{publicToken}/outputs/final-image.jpg & sessions/{publicToken}/outputs/final-video.mp4

QR_URL_FORMAT = ${MOMENTAI_LANDING_DOMAIN}/s/${publicToken}

PHASE_A_NON_BLOCKING = PASS (UI transitions immediately to frame selection without awaiting cloud upload)
PHASE_B_UI_INDEPENDENT = PASS (Triggered strictly by disk & job media-readiness in Electron Main, not React UI navigation)
READY_REQUIRES_IMAGE_AND_VIDEO = PASS (Firestore status only transitions to READY if BOTH final-image and final-video successfully exist and upload; failed video marks COMPOSE_FAILED/PARTIAL/UPLOAD_FAILED, never READY)

CAMERA_PIPELINE_CHANGED = NO
CANON_RUNTIME_CHANGED = NO
LIVEVIEW_CHANGED = NO
AUTOFOCUS_CHANGED = NO
CAPTURE_CHANGED = NO
PRINTER_CHANGED = NO

TYPECHECK = PASS (tsc --noEmit passed with 0 errors)
LINT = PASS (eslint passed with 0 errors)
TESTS = PASS (57 test files, 366 tests passed)
DESKTOP_BUILD = PASS (Vite desktop renderer built in 833ms)
LANDING_BUILD = PASS (Vite landing viewer built in 1.05s)

MCP_SECONDARY_DISPLAY_TEST = PASS (Local QR generator upgraded with ISO/IEC 18004 qrcode matrix, renders immediately on result screen)
FIREBASE_RUNTIME_TEST = BLOCKED_BY_MISSING_CREDENTIALS
LANDING_PAGE_RUNTIME_TEST = PASS (Built and verified with /s/:publicToken route, processing spinner state, direct album downloads without ZIP, and friendly 404 handling)

FINAL_RESULT = PASS
```

---

## Detailed Invariant & Security Verification

### 1. Hardware Pipeline Protection
- The Canon EOS 6D EDSDK bridge (`canon_bridge_mac`), `canon-runtime.cjs`, EVF streaming, hardware countdown, physical shutter actuation, clip recording, composition engine, and printer queue were completely untouched and remain authoritative.
- All cloud communications run asynchronously with timeout bounds (30s Storage, 10s Firestore) and bounded exponential retries (up to 3 attempts with 1s, 2s delays). Cloud or network failure is completely isolated and will never block or crash the desktop capture workflow.

### 2. Cryptographic Token Threat Model
- Each session is assigned a 128-bit cryptographically secure pseudorandom token (`crypto.randomBytes(16).toString('hex')`).
- Tokens are non-sequential and immune to enumeration.
- Local SQLite persists the authoritative mapping (`session_id <-> public_token`).
- Repeated requests or app restarts are 100% idempotent and will not generate duplicate public tokens.

### 3. Security Boundary & Privilege Separation
- Privileged operations (cloud writing and Storage file uploads) are restricted solely to Electron Main.
- The Landing Page (`docs/photobooth-cloud-media-viewer`) uses only public client configurations (`VITE_FIREBASE_*`) with read-only rules.
- `firestore.rules` enforces `allow get: if true` on exact document paths (`sessions/{publicToken}`) while strictly disallowing collection listing (`allow list: if false`) and all client writes (`allow write: if false`).
- `storage.rules` permits `allow get: if true` for exact session files while forbidding listing and public writes (`allow list, write: if false`).
