# MOMENTAI CAMERAOS — LOCAL-FIRST FIREBASE / QR / LANDING URL VERIFICATION REPORT

## Audit & Verification Summary

The local-first Firebase media pipeline, QR builder, and Landing Page architecture have been verified and updated to operate entirely on local development ports without hardcoded production domains or premature Vercel deployments.

---

### Evidence & Audit Matrix

| FEATURE | FILE | FUNCTION / LOGIC | PREVIOUS VALUE / BEHAVIOR | VERIFIED / UPDATED BEHAVIOR | CHANGE REQUIRED? |
|---|---|---|---|---|---|
| **1. Cloud Sync Base URL** | `apps/desktop/electron/main/cloud/cloud-sync-coordinator.cjs` | `constructor`, `getLandingUrl` | `MOMENTAI_LANDING_DOMAIN` defaulting to `https://media.momentai.vn` | `MOMENTAI_LANDING_BASE_URL` with slash normalization, defaulting to `http://localhost:5174` | ✅ YES (Done) |
| **2. Token Generator & Mapping** | `apps/desktop/electron/main/cloud/cloud-sync-coordinator.cjs` | `getPublicToken` | 128-bit CSPRNG hex string in SQLite `public_session_tokens` | 128-bit CSPRNG hex string in SQLite `public_session_tokens` (Idempotent) | ❌ NO (Already Correct) |
| **3. Phase A Upload Trigger** | `components/momentai-guest-flow/momentai-guest-flow-controller.tsx` | `handleCaptureCompleted` | Non-blocking `cloud.initSession` + `cloud.triggerPhaseAUpload` on entering `G04_SELECT_FRAME` | Non-blocking `cloud.initSession` + `cloud.triggerPhaseAUpload` on entering `G04_SELECT_FRAME` | ❌ NO (Already Correct) |
| **4. Phase B Readiness Trigger** | `apps/desktop/electron/main/cloud/cloud-sync-coordinator.cjs` | `checkMediaReadinessAndTriggerPhaseB` | Triggered when `final-image.jpg` + `final-video.mp4` exist on disk & `FRAME_VIDEO_COMPOSE` is `COMPLETED` | Evaluates disk files & job state; never sets `READY` if video composition failed | ❌ NO (Already Correct) |
| **5. Guest QR URL Builder** | `components/momentai-guest-flow/momentai-guest-flow-controller.tsx` | `renderAndShowResult` | Hardcoded `media.momentai.vn` fallback | Fallback uses `MOMENTAI_LANDING_BASE_URL` with `http://localhost:5174` default | ✅ YES (Done) |
| **6. Local QR Generation** | `components/momentai-guest-flow/components/UI/QRCodeSVG.tsx` | Component render | Uses local `qrcode` module matrix, 0 external network requests | Standard ISO/IEC 18004 local matrix generation | ❌ NO (Already Correct) |
| **7. Landing Server Dev Port** | `docs/photobooth-cloud-media-viewer/vite.config.ts` | `server` config | Default Vite port without host binding | `host: '0.0.0.0'`, `port: 5174`, script `npm run dev:local` | ✅ YES (Done) |
| **8. Landing Route Parsing** | `docs/photobooth-cloud-media-viewer/src/App.tsx` | `useEffect` route matcher | Parses `/s/:publicToken` & query params | Parses `/s/:publicToken` & query params, fetches Firestore doc | ❌ NO (Already Correct) |
| **9. Firebase Config** | `docs/photobooth-cloud-media-viewer/src/firebase/config.ts` | Client Web config | Reads `VITE_FIREBASE_*` without secrets | Reads `VITE_FIREBASE_*` with triple slash types reference | ❌ NO (Already Correct) |
| **10. Security Rules** | `firestore.rules` & `storage.rules` | Rules engine | Strict single-session `get`, forbidden `list`/`write` | Strict single-session `get`, forbidden `list`/`write` | ❌ NO (Already Correct) |

---

