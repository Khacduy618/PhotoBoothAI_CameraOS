# MomentAI CameraOS — Refactor Brief
## Kiến trúc mới cho macOS (Electron) + iPadOS (React Native)

**Document type:** Engineering Refactor Brief  
**Status:** Proposed Source of Truth  
**Target platforms:** macOS, iPadOS  
**Desktop runtime:** Electron + React + TypeScript  
**iPad runtime:** React Native + TypeScript  
**Current DSLR target:** Canon EOS 6D (macOS only, via EDSDK)  
**Primary principle:** Shared business core, platform-specific hardware adapters

---

# 1. Mục tiêu refactor

Dự án cần chuyển từ kiến trúc Mac-centric:

```text
Photobooth App
    ↓
Mac
    ↓
Canon / Printer
```

sang:

```text
                    MOMENTAI CAMERAOS
                           │
                    SHARED DOMAIN CORE
                           │
               ┌───────────┴───────────┐
               │                       │
               ▼                       ▼
          macOS Runtime            iPadOS Runtime
          Electron + React         React Native
               │                       │
               ▼                       ▼
          macOS Adapters           iOS Adapters
```

Mục tiêu:
- Một Guest Flow thống nhất.
- Một Session Model thống nhất.
- Một Template Schema thống nhất.
- Một PrintJob Model thống nhất.
- Một bộ business rules thống nhất.
- macOS và iPadOS chỉ khác hardware adapter/runtime.
- UI không gọi hardware trực tiếp.
- Offline-first.
- Cloud không nằm trong critical capture/print path.

---

# 2. Guest Flow chuẩn

```text
START / SHOWCASE
        ↓
SELECT SHOT FORMAT
        ├── 1 Shot
        ├── 2 Shots
        ├── 4 Shots
        └── 6 Shots
        ↓
AUTO CAPTURE
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
        └── Auto print
        ↓
DONE / TIMEOUT 120s
        ↓
RESET SESSION
        ↓
START
```

Không có Guest Step riêng cho:
- Select Layout
- Select Paper
- Select Printer
- Select Photo Order

---

# 3. Shot Format chuẩn

| Format | Shot count | Layout |
|---|---:|---|
| 1 Shot | 1 | 1 ảnh lớn |
| 2 Shots | 2 | 2 ảnh xếp dọc |
| 4 Shots | 4 | 4 ảnh xếp dọc |
| 6 Shots | 6 | 2 cột × 3 hàng |

Ví dụ:

```ts
type CaptureFormat = {
  id: "format_1shot" | "format_2shot" | "format_4shot" | "format_6shot";
  shotCount: 1 | 2 | 4 | 6;
  slotCount: 1 | 2 | 4 | 6;
  layoutType: "single" | "vertical_2" | "vertical_4" | "2col_3row";
};
```

---

# 4. Target architecture

```text
                         MOMENTAI CAMERAOS

                                │
                                ▼
                       Shared Domain Core
                                │
          ┌─────────────────────┴─────────────────────┐
          │                                           │
          ▼                                           ▼
   MomentAI Mac                                  MomentAI iPad
 Electron + React                              React Native
          │                                           │
          ▼                                           ▼
   Platform Services                           Platform Services
          │                                           │
    ┌─────┴─────┐                               ┌─────┴─────┐
    ▼           ▼                               ▼           ▼
 Camera      Printer                         Camera      Printer
 Adapter      Adapter                        Adapter      Adapter
    │           │                               │           │
    ▼           ▼                               ▼           ▼
 EDSDK /     macOS Print                   iPad Cam /    AirPrint /
 Webcam                                       CCAPI       Vendor
```

---

# 5. Monorepo đề xuất

```text
momentai-cameraos/

apps/
├── mac/
│   ├── electron/
│   │   ├── main/
│   │   ├── preload/
│   │   └── native/
│   └── renderer/
│       └── React
│
├── ipad/
│   ├── ios/
│   └── src/
│       └── React Native
│
└── admin-web/
    └── optional / future

packages/
├── core/
├── session-engine/
├── shot-engine/
├── event-schema/
├── template-engine/
├── composition-schema/
├── camera-contract/
├── printer-contract/
├── storage-contract/
├── delivery-contract/
├── shared-types/
├── validation/
├── api-contracts/
├── design-tokens/
└── test-fixtures/
```

