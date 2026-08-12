# MomentAI CameraOS — V1 Refactor Brief
## Windows Mini PC + Electron + React + Canon EOS 6D + Canon SELPHY CP1000

**Status:** Final V1 Architecture  
**Target OS:** Windows 11  
**Desktop shell:** Electron  
**UI:** React + TypeScript  
**Camera:** Canon EOS 6D via USB + Canon EDSDK  
**Printer:** Canon SELPHY CP1000 via USB + Windows Print System  
**Display:** Touchscreen 15.6–17"  
**Storage:** Local filesystem + SQLite  
**Core principles:** offline-first, wired-first, hardware abstraction, kiosk-first

---

# 1. Mục tiêu refactor

MomentAI CameraOS V1 sẽ trở thành một **desktop kiosk application** chạy trên Mini PC Windows.

Các mục tiêu bắt buộc:

- Không phụ thuộc Mac hoặc iPad.
- Không phụ thuộc Wi-Fi để chụp hoặc in.
- Canon EOS 6D kết nối bằng USB.
- CP1000 kết nối bằng USB.
- Touch display kết nối bằng HDMI/DP + USB touch.
- Guest chỉ nhìn thấy MomentAI fullscreen.
- React không gọi hardware trực tiếp.
- Camera và printer đi qua service + adapter.
- Mất Internet vẫn Capture → Compose → Print được.
- Cloud/QR chỉ là extension.


# 2. Hardware Architecture

```text
                         GUEST
                           │
                           ▼
                    TOUCH DISPLAY
                    HDMI + USB Touch
                           │
                           ▼
┌───────────────┐ USB ┌─────────────────────────┐ USB ┌──────────────────┐
│ CANON EOS 6D  │────▶│ WINDOWS MINI PC         │────▶│ CANON CP1000     │
└───────────────┘     │                         │     └──────────────────┘
                      │ MomentAI CameraOS       │
                      │ Electron + React        │
                      │ Camera Service          │
                      │ Composition Engine      │
                      │ Print Service           │
                      │ Local Storage           │
                      └───────────┬─────────────┘
                                  │ optional
                                  ▼
                             Wi-Fi / LAN
                                  │
                                  ▼
                             QR / Cloud
```

Critical path không cần Internet:

```text
Touch → Capture → Compose → Print
```


# 3. Hardware bắt buộc

| Thiết bị | Vai trò | Kết nối |
|---|---|---|
| Canon EOS 6D | Camera chính | USB |
| Lens EF | Góc chụp | Camera |
| Dummy battery | Nguồn camera liên tục | AC |
| Windows Mini PC | Chạy CameraOS | Trung tâm |
| Touch display | Guest UI | HDMI/DP + USB touch |
| Canon SELPHY CP1000 | In ảnh | USB |
| SSD | Session storage | Internal |
| USB cable / powered hub | Kết nối thiết bị | USB |
| Router | QR/cloud optional | Wi-Fi/LAN |

Mini PC target:

```text
CPU: Intel Core i5 Gen 8+
RAM: 16 GB recommended
SSD: 512 GB recommended
OS: Windows 11
GPU: không cần GPU rời
Ports: USB 3.x, HDMI/DP, Ethernet
```


# 4. Guest Flow chính thức

```text
START / SHOWCASE
        ↓
SELECT SHOT FORMAT
        ├── 1 Shot
        ├── 2 Shots
        ├── 4 Shots
        └── 6 Shots
        ↓
CONTINUE
        ↓
LIVE VIEW / AUTO CAPTURE
        ↓
CAPTURE ĐỦ SHOTS
        ↓
SELECT TEMPLATE
        ↓
CUSTOMIZE
        ├── Typing nếu allowTyping=true
        └── Drawing nếu allowDraw=true
        ↓
FINAL COMPOSITION
        ↓
RESULT
        ├── Final image
        ├── QR
        └── Auto Print
        ↓
DONE hoặc TIMEOUT 120s
        ↓
RESET SESSION
        ↓
START
```

Guest không có các bước riêng:
- Select Layout
- Select Paper
- Select Printer
- Select Photo Order


# 5. Shot Format Domain

```ts
type CaptureFormat = {
  id: "format_1shot" | "format_2shot" | "format_4shot" | "format_6shot";
  shotCount: 1 | 2 | 4 | 6;
  slotCount: 1 | 2 | 4 | 6;
  layoutType: "single" | "vertical_2" | "vertical_4" | "2col_3row";
};
```