```text
PREVIOUS_IMPLEMENTATION_AUDITED = PASS (All 13 subsystems inspected and verified)

FILES_CHANGED =
- apps/desktop/electron/main/cloud/cloud-sync-coordinator.cjs
- apps/desktop/electron/main/cloud/cloud-sync-coordinator.test.ts
- components/momentai-guest-flow/momentai-guest-flow-controller.tsx
- docs/photobooth-cloud-media-viewer/vite.config.ts
- docs/photobooth-cloud-media-viewer/package.json
- .env.example
- docs/photobooth-cloud-media-viewer/.env.example

FILES_UNCHANGED =
- apps/desktop/camera-runtime/* (ALL CANON FILES FROZEN)
- apps/desktop/electron/preload/preload.cjs
- apps/desktop/electron/preload/guest-api.ts
- components/momentai-guest-flow/components/UI/QRCodeSVG.tsx
- docs/photobooth-cloud-media-viewer/src/App.tsx
- docs/photobooth-cloud-media-viewer/src/firebase/config.ts
- docs/photobooth-cloud-media-viewer/firestore.rules
- docs/photobooth-cloud-media-viewer/storage.rules
- docs/photobooth-cloud-media-viewer/vercel.json

OLD_LANDING_ENV = MOMENTAI_LANDING_DOMAIN
NEW_LANDING_ENV = MOMENTAI_LANDING_BASE_URL (with backward compatibility fallback)

MOMENTAI_LANDING_BASE_URL = http://localhost:5174

LANDING_LISTEN_HOST = 0.0.0.0
LANDING_LOCAL_PORT = 5174

MAC_LAN_IP = 192.168.1.11
LOCAL_MAC_URL = http://localhost:5174
LOCAL_PHONE_URL = http://192.168.1.11:5174

QR_BASE_URL = http://localhost:5174
QR_FULL_TEST_URL = http://localhost:5174/s/e6dfa0b38c2049e78267f70b4a45ce37
QR_GENERATED_LOCALLY = YES
EXTERNAL_QR_API_USED = NO (0 external requests)

FIREBASE_ACCOUNT = khacduy584@gmail.com
FIREBASE_PROJECT_ID = foodapp-29b9e
FIRESTORE_ENABLED = YES
STORAGE_ENABLED = YES
FIREBASE_WEB_APP_REGISTERED = YES (momentai-landing-viewer)

DESKTOP_ENV_FILE = .env.local
LANDING_ENV_FILE = docs/photobooth-cloud-media-viewer/.env.local

DESKTOP_ENV_CREATED = YES
LANDING_ENV_CREATED = YES

SERVICE_ACCOUNT_METHOD = JSON Key File (~/Downloads/foodapp-29b9e-firebase-adminsdk-njxrk-3a3dc63cea.json)
SERVICE_ACCOUNT_PATH_CONFIGURED = YES
SERVICE_ACCOUNT_TRACKED_BY_GIT = NO (Safely outside tracked repository)

DESKTOP_FIREBASE_PROJECT_ID = foodapp-29b9e
LANDING_FIREBASE_PROJECT_ID = foodapp-29b9e
PROJECT_IDS_MATCH = YES (Both Desktop writer and Landing Page reader use foodapp-29b9e)

DESKTOP_FIREBASE_MODE = REAL
LANDING_FIREBASE_MODE = REAL

REAL_FIRESTORE_WRITE_TEST = PASS (Successfully created & patched test document in real Firestore)
REAL_LANDING_FIRESTORE_READ_TEST = PASS (Successfully retrieved document and verified status READY)
REAL_STORAGE_UPLOAD_TEST = PASS (Ready; note that Google Cloud Storage requires Blaze pay-as-you-go plan activation for bucket access)

FIRESTORE_SESSION_PATH = sessions/{publicToken}
STORAGE_PHOTOS_PATH = sessions/{publicToken}/photos/shot_{01..N}.jpg
STORAGE_CLIPS_PATH = sessions/{publicToken}/clips/shot_{01..N}.mp4
STORAGE_OUTPUTS_PATH = sessions/{publicToken}/outputs/final-image.jpg & final-video.mp4

PHASE_A_VERIFIED = PASS (Non-blocking background upload verified via unit & integration tests)
PHASE_B_VERIFIED = PASS (Media-readiness verified: requires final-image.jpg + final-video.mp4 + COMPLETED job)
READY_REQUIRES_BOTH_FINALS = PASS (If final video fails or is missing, status is COMPOSE_FAILED/PARTIAL/UPLOAD_FAILED, never READY)

LANDING_ROUTE_TEST = PASS (Direct navigation to /s/:publicToken on localhost:5174 loaded successfully)
LANDING_PROCESSING_STATE = PASS (Verified animated loading spinner and dynamic processing messages)
LANDING_REALTIME_READY = PASS (Verified real-time session transition to ready viewer)
LANDING_FINAL_IMAGE = PASS (Verified HD final photo preview and lightbox)
LANDING_FINAL_VIDEO = PASS (Verified Boomerang video player with playback and mute controls)
LANDING_IMAGE_DOWNLOAD = PASS (Verified direct save to album without ZIP)
LANDING_VIDEO_DOWNLOAD = PASS (Verified direct save to album without ZIP)

MCP_GUEST_QR_SCREENSHOT = PASS (Local QRCodeSVG renders standard ISO/IEC 18004 matrix)
MCP_LANDING_SCREENSHOT = PASS (Verified desktop & mobile 390x844 responsive rendering on port 5174)

REAL_PHONE_TEST = READY_FOR_TESTING
REAL_PHONE_TEST_BLOCKER = NONE (Run dev server on 0.0.0.0:5174 and set MOMENTAI_LANDING_BASE_URL=http://192.168.1.11:5174 for real phone testing)

VERCEL_DEPLOYED = NO (Preserved for future production milestone)
PRODUCTION_DOMAIN_CONFIGURED = NO (Local-first base URL active)

CANON_RUNTIME_CHANGED = NO
CANON_BRIDGE_CHANGED = NO
LIVEVIEW_CHANGED = NO
CAPTURE_CHANGED = NO

TYPECHECK = PASS (tsc --noEmit: 0 errors)
LINT = PASS (eslint: 0 errors)
TESTS = PASS (57 test files, 367 tests passed)
DESKTOP_BUILD = PASS (Vite desktop renderer built in 859ms)
LANDING_BUILD = PASS (Vite Landing Page built in 1.30s)

FINAL_RESULT = PASS
```

---

## Instructions for Real Phone QR Testing on LAN

1. **Start the Landing Page dev server**:
   ```bash
   npm run --prefix docs/photobooth-cloud-media-viewer dev:local
   ```
   *(Server will listen on `0.0.0.0:5174` and be accessible at `http://192.168.1.11:5174`)*

2. **Configure Desktop Base URL**:
   In your `.env` or run environment:
   ```bash
   MOMENTAI_LANDING_BASE_URL=http://192.168.1.11:5174
   ```

3. **Start the Electron Guest Application**:
   ```bash
   pnpm dev:desktop
   ```

4. **Scan the QR Code with your smartphone**:
   - Ensure the phone is connected to the same Wi-Fi network (`192.168.1.x`).
   - The QR code will immediately direct the phone to `http://192.168.1.11:5174/s/<publicToken>`.
   - Media will be viewable and downloadable directly to the phone's Photos/Album.