Khuyến nghị dùng `pnpm workspace`.

---

# 6. Code nào được share?

## Share
- Session Model
- Session State Machine
- Shot Format Model
- Event Model
- Template Model
- Slot Model
- Print Profile
- PrintJob Model
- Camera/Printer/Storage contracts
- Validation
- Template filtering
- Shot → Slot mapping
- Timeout rules
- Auto-print rules
- Design tokens

## Không cố share
- React DOM components
- React Native View components
- Electron APIs
- iOS UIKit APIs
- Canon EDSDK implementation
- AirPrint implementation
- macOS printer implementation
- Platform filesystem implementation

---

# 7. Shared contracts

```ts
export interface CameraAdapter {
  initialize(): Promise<void>;
  getStatus(): Promise<CameraStatus>;
  startLiveView(): Promise<void>;
  stopLiveView(): Promise<void>;
  capture(context: CaptureContext): Promise<CapturedPhoto>;
  dispose(): Promise<void>;
}
```

```ts
export interface PrinterAdapter {
  initialize(): Promise<void>;
  getPrinters(): Promise<PrinterInfo[]>;
  getCapabilities(printerId: string): Promise<PrinterCapabilities>;
  print(job: PrintJob): Promise<PrintResult>;
  getStatus(printerId: string): Promise<PrinterStatus>;
}
```

```ts
export interface StorageAdapter {
  createSessionDirectory(sessionId: string): Promise<void>;
  saveOriginal(sessionId: string, photo: BinaryImage): Promise<StoredFile>;
  saveOutput(sessionId: string, output: BinaryImage, type: OutputType): Promise<StoredFile>;
  readSession(sessionId: string): Promise<Session>;
  writeSession(session: Session): Promise<void>;
}
```

---

# 8. Session Engine