Mapping:

```text
1 Shot → 1 ảnh lớn
2 Shots → 2 ảnh xếp dọc
4 Shots → 4 ảnh xếp dọc
6 Shots → 2 cột × 3 hàng
```

Rule mặc định:

```text
shotIndex = slotIndex
```


# 6. Application Architecture

```text
┌──────────────────────────────────────┐
│ React Renderer                       │
│ Start / Shot / Capture               │
│ Template / Customize / Result        │
└──────────────────┬───────────────────┘
                   │
              Preload API
                   │
                   ▼
┌──────────────────────────────────────┐
│ Electron Main                        │
│ SessionController                    │
│ CaptureManager                       │
│ CameraService                        │
│ TemplateService                      │
│ CompositionEngine                    │
│ PrintService                         │
│ StorageService                       │
│ DeviceHealthService                  │
└───────────┬─────────────────┬────────┘
            │                 │
            ▼                 ▼
      CameraAdapter       PrinterAdapter
            │                 │
            ▼                 ▼
 CanonEdsdkAdapter      WindowsPrintAdapter
            │                 │
            ▼                 ▼
       Canon EOS 6D       Canon CP1000
```

Nguyên tắc:

```text
UI IMPLEMENTS EXPERIENCE
CORE IMPLEMENTS BUSINESS
ADAPTER IMPLEMENTS HARDWARE
```


# 7. Repo Structure đề xuất

```text
momentai-cameraos/

apps/
└── desktop/
    ├── electron/
    │   ├── main/
    │   │   ├── bootstrap/
    │   │   ├── ipc/
    │   │   ├── camera/
    │   │   ├── printer/
    │   │   ├── storage/
    │   │   ├── composition/
    │   │   └── health/
    │   └── preload/
    │
    └── renderer/
        ├── screens/
        ├── components/
        ├── hooks/
        ├── state/
        └── styles/

packages/
├── core/
├── session-engine/
├── shot-engine/
├── event-schema/
├── template-engine/
├── camera-contract/
├── printer-contract/
├── storage-contract/
├── shared-types/
├── validation/
├── design-tokens/
└── test-fixtures/

docs/
└── architecture/
```


# 8. Shared Contracts

## Camera

```ts
interface CameraAdapter {
  initialize(): Promise<void>;
  getStatus(): Promise<CameraStatus>;
  startLiveView(): Promise<void>;
  stopLiveView(): Promise<void>;
  capture(context: CaptureContext): Promise<CapturedPhoto>;
  dispose(): Promise<void>;
}
```

## Printer

```ts
interface PrinterAdapter {
  initialize(): Promise<void>;
  getPrinters(): Promise<PrinterInfo[]>;
  getCapabilities(printerId: string): Promise<PrinterCapabilities>;
  print(job: PrintJob): Promise<PrintResult>;
  getStatus(printerId: string): Promise<PrinterStatus>;
}
```

## Storage

```ts
interface StorageAdapter {
  createSession(sessionId: string): Promise<void>;
  saveOriginal(sessionId: string, photo: BinaryImage): Promise<StoredFile>;
  saveOutput(sessionId: string, file: BinaryImage, type: OutputType): Promise<StoredFile>;
  writeSession(session: Session): Promise<void>;
}
```


# 9. Electron Security Boundary

Renderer không được gọi trực tiếp:
- `fs`
- `child_process`
- Canon SDK
- printer driver
- Windows shell

Expose API qua preload:

```ts
window.momentai.session.create();
window.momentai.camera.status();
window.momentai.camera.startLiveView();
window.momentai.camera.capture();
window.momentai.printer.status();
window.momentai.printer.print();
```

Flow:

```text
React → Preload → IPC → Electron Main → Service → Adapter → Hardware
```


# 10. Camera Providers

V1:

```text
device
canon_edsdk
```

Development:

```json
{
  "cameraProvider": "device"
}
```

Production:

```json
{
  "cameraProvider": "canon_edsdk"
}
```

`DeviceCameraAdapter` dùng webcam để test full Guest Flow trước khi tích hợp Canon.


# 11. Canon EOS 6D Boot Flow

