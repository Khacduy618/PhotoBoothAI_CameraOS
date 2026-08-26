# MOMENTAI CAMERAOS — CANON SELPHY CP1000 PRINT PIPELINE REPORT
## Product-Aware 5×15 Strip → 10×15 Sheet & 10×15 Full-Sheet Print Master

```text
ACTIVE_PRINT_CALL_GRAPH =
PrintQRScreen (User clicks "XÁC NHẬN IN ẢNH")
  → momentai-guest-flow-controller.tsx: handleConfirmPrint()
      → physical-print-plan.ts: resolvePhysicalPrintPlan({ product, requestedQuantity, isLandscape, sessionId })
      → api('request-print', { sessionId, copies: plan.sheets })
          → preload.cjs: window.momentai.guest.session.requestPrint(sessionId, copies)
              → ipcRenderer.invoke('cameraos:guest:print:request', sessionId, copies)
                  → main.cjs: ipcMain.handle('cameraos:guest:print:request')
                      → print-queue-manager.cjs: printQueue.enqueue(session, { copies, printMasterPath })
                          → SQLite table: print_jobs (durably saved with status 'QUEUED')
                          → printQueue.processNext() [Background worker]
                              → windows-printer-adapter.cjs: WindowsPrinterAdapter.print(jobRow)
                                  → Windows 10 x64 Spooler / Canon SELPHY CP1000 Driver (or MockPrinterAdapter on macOS dev)

Composition & Print Master Pipeline:
SelectProduct / PickPhotos / Customize
  → momentai-guest-flow-controller.tsx: renderAndShowResult()
      → compositionEngine.ts: renderComposition()
          → frame-compositor.service.ts: renderFrameComposition() [Authoritative digital composition]
              → outputs.share (final-image.jpg: 900x2700 / 1800x2700 / 2700x1800)
              → outputs.master (master.png)
          → print-master.service.ts: buildPrintMaster() [Authoritative CP1000 physical raster]
              → outputs.print (print-cp1000.jpg: 1181x1748 / 1748x1181 @ 300 DPI sRGB quality 0.95)
      → storage.saveOutput('share') → outputs/final-image.jpg
      → storage.saveOutput('master') → outputs/master.png
      → storage.saveOutput('print') → outputs/print-cp1000.jpg (copied to immutable outputs/print/print_<jobId>.jpg on enqueue)
```

---

### Core Pipeline Specifications