```ts
interface Session {
  id: string;
  eventId: string;
  state: SessionState;
  captureFormat?: CaptureFormat;
  photos: CapturedPhoto[];
  selectedTemplateId?: string;
  slotAssignments: SlotAssignment[];
  customization: SessionCustomization;
  outputs?: SessionOutputs;
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

---

# 9. Event schema

```ts
interface Event {
  id: string;
  name: string;
  shotFormats: CaptureFormatId[];
  templateIds: string[];
  printing: {
    enabled: boolean;
    autoPrint: boolean;
    copies: number;
  };
  resultTimeoutSeconds: number;
}
```

---

# 10. Template schema

```ts
interface FrameTemplate {
  id: string;
  eventId: string;
  captureFormatId: CaptureFormatId;

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

Guest query:

```text
eventId = currentEvent
AND captureFormatId = selectedFormat
AND status = published
```

---

# 11. Shot → Slot rule

Guest không sắp xếp lại ảnh.

```text
shotIndex = slotIndex
```

Ví dụ 4 shots:

```text
Shot 1 → Slot 1
Shot 2 → Slot 2
Shot 3 → Slot 3
Shot 4 → Slot 4
```

---

# 12. Shared Print Profile

```ts
interface PrintProfile {
  id: string;
  paperId: string;
  widthIn: number;
  heightIn: number;
  dpi: number;
  widthPx: number;
  heightPx: number;
  orientation: "portrait" | "landscape";
  borderless: boolean;
}
```

Copies lấy từ `Event.printing.copies`.  
Paper lấy từ `Template.printProfile`.

Guest không chọn paper/copies.

---

# 13. macOS App — Electron + React

```text
┌──────────────────────────────┐
│      React Renderer          │
│                              │
│ Start / Shot / Capture       │
│ Template / Customize / Result│
└──────────────┬───────────────┘
               │
          Preload API
               │
               ▼
┌──────────────────────────────┐
│       Electron Main          │
│                              │
│ Session Runtime              │
│ CameraService                │
│ PrinterService               │
│ StorageService               │
│ Composition Worker           │
└───────┬─────────────┬────────┘
        │             │
        ▼             ▼
 CameraAdapter    PrinterAdapter
```

Renderer không được import:
- `fs`
- Canon SDK
- native printer
- shell trực tiếp

Renderer chỉ gọi API hẹp qua preload.

---

# 14. Mac camera providers

V1:

```text
device
canon_edsdk
```

Mac dev:

```json
{
  "platform": "mac",
  "cameraProvider": "device",
  "printerProvider": "native"
}
```

Mac production:

```json
{
  "platform": "mac",
  "cameraProvider": "canon_edsdk",
  "printerProvider": "native"
}
```

---

# 15. DeviceCameraAdapter

Dùng camera Mac/Webcam để phát triển trước.

```text
React
 ↓
CameraService
 ↓
DeviceCameraAdapter
 ↓
Mac Camera
```

Output:

```ts
CapturedPhoto
```

Mục tiêu là full Guest Flow chạy được trước khi tích hợp Canon.

---

# 16. CanonEdsdkAdapter

Production với Canon EOS 6D:

```text
Canon EOS 6D
     │ USB
     ▼
Canon EDSDK
     │
     ▼
CanonEdsdkAdapter
     │
     ▼
CameraService
```

Boot flow:

```text
Electron Main
 ↓
CameraService.initialize()
 ↓
CanonEdsdkAdapter.initialize()
 ↓
EDSDK init
 ↓
Enumerate camera
 ↓
Find EOS 6D
 ↓
Open session
 ↓
Register object events
 ↓
Start Live View
 ↓
READY
```

Capture flow:

```text
CaptureManager
 ↓
CameraService.capture()
 ↓
CanonEdsdkAdapter
 ↓
EDSDK command
 ↓
Canon shutter
 ↓
Camera event
 ↓
Download JPEG
 ↓
Validate JPEG
 ↓
StorageAdapter
 ↓
CapturedPhoto
```

Critical rule:

> Không đánh dấu shot completed cho tới khi JPEG tải và validate thành công.

---

# 17. Camera lifecycle trên Mac

```text
App boot
 ↓
Connect camera
 ↓
Keep alive

Guest A
 ↓
Reset Guest

Guest B
 ↓
Reset Guest

Guest C

 ↓
App shutdown
 ↓
Close camera
```

Reset Guest không disconnect camera.

---

# 18. macOS PrinterAdapter

```text
PrintService
 ↓
MacPrinterAdapter
 ↓
macOS Print System
 ↓
Printer Driver
 ↓
Photo Printer
```

Trước print:

```text
Template requires 4x6
       ↓
Printer capabilities
       ↓
supports 4x6 ?
       ├── yes → print
       └── no  → operator error
```

---

# 19. iPad App — React Native

```text
┌─────────────────────────────┐
│     React Native UI         │
│ Same Guest Flow             │
└──────────────┬──────────────┘
               │
         Native Bridge
               │
               ▼
┌─────────────────────────────┐
│      iOS Platform Layer     │
│ Camera / Print / Storage    │
└───────┬────────────┬────────┘
        │            │
        ▼            ▼
 iPad Camera      AirPrint
```

---

# 20. iPad camera V1

```text
cameraProvider = device
```

```text
React Native
 ↓
DeviceCameraAdapter
 ↓
Native Camera Module
 ↓
iPad Camera
```

EOS 6D không được bake vào iPad flow.

Future:

```text
cameraProvider = canon_ccapi
```

với Canon model hỗ trợ CCAPI.

---

# 21. iPad printer V1

```text
printerProvider = airprint
```

```text
PrintService
 ↓
AirPrintAdapter
 ↓
iOS Print APIs
 ↓
Wi-Fi
 ↓
AirPrint Printer
```

Core không biết AirPrint.

---

# 22. Composition Engine

Không đặt composition logic trong screen.

```ts
interface CompositionEngine {
  preview(input: CompositionInput): Promise<PreviewResult>;
  renderFinal(input: CompositionInput): Promise<SessionOutputs>;
}
```

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

Output:

```text
master
share
print
```

Preview dùng resolution thấp hơn print.

---

# 23. Result / QR / Print

```text
Composition
      │
      ├─────────────┐
      │             │
      ▼             ▼
DeliveryService   PrintService
      │             │
      ▼             ▼
QR / Gallery     Print Queue
```

Không đợi print hoàn tất mới mở Result Screen.

---

# 24. Offline-first

Không cần Internet để:
- Start
- Select Shot
- Capture
- Select Template
- Customize
- Compose
- Print
- Reset

Internet chỉ dùng:
- Event sync
- Template sync
- Cloud gallery
- QR cloud delivery
- Analytics
- Remote monitoring

---

# 25. Storage abstraction

Mac dùng filesystem.  
iPad dùng app sandbox.

Core chỉ biết:

```text
StorageAdapter
```

Không hard-code macOS absolute path trong domain model.

---

# 26. Refactor strategy

Không big-bang rewrite.

```text
Existing App
 ↓
Audit
 ↓
Extract Domain
 ↓
Extract Contracts
 ↓
Introduce Adapter Layer
 ↓
Move Mac Hardware
 ↓
Build Electron Runtime
 ↓
Validate Guest Flow
 ↓
Add iPad Runtime
```

---

# 27. Phase 0 — Audit codebase

Phân loại code:

```text
UI
Domain / Business
Camera
Printer
Storage
Template
Composition
Cloud/API
Admin
Utilities
```

Đánh dấu:
- KEEP
- MOVE
- REWRITE
- DELETE

Tạo:
- `docs/refactor/current-architecture.md`
- `docs/refactor/dependency-map.md`
- `docs/refactor/migration-map.md`

---

# 28. Phase 1 — Freeze Guest Flow

Không đổi Guest Flow trong lúc refactor.

Tạo:
- `packages/shared-types`
- `packages/session-engine`
- `packages/shot-engine`

---

# 29. Phase 2 — Extract domain models

Move khỏi JSX/component:
- CaptureFormat
- Session
- Event
- Template
- PrintProfile
- PrintJob
- CapturedPhoto

Không viết business rule kiểu:

```tsx
const shotCount = selected === "4" ? 4 : ...
```

trong screen.

---

# 30. Phase 3 — Camera contract

Create:

```text
packages/camera-contract
```

Mọi code camera phải đi qua `CameraAdapter`.

Không screen nào import Canon implementation.

---

# 31. Phase 4 — Mac Device Camera trước

```text
CAMERA_PROVIDER=device
```

Hoàn thiện full flow:
- Start
- Shot selection
- Live View
- Auto capture
- Photo storage
- Template
- Composition
- Result

Mục tiêu: booth chạy đủ flow không cần DSLR.

---

# 32. Phase 5 — Printer contract

Create:

```text
packages/printer-contract
```

Refactor:

```text
PrintService
 ↓
PrinterAdapter
```

Copies lấy từ Event.  
Paper lấy từ Template.

---

# 33. Phase 6 — Canon EOS 6D adapter

Implement `CanonEdsdkAdapter`.

Requirements:
- Initialize EDSDK
- Detect EOS 6D
- Open session
- Live View
- Trigger shutter
- Wait object event
- Download JPEG
- Validate JPEG
- Reconnect
- Shutdown

Không sửa:
- Session
- Template
- Composition
- Guest Screens
- Print Flow

---

# 34. Phase 7 — Mac production hardening

Add:
- Auto-start kiosk
- Full-screen mode
- Crash recovery
- Camera reconnect
- Printer recovery
- Session persistence
- Log rotation
- Storage cleanup
- Device health
- Operator escape

---

# 35. Phase 8 — React Native iPad

Tạo:

```text
apps/ipad
```

Reuse:
- shared-types
- session-engine
- shot-engine
- template schema
- camera contract
- printer contract
- validation
- design tokens

Implement riêng:
- React Native screens
- DeviceCameraAdapter
- AirPrintAdapter
- iPadStorageAdapter

---

# 36. Phase 9 — Feature parity

Mac và iPad phải cùng pass:
- 1 Shot
- 2 Shots
- 4 Shots
- 6 Shots
- Template filtering
- Typing
- Drawing
- Composition
- PrintJob
- Copies
- QR
- Timeout
- Reset

---

# 37. Phase 10 — Cloud sync

Chỉ add sau khi local flow ổn định:
- Event Sync
- Template Sync
- Gallery Upload
- QR Cloud
- Analytics
- Remote Monitoring

Cloud phải async.

---

# 38. Dependency rules

```text
packages/core
    cannot depend on apps/

session-engine
    cannot depend on electron
    cannot depend on react-native

renderer
    cannot import Canon SDK

shared packages
    cannot import platform implementation
```

Dependency direction:

```text
apps/mac
  ↓
mac adapters
  ↓
contracts
  ↓
domain/core
```

```text
apps/ipad
  ↓
ios adapters
  ↓
contracts
  ↓
domain/core
```

Không bao giờ:

```text
core → Electron
core → React Native
```

---

# 39. Suggested directories

```text
momentai-cameraos/

apps/
├── mac/
│   ├── electron/
│   │   ├── main/
│   │   │   ├── camera/
│   │   │   ├── printer/
│   │   │   ├── storage/
│   │   │   ├── ipc/
│   │   │   └── bootstrap/
│   │   └── preload/
│   └── renderer/
│       ├── screens/
│       ├── components/
│       ├── hooks/
│       └── state/
│
├── ipad/
│   ├── ios/
│   └── src/
│       ├── screens/
│       ├── components/
│       ├── native/
│       ├── hooks/
│       └── state/
│
packages/
├── core/
├── shared-types/
├── session-engine/
├── shot-engine/
├── event-schema/
├── template-engine/
├── composition-schema/
├── camera-contract/
├── printer-contract/
├── storage-contract/
├── delivery-contract/
├── design-tokens/
├── validation/
└── test-fixtures/
```

---

# 40. Mac preload API

Không expose raw IPC channel names.

```ts
interface MomentAIAPI {
  session: {
    create(): Promise<Session>;
    get(): Promise<Session>;
    complete(): Promise<void>;
  };

  camera: {
    status(): Promise<CameraStatus>;
    startLiveView(): Promise<void>;
    capture(): Promise<CapturedPhoto>;
  };

  printer: {
    status(): Promise<PrinterStatus>;
    capabilities(): Promise<PrinterCapabilities>;
  };
}
```

Renderer gọi:

```ts
window.momentai.camera.capture()
```

Không gọi:

```ts
ipcRenderer.invoke("canon-do-shutter")
```

---

# 41. Error model

```ts
interface MomentAIError {
  code: string;
  domain: "camera" | "printer" | "storage" | "composition" | "network";
  severity: "warning" | "blocking";
  technicalMessage: string;
  guestMessage?: string;
  recoverable: boolean;
}
```

Guest thấy:

```text
Camera đang cần hỗ trợ.
```

Operator log thấy:

```text
EDSDK_DEVICE_NOT_FOUND
```

---

# 42. Logging

Structured log:

```json
{
  "timestamp": "...",
  "sessionId": "sess_001",
  "event": "capture.completed",
  "shotIndex": 3,
  "cameraProvider": "canon_edsdk",
  "durationMs": 842
}
```

Key events:
- app.boot
- camera.connected
- camera.disconnected
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

---

# 43. Testing

## Unit
- ShotFormat
- Template filtering
- Slot mapping
- Session transitions
- PrintJob creation
- Paper validation

## Contract
Mọi CameraAdapter phải pass:
- initialize
- status
- capture
- dispose

Mọi PrinterAdapter:
- capabilities
- validate
- print
- status

## E2E
Chạy cùng Guest Flow cho:
- Mac device camera
- Mac Canon 6D
- iPad camera

---

# 44. Fake adapters cho CI

```ts
class FakeCameraAdapter implements CameraAdapter {
  async capture() {
    return fixturePhoto();
  }
}
```

Nên có:
- FakeCameraAdapter
- FakePrinterAdapter
- FakeStorageAdapter

để CI không cần hardware thật.

---

# 45. Definition of Done — Shared Core

- [ ] Session state machine extracted
- [ ] ShotFormat domain extracted
- [ ] Template schema defined
- [ ] PrintProfile defined
- [ ] PrintJob defined
- [ ] CameraAdapter contract defined
- [ ] PrinterAdapter contract defined
- [ ] StorageAdapter contract defined
- [ ] Domain has zero Electron imports
- [ ] Domain has zero React Native imports
- [ ] Unit tests pass

---

# 46. Definition of Done — Mac V1

- [ ] Electron + React app
- [ ] Secure preload API
- [ ] Mac device camera
- [ ] Canon EOS 6D adapter
- [ ] Live View
- [ ] 1/2/4/6 auto capture
- [ ] Template filtering
- [ ] Text customization
- [ ] Drawing customization
- [ ] Final composition
- [ ] Native printer integration
- [ ] Paper validation
- [ ] Copies from Event
- [ ] Auto Print
- [ ] QR
- [ ] 120s timeout
- [ ] Reset without disconnect camera
- [ ] Camera reconnect
- [ ] Printer recovery
- [ ] Offline-first

---

# 47. Definition of Done — iPad V1

- [ ] React Native app
- [ ] Shared Session Engine
- [ ] Shared ShotFormat rules
- [ ] Shared Template schema
- [ ] iPad camera
- [ ] 1/2/4/6 auto capture
- [ ] Same Template filtering
- [ ] Text
- [ ] Draw
- [ ] Final composition
- [ ] AirPrint
- [ ] Paper/capability validation
- [ ] Copies from Event
- [ ] QR
- [ ] 120s timeout
- [ ] Offline-first

---

# 48. Canon EOS 6D deployment

```text
Canon EOS 6D
     │ USB
     ▼
MomentAI Mac
     │
CanonEdsdkAdapter
```

Sai:

```text
SessionController
 ↓
Canon6D.capture()
```

Đúng:

```text
SessionController
 ↓
CaptureManager
 ↓
CameraAdapter
 ↓
CanonEdsdkAdapter
```

---

# 49. iPad deployment

V1:

```text
iPad Camera
 ↓
DeviceCameraAdapter
 ↓
MomentAI Core
```

Print:

```text
MomentAI
 ↓
AirPrintAdapter
 ↓
Wi-Fi Printer
```

Future Canon:

```text
CCAPI-compatible Canon
      ↓ Wi-Fi
CanonCcapiAdapter
      ↓
MomentAI iPad
```

Guest Flow không đổi.

---

# 50. Migration rules

Nếu code hiện tại có:

```ts
if (useCanon) {
  ...
}
```

trong screen/business logic:

Refactor thành:

```ts
camera.capture()
```

Nếu có:

```ts
if (isMac) {
  printMac();
}
```

trong domain logic:

Refactor thành:

```ts
printer.print(job)
```

Nếu shot/layout rule nằm trong JSX:

Move sang:
- ShotFormat domain
- Template schema

---

# 51. Pull Request strategy

Đề xuất:

```text
PR01 Monorepo foundation
PR02 Shared types
PR03 Session engine
PR04 Shot formats
PR05 Template schema
PR06 Camera contract
PR07 Fake camera
PR08 Mac DeviceCamera adapter
PR09 Guest flow on shared domain
PR10 Printer contract
PR11 Mac native print
PR12 Canon EDSDK adapter
PR13 Mac hardening
PR14 React Native bootstrap
PR15 iPad camera
PR16 iPad printing
```

Tránh PR kiểu:

```text
Rewrite entire CameraOS
```

---

# 52. Architecture summary

```text
                     MomentAI CameraOS
                             │
                     Shared TypeScript Core
                             │
             ┌───────────────┴───────────────┐
             │                               │
             ▼                               ▼
         Mac Runtime                      iPad Runtime
      Electron + React                  React Native
             │                               │
       ┌─────┴─────┐                   ┌─────┴─────┐
       │           │                   │           │
       ▼           ▼                   ▼           ▼
    Camera       Printer             Camera      Printer
    Adapter       Adapter             Adapter     Adapter
       │           │                   │           │
       ▼           ▼                   ▼           ▼
 Canon EDSDK   macOS Print         iPad Cam    AirPrint
    / Webcam
```

Nguyên tắc trung tâm:

```text
PLATFORM IMPLEMENTS HARDWARE

CORE IMPLEMENTS BUSINESS

UI IMPLEMENTS EXPERIENCE
```

---

# 53. Final refactor objective

Sau refactor, đội ngũ phải có khả năng:

- đổi `device` → `canon_edsdk` trên Mac mà không sửa Guest UI;
- chạy cùng Session/Shot/Template rules trên iPad mà không copy logic;
- thay printer mà không sửa Guest Flow;
- thêm template mới mà không sửa Capture Engine;
- thay Event mà không rebuild app;
- mất Internet vẫn Capture → Compose → Print;
- reset Guest không reset CameraOS hardware layer.

Đây là mục tiêu kỹ thuật chính của CameraOS mới.