```text
Windows boot
 ↓
MomentAI auto-start
 ↓
Electron Main
 ↓
CameraService.initialize()
 ↓
CanonEdsdkAdapter.initialize()
 ↓
EDSDK initialize
 ↓
Enumerate cameras
 ↓
EOS 6D found?
   ├── NO → CAMERA_ERROR
   └── YES
        ↓
     Open session
        ↓
     Register events
        ↓
     Configure host save
        ↓
     Start Live View
        ↓
       READY
```


# 12. Canon Capture Flow

```text
Guest selected 4 Shots
        ↓
CaptureManager
        ↓
Shot #1
        ↓
Countdown 3 → 2 → 1
        ↓
CameraService.capture()
        ↓
CanonEdsdkAdapter
        ↓
EDSDK shutter command
        ↓
Canon EOS 6D
        ↓
JPEG generated
        ↓
EDSDK object event
        ↓
Download JPEG
        ↓
Validate JPEG
        ↓
StorageService
        ↓
Photo Pool
        ↓
Shot #2 ...
```

Critical rule:

```text
shotComplete = true
```

chỉ khi:

```text
JPEG downloaded
AND JPEG valid
AND file persisted
```


# 13. Camera Lifecycle

Camera connection thuộc application lifetime, không thuộc Guest Session.

```text
App boot
 ↓
Connect Canon
 ↓
READY

Guest A
 ↓
Reset Guest

Guest B
 ↓
Reset Guest

Guest C
 ↓
...

App shutdown
 ↓
Close Canon session
```

Reset Guest **không disconnect camera**.


# 14. Session Model

```ts
interface Session {
  id: string;
  eventId: string;
  state: SessionState;
  captureFormat?: CaptureFormat;
  photos: CapturedPhoto[];
  selectedTemplateId?: string;
  slotAssignments: SlotAssignment[];
  customization: {
    text: CustomText[];
    drawing: DrawingData[];
  };
  outputs?: {
    master: string;
    share: string;
    print: string;
  };
  qr?: QRResult;
  printJob?: PrintJob;
}
```

State machine:

```text
IDLE
 ↓
SELECTING_FORMAT
 ↓
READY_TO_CAPTURE
 ↓
CAPTURING
 ↓
SELECTING_TEMPLATE
 ↓
CUSTOMIZING
 ↓
COMPOSING
 ↓
RESULT
 ↓
COMPLETED
 ↓
IDLE
```


# 15. Template Schema

```ts
interface FrameTemplate {
  id: string;
  eventId: string;
  captureFormatId: CaptureFormat["id"];

  canvas: {
    width: number;
    height: number;
  };

  slots: TemplateSlot[];

  assets: {
    background?: string;
    overlay?: string;
    logo?: string;
  };

  customization: {
    allowTyping: boolean;
    allowDraw: boolean;
    textRegions?: TextRegion[];
  };

  printProfile: PrintProfile;

  status: "draft" | "published" | "archived";
}
```

Template query:

```text
eventId = currentEvent
AND captureFormatId = selectedFormat
AND status = published
```


# 16. Template Preview và Customization

Khi chọn template:

```text
Photo Pool
+
Template
+
Shot → Slot Mapping
      ↓
PreviewRenderer
      ↓
Live Preview
```

Nếu:

```text
allowTyping=false
allowDraw=false
```

thì:

```text
Select Template → Final Composition
```

Nếu có customization:

```text
Template → Text/Draw → Final Composition
```


# 17. Composition Engine

Input:

```text
Original Photos
+
Template
+
Slot Assignments
+
Text
+
Drawing
```

Pipeline:

```text
Load original
 ↓
Read EXIF
 ↓
Auto rotate
 ↓
Crop
 ↓
Resize
 ↓
Place in slot
 ↓
Background
 ↓
Overlay
 ↓
Branding
 ↓
Text
 ↓
Drawing
 ↓
Output
```

Outputs:

```text
final-master.png
final-share.jpg
final-print.jpg
```


# 18. Printer Architecture

CP1000 chỉ nhận ảnh cuối đã render.

```text
MomentAI
 ↓
final-print.jpg
 ↓
PrintService
 ↓
WindowsPrintAdapter
 ↓
Windows Print Queue
 ↓ USB
Canon CP1000
```

CP1000 không cần biết:
- shot count
- template
- event
- layout

MomentAI xử lý tất cả trước khi print.


# 19. Print Profile và Copies

Template quyết định paper/profile:

```ts
interface PrintProfile {
  paperId: "4x6";
  widthPx: number;
  heightPx: number;
  dpi: number;
  orientation: "portrait" | "landscape";
  borderless: boolean;
}
```