```text
CURRENT_PRINT_SOURCE = outputs/print-cp1000.jpg (with immutable job artifact outputs/print/print_<jobId>.jpg)
CURRENT_PAPER_ID = POSTCARD
CURRENT_COPIES_SEMANTICS = Physical sheet count (1 sheet for 2 strips, 2 sheets for 4 strips, 3 sheets for 6 strips; 1:1 for full sheets)

CP1000_PROFILE_ID = CANON_SELPHY_CP1000
MEDIA_WIDTH_MM = 100
MEDIA_HEIGHT_MM = 148
DPI = 300

PORTRAIT_PRINT_WIDTH_PX = 1181
PORTRAIT_PRINT_HEIGHT_PX = 1748

LANDSCAPE_PRINT_WIDTH_PX = 1748
LANDSCAPE_PRINT_HEIGHT_PX = 1181

DIGITAL_STRIP_SIZE = 900 × 2700 px
DIGITAL_FULL_SIZE = 1800 × 2700 px (portrait) / 2700 × 1800 px (landscape)

PRINT_MASTER_BUILDER_FILE = services/render/print-master.service.ts
PRINT_MASTER_BUILDER_FUNCTION = buildPrintMaster

STRIP_2_PHYSICAL_LAYOUT = Two identical 5×15 strips side-by-side on 1181×1748 sheet (Left: 590×1748 px, Right: 591×1748 px)
STRIP_4_PHYSICAL_LAYOUT = Two identical 5×15 strips side-by-side on 1181×1748 sheet (Left: 590×1748 px, Right: 591×1748 px)

REQUEST_2_STRIPS_SHEETS = 1
REQUEST_4_STRIPS_SHEETS = 2
REQUEST_6_STRIPS_SHEETS = 3

PREMIUM_1_COPY_SHEETS = 1
SHEET4_1_COPY_SHEETS = 1
SHEET6_1_COPY_SHEETS = 1

PRINT_MASTER_PATH_PATTERN = sessions/<sessionId>/outputs/print/print_<jobId>.jpg
PRINT_MASTER_MIME = image/jpeg
PRINT_MASTER_JPEG_QUALITY = 0.95
PRINT_MASTER_COLOR_SPACE = sRGB

MASTER_PNG_REQUIRED_FOR_PRINT = NO (buildPrintMaster renders high-quality physical raster directly from authoritative canvas composition)
FINAL_IMAGE_USED_DIRECTLY_FOR_PRINT = NO (final-image.jpg is preserved untouched for mobile downloads & cloud sync)

PRINT_QUEUE_SCHEMA_CHANGED = YES (Non-destructive backward-compatible migration adding printer_profile_id, orientation, width_px, height_px, content_hash)
PRINT_IDEMPOTENCY_STRATEGY = hash(sessionId + contentHash + copies + productType + printerProfileId)

CALIBRATION_SHEET_CREATED = YES (services/render/calibration-sheet.service.ts — 1181×1748 px with 5mm/10mm grid, split axis, safe-area insets, corner annotations)

MOCK_PRINT_TESTS = PASS (383/383 vitest unit and integration tests passing)
WINDOWS_PRINTER_ADAPTER = IMPLEMENTED (apps/desktop/electron/main/printer/windows-printer-adapter.cjs with unattended PowerShell spooler execution)
WINDOWS_CP1000_PHYSICAL_TEST = PENDING (Requires physical Windows 10 x64 machine connected to physical Canon SELPHY CP1000 dye-sub printer)

CAMERA_CORE_CHANGED = NO
LIVEVIEW_CHANGED = NO
MF_CHANGED = NO
CAPTURE_CHANGED = NO

TYPECHECK = PASS (tsc --noEmit: 0 errors)
LINT = PASS (eslint: 0 errors)
TESTS = PASS (58 test files, 383 passed)
DESKTOP_BUILD = PASS (vite build:dist generated cleanly)

FILES_CHANGED =
- packages/printer-contract/src/index.ts
- services/render/print-master.service.ts
- services/render/print-master.service.test.ts
- components/momentai-guest-flow/services/compositionEngine.ts
- components/momentai-guest-flow/momentai-guest-flow-controller.tsx
- apps/desktop/electron/main/storage/session-media-paths.cjs
- apps/desktop/electron/main/storage/local-filesystem-sqlite-storage-adapter.ts
- apps/desktop/electron/main/main.cjs
- apps/desktop/electron/main/storage/print-queue-lifecycle.test.ts
- vitest.config.mts

FILES_TO_CREATE =
- packages/printer-contract/src/printer-profile.ts
- services/printer/physical-print-plan.ts
- services/printer/physical-print-plan.test.ts
- services/render/calibration-sheet.service.ts
- apps/desktop/electron/main/printer/mock-printer-adapter.cjs
- apps/desktop/electron/main/printer/windows-printer-adapter.cjs
- apps/desktop/electron/main/printer/print-queue-manager.cjs
- MOMENTAI_CAMERAOS_CP1000_PRINT_PIPELINE_REPORT.md

FUNCTIONS_CHANGED =
- packages/printer-contract: added getPrinterProfile, CANON_CP1000_PROFILE, enriched PrintJob / PrintJobStatus with REQUIRES_REVIEW
- services/printer/physical-print-plan: created resolvePhysicalPrintPlan
- services/render/print-master: updated buildPrintMaster for CP1000 1181x1748 / 1748x1181 raster and 590/591 strip duplication
- services/render/calibration-sheet: created generateCalibrationSheet
- components/momentai-guest-flow/services/compositionEngine: renderComposition delegates print master generation to buildPrintMaster
- components/momentai-guest-flow/momentai-guest-flow-controller: saves 'print' output and maps strip units to physical sheets via resolvePhysicalPrintPlan
- apps/desktop/electron/main/storage/session-media-paths: added printMaster and printDir
- apps/desktop/electron/main/printer/print-queue-manager: extracted PrintQueueManager with SQLite non-destructive migration, REQUIRES_REVIEW recovery, and SHA-256 idempotency
- apps/desktop/electron/main/printer/windows-printer-adapter: created WindowsPrinterAdapter for unattended Windows spooling
- apps/desktop/electron/main/main.cjs: wired PrintQueueManager and print-cp1000.jpg storage/request handlers

FINAL_RESULT = PARTIAL (Software & simulation PASSED; physical Windows 10 x64 + CP1000 dye-sub hardware calibration pending)
```