Event quyết định copies:

```json
{
  "printing": {
    "enabled": true,
    "autoPrint": true,
    "copies": 2
  }
}
```

Flow:

```text
Template → paper=4x6
Event → copies=2
Composition → final-print.jpg
PrintService → PrintJob
WindowsPrintAdapter → CP1000
```


# 20. PrintJob

```ts
interface PrintJob {
  id: string;
  sessionId: string;
  printerId: string;
  imagePath: string;
  paperId: string;
  copies: number;
  orientation: "portrait" | "landscape";
  borderless: boolean;
  status: "queued" | "validating" | "printing" | "completed" | "failed";
}
```

Printer boot:

```text
PrintService.initialize()
 ↓
Enumerate Windows printers
 ↓
Find configured CP1000
 ↓
Read capabilities
 ↓
READY / WARNING
```

Trước in:

```text
Template requires 4x6
 ↓
Printer supports 4x6?
 ├── YES → print
 └── NO → operator error
```


# 21. Result Screen

```text
┌──────────────────────────────────┐
│         ẢNH CỦA BẠN             │
│                                  │
│   FINAL PHOTO       QR CODE      │
│                                  │
│       Đang in ảnh...             │
│                                  │
│          01:42                   │
│                                  │
│      [ HOÀN THÀNH ]              │
└──────────────────────────────────┘
```

Composition complete trigger song song:

```text
Share output → QR
Print output → Print Queue
```

Không đợi printer hoàn tất mới show Result.


# 22. Timeout / Reset

Result timeout:

```text
120 seconds
```

DONE hoặc timeout:

```text
Complete Session
 ↓
Persist metadata
 ↓
Clear Guest state
 ↓
Return Start
```

Không clear:
- Camera connection
- Printer connection
- Current Event
- Template cache
- Hardware config

Print job đang chạy vẫn tiếp tục.


# 23. Offline-first

Không cần Internet cho:
- Capture
- Template
- Customize
- Compose
- Print
- Local storage
- Session reset

Internet chỉ optional cho:
- Cloud gallery
- QR cloud
- Event sync
- Template sync
- Analytics
- Remote monitoring


# 24. Storage

```text
MomentAIData/

events/
templates/
sessions/
logs/
database/
```

Session:

```text
sessions/
YYYY-MM-DD/
sess_xxx/
├── session.json
├── originals/
├── preview/
├── customization/
└── output/
    ├── final-master.png
    ├── final-share.jpg
    └── final-print.jpg
```

SQLite dùng cho metadata/index.


# 25. Logging và Error

Structured events:
- app.boot
- camera.connected
- camera.disconnected
- printer.connected
- printer.disconnected
- session.created
- capture.started
- capture.completed
- capture.failed
- template.selected
- composition.completed
- print.queued
- print.completed
- print.failed
- session.completed

Error model:

```ts
interface MomentAIError {
  code: string;
  domain: "camera" | "printer" | "storage" | "composition" | "network";
  severity: "warning" | "blocking";
  technicalMessage: string;
  guestMessage: string;
  recoverable: boolean;
}
```


# 26. Kiosk Mode

```text
Windows boot
 ↓
MomentAI auto-start
 ↓
Electron fullscreen
 ↓
Kiosk mode
 ↓
Start Screen
```

Guest không thấy:
- Desktop
- Taskbar
- Terminal
- DevTools
- Windows dialogs

Operator dùng hidden shortcut/admin gesture.


# 27. Development Mode

Không cần hardware thật:

```text
CAMERA_PROVIDER=device
PRINTER_PROVIDER=fake
```

Nên có:
- FakeCameraAdapter
- FakePrinterAdapter
- FakeStorageAdapter

để CI và dev chạy được.


# 28. Testing

## Unit
- ShotFormat
- Session transitions
- Template filtering
- Shot → Slot mapping
- PrintJob creation
- Paper validation
- Timeout

## Contract
CameraAdapter:
- initialize
- status
- live view
- capture
- dispose

PrinterAdapter:
- initialize
- capabilities
- print
- status

## E2E
```text
Start
→ 4 Shots
→ Capture
→ Template
→ Compose
→ Print Queue
→ Result
→ Reset
```


# 29. Refactor Strategy

Không big-bang rewrite.

```text
Current Project
 ↓
Audit
 ↓
Extract Domain
 ↓
Extract Contracts
 ↓
Electron Main/Preload Boundary
 ↓
Device Camera
 ↓
Composition
 ↓
Printer Adapter
 ↓
Canon EDSDK
 ↓
CP1000
 ↓
Production Hardening
```

### Phase 0 — Audit
Phân loại code thành:
- UI
- Business
- Camera
- Printer
- Storage
- Template
- Composition
- Cloud
- Admin
- Utilities

Tag:
- KEEP
- MOVE
- REWRITE
- DELETE

### Phase 1 — Domain
Tạo:
- shared-types
- session-engine
- shot-engine
- template-engine

### Phase 2 — Electron boundary
Tách:
- renderer
- preload
- main

### Phase 3 — Device Camera
Hoàn thiện full flow bằng webcam.

### Phase 4 — Composition
Hoàn thiện Photo Pool → Template → Final output.

### Phase 5 — Printer abstraction
Tạo PrinterAdapter + FakePrinter.

### Phase 6 — Windows printing
Implement WindowsPrintAdapter.

### Phase 7 — Canon EOS 6D
Implement CanonEdsdkAdapter.

### Phase 8 — CP1000
Test driver, queue, 4x6, copies, borderless, auto print.

### Phase 9 — Hardening
Auto-start, kiosk, reconnect, crash recovery, logs, storage cleanup.


# 30. Suggested PR Sequence

```text
PR01 Monorepo / folder cleanup
PR02 Shared types
PR03 Session engine
PR04 Shot formats
PR05 Template schema
PR06 Electron preload/main boundary
PR07 Camera contract
PR08 FakeCamera + webcam
PR09 Composition engine
PR10 Printer contract + FakePrinter
PR11 Windows Print adapter
PR12 Canon EDSDK adapter
PR13 CP1000 integration
PR14 Kiosk / startup
PR15 Recovery / logging
PR16 Production QA
```


# 31. Definition of Done V1

- [ ] Windows Electron app
- [ ] React Guest UI
- [ ] Fullscreen kiosk
- [ ] Auto-start
- [ ] Canon EOS 6D detected
- [ ] Canon Live View
- [ ] Auto capture 1/2/4/6
- [ ] JPEG download + validation
- [ ] Local session storage
- [ ] Event template filtering
- [ ] Template live preview
- [ ] Typing
- [ ] Drawing
- [ ] Final composition
- [ ] Master/share/print outputs
- [ ] CP1000 detected
- [ ] 4x6 PrintProfile
- [ ] Copies from Event config
- [ ] Auto Print
- [ ] Print Queue
- [ ] QR
- [ ] Result screen
- [ ] 120-second timeout
- [ ] Reset without camera disconnect
- [ ] Camera reconnect
- [ ] Printer recovery
- [ ] Offline capture/print
- [ ] Structured logs
- [ ] Fake adapters for CI


# 32. Scope bị loại khỏi V1

Không build trong V1:
- iPad app
- React Native
- macOS runtime
- AirPrint
- CCAPI
- Android
- Linux
- DNP integration
- multi-booth cloud orchestration
- payment
- AI background removal
- gesture control

Chỉ xem xét sau khi wired booth V1 chạy production ổn định.


# 33. Final Architecture

```text
                    MOMENTAI CAMERAOS V1

                           GUEST
                             │
                             ▼
                      TOUCH DISPLAY
                             │
                             ▼
                       REACT UI
                             │
                      PRELOAD / IPC
                             │
                             ▼
                      ELECTRON MAIN
                             │
             ┌───────────────┼────────────────┐
             │               │                │
             ▼               ▼                ▼
      SessionEngine    CompositionEngine   Storage
             │
             ▼
       CaptureManager
             │
             ▼
       CameraService
             │
             ▼
   CanonEdsdkAdapter
             │ USB
             ▼
        Canon EOS 6D

CompositionEngine
       │
       ├── final-share.jpg → QR
       │
       └── final-print.jpg
                    │
                    ▼
              PrintService
                    │
                    ▼
          WindowsPrintAdapter
                    │ USB
                    ▼
            Canon CP1000
```

Nguyên tắc cuối:

```text
CAMERA không biết TEMPLATE
TEMPLATE không biết CANON
SESSION không biết CP1000
REACT UI không điều khiển HARDWARE trực tiếp
CAPTURE / COMPOSE / PRINT phải chạy được KHÔNG INTERNET
```

Đây là kiến trúc chính thức để refactor MomentAI CameraOS V1.
