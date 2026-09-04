# MomentAI CameraOS — Guest Flow & Internal System Design
## Source of Truth for Product, UI/UX, Frontend, Camera Core, Backend & Printing

**Version:** 1.2-production-brief-v3.1
**Target Camera:** Canon EOS 6D
**Host:** Windows 10 x64 booth PC / Mini PC form factor
**Desktop shell:** Electron packaged as a Windows `.exe` app
**Renderer:** Vite React + TypeScript
**Admin:** Electron operator/admin surface, hidden from guest and passcode-gated
**Printer:** Canon SELPHY CP1000 via Windows Print System
**Production data root:** `%LOCALAPPDATA%` app-owned MomentAI Photobooth directory
**Share/QR:** Vercel landing page + Neon token metadata + R2 final-share storage, with local QR fallback/dev/offline mode
**Kiosk:** Fullscreen Electron guest kiosk with Windows startup/auto-launch support
**Application:** MomentAI Photobooth
**Platform:** MomentAI CameraOS

---

# 1. Mục đích tài liệu

Tài liệu này mô tả **toàn bộ flow Guest và flow xử lý hệ thống bên trong tương ứng với từng màn hình**.

Mục tiêu là để tất cả các team cùng hiểu một kiến trúc duy nhất:

- Product hiểu Guest đang làm gì ở mỗi bước.
- UI/UX hiểu mỗi màn hình cần component nào.
- Frontend hiểu state nào cần render.
- Camera/Core team hiểu lúc nào camera cần hoạt động.
- Backend hiểu data nào được tạo và lưu.
- Template team hiểu shot format liên kết với template như thế nào.
- Composition team hiểu ảnh được map vào slot ra sao.
- Printing team hiểu lúc nào tạo print job.
- Admin team hiểu template nào được phép hiển thị cho một Event.

Tài liệu này được xem là **source of truth** cho Guest Flow V3.

---

# 2. Guest Flow chính thức

```text
START / SHOWCASE
        ↓
       START
        ↓
SELECT SHOT FORMAT
        ↓
     CONTINUE
        ↓
LIVE VIEW / AUTO CAPTURE
        ↓
Capture đủ số shots
        ↓
SELECT TEMPLATE
        ↓
CUSTOMIZE
(chỉ nếu template hỗ trợ)
        ↓
FINAL COMPOSITION
        ↓
RESULT + CLOUD QR/LOCAL FALLBACK + GUEST-CONFIRMED QUEUED PRINT
        │
        ├── Digital Output via CloudShareService (Vercel + Neon + R2) or LocalShareService fallback
        └── Durable FIFO PrintJob after guest confirmation
        ↓
DONE hoặc TIMEOUT 2 PHÚT
        ↓
RESET GUEST SESSION
        ↓
START
```

Guest không có các bước riêng:

```text
SELECT LAYOUT
SELECT PHOTO ORDER
SELECT PAPER
SELECT PRINTER
```

Các thông tin này được hệ thống tự quyết định dựa trên:

```text
Shot Format
+
Template
+
Event
+
Print Profile
```

## 2.1 Production runtime decisions applied

- V1 production app is a Windows `.exe` Electron kiosk running on the Windows 10 x64 booth PC / Mini PC.
- Production mutable data lives under `%LOCALAPPDATA%` in an app-owned MomentAI Photobooth directory.
- Guest runtime launches fullscreen/kiosk with no visible toolbar/taskbar/chrome; Admin remains hidden and passcode-gated.
- Windows startup/auto-launch after login is required for booth operation.
- Auto-update is not `git pull main`; V1 uses manual release package updates unless PM approves a separate signed update channel.
- V1 production share mode is `CLOUD_LANDING_PAGE` using Vercel landing page, Neon token metadata and R2 final-share media storage; `LOCAL_NETWORK_URL` remains fallback/dev/offline mode when configured and reachable.
- QR/share token TTL is 10 minutes from share/landing creation; durable unexpired tokens survive app restart.
- Cleanup eligibility defaults to 30 minutes for local/cloud session data but must preserve active sessions, active share uploads and queued/printing/failed/review print jobs/files.
- V1 print remains `GUEST_CONFIRM`: the guest presses Print to create one durable print job. Confirmed jobs are FIFO queued; printer slowness queues later jobs, and failure stops the queue with no automatic retry until Admin manual reprint/resume.
- V1 certified production hardware is Canon EOS 6D camera and Canon SELPHY CP1000 printer only; adapter boundaries remain extensible for future PM-approved hardware.
- Scrollable guest/operator surfaces must support natural touch drag scrolling, not scrollbar-only interaction.

---

# 3. Các Shot Format chính thức

MomentAI V1 sử dụng 4 loại shot:

| Shot Format | Số ảnh | Cấu trúc |
|---|---:|---|
| 1 Shot | 1 | 1 ảnh lớn |
| 2 Shots | 2 | 2 ảnh xếp dọc |
| 4 Shots | 4 | 4 ảnh xếp dọc |
| 6 Shots | 6 | 2 cột × 3 hàng |

## 3.1 1 Shot

```text
┌────────────────┐
│                │
│     PHOTO      │
│                │
│                │
│     DESIGN     │
└────────────────┘
```

```json
{
  "id": "format_1shot",
  "shotCount": 1,
  "slotCount": 1,
  "layoutType": "single"
}
```

## 3.2 2 Shots

```text
┌────────────────┐
│    PHOTO 1     │
├────────────────┤
│    PHOTO 2     │
│                │
│     DESIGN     │
└────────────────┘
```

```json
{
  "id": "format_2shot",
  "shotCount": 2,
  "slotCount": 2,
  "layoutType": "vertical_2"
}
```

## 3.3 4 Shots

```text
┌────────────────┐
│    PHOTO 1     │
├────────────────┤
│    PHOTO 2     │
├────────────────┤
│    PHOTO 3     │
├────────────────┤
│    PHOTO 4     │
│     DESIGN     │
└────────────────┘
```

```json
{
  "id": "format_4shot",
  "shotCount": 4,
  "slotCount": 4,
  "layoutType": "vertical_4"
}
```

## 3.4 6 Shots

```text
┌────────┬────────┐
│   P1   │   P4   │
├────────┼────────┤
│   P2   │   P5   │
├────────┼────────┤
│   P3   │   P6   │
├────────┴────────┤
│      DESIGN     │
└─────────────────┘
```

```json
{
  "id": "format_6shot",
  "shotCount": 6,
  "slotCount": 6,
  "layoutType": "2col_3row"
}
```

---

# 4. Kiến trúc tổng thể

```text
┌─────────────────────────────┐
│ Electron React Renderer     │
│ Guest UI + hidden Admin UI  │
└──────────────┬──────────────┘
               │ Preload API / IPC
               ▼
┌─────────────────────────────┐
│ Electron Main               │
│ Session Controller          │
└───────┬────────┬────────────┘
        │        │
        │        ├───────────────┐
        │        │               │
        ▼        ▼               ▼
CaptureManager TemplateService CompositionEngine
        │                        │
        ▼                        ├── Master
 CameraService                  ├── Share
        │                        └── Print
        ▼
 Active CameraAdapter
 ├── FakeCameraAdapter
 ├── DeviceCameraAdapter
 └── CanonAdapter → CanonCameraBridge → Canon EDSDK → Canon EOS 6D

                      Share ──→ CloudShareService ──→ Cloud QR / Local fallback
                      Print ──→ Guest Confirm ──→ Durable FIFO Print Queue ──→ Printer
```

---

# 5. Session là object trung tâm

Mỗi lượt khách tạo một `Session`.

Ví dụ:

```json
{
  "sessionId": "sess_20260811_001",
  "eventId": "event_wedding_001",

  "captureFormat": null,

  "photos": [],

  "selectedTemplate": null,

  "slotAssignments": [],

  "customization": {
    "text": [],
    "drawing": []
  },

  "outputs": {
    "master": null,
    "share": null,
    "print": null
  },

  "qr": null,

  "printJob": null,

  "status": "created"
}
```

SessionController là nơi duy nhất điều phối Guest Session.

---

# 6. Screen 01 — START / SHOWCASE

## 6.1 Guest nhìn thấy

Màn hình Start không dùng để chọn shot.

Nó chỉ:

- Hiển thị branding Event.
- Hiển thị các mẫu kết quả.
- Giúp khách hiểu 1 / 2 / 4 / 6 shots.
- Có một CTA duy nhất: `BẮT ĐẦU`.

Ví dụ:

```text
┌───────────────────────────────────────────────┐
│                                               │
│              EVENT / MOMENTAI                 │
│                                               │
│     [1 Shot] [2 Shots] [4 Shots] [6 Shots]   │
│                                               │
│               Sample Results                  │
│                                               │
│               [ BẮT ĐẦU ]                    │
│                                               │
└───────────────────────────────────────────────┘
```

## 6.2 Components

```text
StartScreen
├── EventBranding
├── ResultShowcaseCarousel
│   └── SampleResultCard[]
├── IdleAnimation
└── StartButton
```

## 6.3 Hệ thống bên trong khi idle

```text
CameraService     = READY
PrinterService    = READY
EventConfig       = LOADED
TemplateCache     = READY
GuestSession      = NONE
```

Camera vẫn đang được CameraOS giữ connection.

## 6.4 Khi khách bấm START

```text
StartButton
    ↓
createSession()
    ↓
SessionController
    ↓
sessionId generated
    ↓
status = SELECTING_FORMAT
```

Data sau bước này:

```json
{
  "sessionId": "sess_001",
  "eventId": "event_wedding_001",
  "status": "SELECTING_FORMAT"
}
```

---

# 7. Screen 02 — SELECT SHOT FORMAT

## 7.1 Guest nhìn thấy

```text
CHỌN KIỂU ẢNH

[ 1 SHOT ]

[ 2 SHOTS ]

[ 4 SHOTS ]

[ 6 SHOTS ]

[ TIẾP TỤC ]
```

Mỗi card hiển thị:

- số shots
- hình minh họa bố cục
- selected state

## 7.2 Components

```text
SelectShotScreen
├── ScreenHeader
├── ShotFormatGrid
│   └── ShotFormatCard[]
├── SelectionIndicator
├── BackButton
└── ContinueButton
```

## 7.3 Khi guest chọn 4 shots

Frontend gọi:

```text
selectCaptureFormat("format_4shot")
```

System:

```text
Guest UI
   ↓
SessionController
   ↓
CaptureFormatService
   ↓
load format_4shot
   ↓
session.captureFormat = format_4shot
```

Data:

```json
{
  "captureFormat": {
    "id": "format_4shot",
    "shotCount": 4,
    "slotCount": 4,
    "layoutType": "vertical_4"
  }
}
```

Không cần lưu `shotCount` như một biến độc lập nếu đã có trong `CaptureFormat`.

## 7.4 Continue

Khi Guest bấm:

```text
TIẾP TỤC
```

System:

```text
status = READY_TO_CAPTURE
```

Frontend chuyển:

```text
SelectShotScreen
      ↓
CaptureScreen
```

---

# 8. Screen 03 — CAPTURE

## 8.1 Guest nhìn thấy

Capture Screen gần như full camera.

```text
┌──────────────────────────────────────────────┐
│                                              │
│                                              │
│              CAMERA LIVE VIEW                │
│                                              │
│                     3                        │
│                                              │
│              ● ● ○ ○                         │
│               2 / 4                          │
│                                              │
└──────────────────────────────────────────────┘
```

## 8.2 Components

```text
CaptureScreen
├── CameraLiveView
├── CaptureGuideOverlay
├── CountdownOverlay
├── ShotProgress
├── CaptureFlash
├── LastCapturePreview
└── CaptureStatus
```

## 8.3 Camera architecture

```text
Guest UI
   ↓
SessionController
   ↓
CaptureManager
   ↓
CameraService
   ↓
Active CameraAdapter
   ├── FakeCameraAdapter for tests
   ├── DeviceCameraAdapter for development
   └── CanonAdapter → CanonCameraBridge → Canon EDSDK → Canon EOS 6D after physical spike evidence
```

Guest UI không được gọi camera trực tiếp.

Canon Command Shadow Mode là development diagnostics: sau fake/device capture loop và trước physical Canon spike, CameraOS có thể phát `CANON:SHADOW` structured logs cho production-intent commands với cùng `sessionId`, `shotIndex` và `correlationId`. Shadow không được gọi Canon hardware/EDSDK/Bridge và không bao giờ thoả Canon hardware PASS.

---

# 9. Capture flow cho một shot

Ví dụ Shot #1:

```text
CaptureManager
      ↓
currentShotIndex = 1
      ↓
Countdown
3 → 2 → 1
      ↓
CameraService.capture()
      ↓
Active CameraAdapter: Fake / Device / Canon
      ↓
Still image acquired
      ↓
If Canon: shutter + object event + JPEG download
      ↓
Validate image
      ↓
StorageService.saveOriginal()
      ↓
Photo created
      ↓
Photo Pool
```

Photo object:

```json
{
  "photoId": "photo_001",
  "sessionId": "sess_001",
  "shotIndex": 1,
  "originalPath": "originals/capture_01.jpg",
  "status": "valid",
  "capturedAt": "2026-08-11T15:00:01+07:00"
}
```

---

# 10. Capture loop

Ví dụ Guest chọn 4 shots:

```text
Shot 1
↓
Countdown
↓
Capture
↓
Download
↓
Validate
↓
Store

Shot 2
↓
Countdown
↓
Capture
↓
Download
↓
Validate
↓
Store

Shot 3
...

Shot 4
...
```

Điều kiện hoàn thành:

```text
capturedPhotoCount == captureFormat.shotCount
```

Ví dụ:

```text
4 == 4
```

Sau đó:

```text
CaptureManager
      ↓
captureComplete
      ↓
SessionController
      ↓
status = SELECTING_TEMPLATE
```

---

# 11. Photo Pool

Sau Capture, Session chứa Photo Pool.

Ví dụ 4 shots:

```text
Photo Pool
├── P1
├── P2
├── P3
└── P4
```

Data:

```json
[
  {
    "photoId": "p1",
    "shotIndex": 1,
    "originalPath": "capture_01.jpg"
  },
  {
    "photoId": "p2",
    "shotIndex": 2,
    "originalPath": "capture_02.jpg"
  },
  {
    "photoId": "p3",
    "shotIndex": 3,
    "originalPath": "capture_03.jpg"
  },
  {
    "photoId": "p4",
    "shotIndex": 4,
    "originalPath": "capture_04.jpg"
  }
]
```

Ảnh gốc không được chỉnh sửa trực tiếp.

---

# 12. Shot → Slot Mapping

Flow hiện tại không cho Guest chọn lại ảnh hay thay đổi thứ tự.

Do đó:

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

Ví dụ 6 shots:

```text
Shot 1 → Slot 1
Shot 2 → Slot 2
Shot 3 → Slot 3
Shot 4 → Slot 4
Shot 5 → Slot 5
Shot 6 → Slot 6
```

Mapping được thực hiện sau khi Template được chọn.

---

# 13. Screen 04 — SELECT TEMPLATE

## 13.1 Guest nhìn thấy

Guest chỉ nhìn thấy Template tương thích với:

```text
Current Event
+
Selected Shot Format
```

Ví dụ Guest chọn:

```text
4 Shots
```

thì chỉ hiển thị:

```text
Wedding / 4-shot Template A
Wedding / 4-shot Template B
Wedding / 4-shot Template C
```

Không hiển thị:

```text
1-shot templates
2-shot templates
6-shot templates
```

## 13.2 Components

```text
TemplateScreen
├── ScreenHeader
├── TemplateGallery
│   └── TemplateCard[]
├── TemplateLivePreview
├── EditableBadge
├── BackButton
└── ContinueButton
```

## 13.3 Query logic

```text
eventId = session.eventId

AND

captureFormatId = session.captureFormat.id

AND

status = PUBLISHED
```

---

# 14. Template là gì?

Template không chỉ là PNG overlay.

Template là object chứa toàn bộ cấu trúc của thành phẩm.

```json
{
  "templateId": "tpl_wedding_4_01",

  "eventId": "event_wedding_001",

  "captureFormatId": "format_4shot",

  "canvas": {
    "width": 1200,
    "height": 1800
  },

  "slots": [],

  "assets": {},

  "customization": {},

  "printProfile": {}
}
```

---

# 15. Template Slot Config

Ví dụ template 4 shots:

```json
{
  "slots": [
    {
      "slotIndex": 1,
      "x": 100,
      "y": 100,
      "width": 1000,
      "height": 300
    },
    {
      "slotIndex": 2,
      "x": 100,
      "y": 430,
      "width": 1000,
      "height": 300
    },
    {
      "slotIndex": 3,
      "x": 100,
      "y": 760,
      "width": 1000,
      "height": 300
    },
    {
      "slotIndex": 4,
      "x": 100,
      "y": 1090,
      "width": 1000,
      "height": 300
    }
  ]
}
```

Template quyết định chính xác:

- vị trí ảnh
- kích thước ảnh
- tỷ lệ crop
- background
- overlay
- text
- drawing
- print size

---

# 16. Khi Guest chọn Template

Ví dụ:

```text
Template B selected
```

System:

```text
Photo Pool
+
Template B
      ↓
Assignment Engine
      ↓
Shot → Slot Mapping
      ↓
PreviewRenderer
      ↓
Live Preview
```

Assignment:

```json
[
  {
    "slotIndex": 1,
    "photoId": "p1"
  },
  {
    "slotIndex": 2,
    "photoId": "p2"
  },
  {
    "slotIndex": 3,
    "photoId": "p3"
  },
  {
    "slotIndex": 4,
    "photoId": "p4"
  }
]
```

Session:

```text
selectedTemplate = Template B
slotAssignments = generated
```

---

# 17. Template Render Order

Rendering nên theo thứ tự:

```text
BACKGROUND
    ↓
PHOTO SLOT 1
    ↓
PHOTO SLOT 2
    ↓
PHOTO SLOT ...
    ↓
OVERLAY
    ↓
DECORATION
    ↓
EVENT BRANDING
    ↓
TEXT
    ↓
DRAWING
```

---

# 18. Template Customization Config

Template có thể khai báo:

```json
{
  "customization": {
    "allowTyping": true,
    "allowDraw": false
  }
}
```

hoặc:

```json
{
  "customization": {
    "allowTyping": true,
    "allowDraw": true
  }
}
```

Nếu:

```text
allowTyping = false
allowDraw = false
```

Guest bỏ qua Customize Screen.

---

# 19. Text Region

Template nào hỗ trợ text sẽ có vùng text xác định.

```json
{
  "textRegions": [
    {
      "id": "guest_message",
      "placeholder": "You can type in here",
      "x": 100,
      "y": 1600,
      "width": 1000,
      "height": 100,
      "maxLength": 50,
      "font": "Inter",
      "fontSize": 42,
      "alignment": "center"
    }
  ]
}
```

Guest nhìn thấy trực tiếp:

```text
You can type in here
```

trên Preview.

---

# 20. Screen 05 — CUSTOMIZE

Screen này conditional.

## 20.1 Components

```text
CustomizeScreen
├── CompositionCanvas
├── EditableTextRegion
├── VirtualKeyboard
├── DrawCanvas
├── DrawToolbar
├── ResetCustomizationButton
└── DoneButton
```

---

# 21. Typing flow

```text
Guest taps:
"You can type in here"
      ↓
Virtual Keyboard
      ↓
Guest enters text
      ↓
CustomizationController
      ↓
session.customization.text
      ↓
PreviewRenderer
      ↓
Canvas updates immediately
```

Ví dụ:

```json
{
  "text": [
    {
      "regionId": "guest_message",
      "value": "Happy Wedding ❤️"
    }
  ]
}
```

---

# 22. Draw flow

Nếu Template:

```text
allowDraw = true
```

thì:

```text
Touch / Pointer
      ↓
DrawCanvas
      ↓
Stroke Data
      ↓
session.customization.drawing
```

Nên lưu dạng stroke data:

```json
{
  "strokes": [
    {
      "points": [
        [120, 500],
        [126, 508],
        [132, 516]
      ],
      "width": 6
    }
  ]
}
```

Không chỉ lưu bitmap preview.

Lý do:

- render lại được ở resolution cao
- Undo/Redo dễ
- không mất chất lượng khi in

---

# 23. Final Composition

Khi Guest bấm hoàn tất:

```text
Photo Pool
+
Template
+
Slot Assignments
+
Text
+
Drawing
+
Event Branding
      ↓
CompositionEngine
```

Pipeline:

```text
Load Original JPEG
      ↓
Read EXIF
      ↓
Auto Rotate
      ↓
Crop to Slot
      ↓
Resize
      ↓
Color Processing
      ↓
Place into Slot
      ↓
Draw Background
      ↓
Draw Overlay
      ↓
Draw Branding
      ↓
Draw Text
      ↓
Draw Guest Drawing
      ↓
Final Composition
```

---

# 24. Output Files

CompositionEngine tạo 3 loại output.

```text
Final Composition
       │
       ├── MASTER
       │
       ├── SHARE
       │
       └── PRINT
```

## Master

```text
final-master.png
```

Dùng cho:

- archive
- re-render
- reprint

## Share

```text
final-share.jpg
```

Dùng cho:

- Cloud QR landing page through the approved Vercel + Neon + R2 provider stack
- Local QR fallback/dev/offline retrieval when configured and reachable
- gallery/local retrieval when PM approves the operator surface
- social only in a later approved phase

## Print

```text
final-print.jpg
```

Dùng cho printer.

---

# 25. Print Profile

Template chứa Print Profile.

Ví dụ:

```json
{
  "printProfile": {
    "paper": "4x6",
    "orientation": "portrait",
    "dpi": 300
  }
}
```

Một template 6-shot có thể:

```json
{
  "printProfile": {
    "paper": "6x8",
    "orientation": "portrait",
    "dpi": 300
  }
}
```

Guest không chọn giấy.

System tự kiểm tra:

```text
Template Print Profile
+
Printer Capability
+
Paper Currently Loaded
```

---

# 26. Screen 06 — RESULT + CLOUD QR/LOCAL FALLBACK + GUEST-CONFIRMED QUEUED PRINT

Khi composition hoàn tất:

```text
Composition Complete
        │
        ├──────────────────────────────┐
        │                              │
        ▼                              ▼
 CloudShareService / Local fallback    PrintService
        │                              │
        ▼                              ▼
 Cloud QR / Local fallback             Wait for guest confirmation
```

Cloud QR/local fallback được chuẩn bị trên Result screen. Print job chỉ được tạo khi V1 `PrintPolicy=GUEST_CONFIRM` và guest xác nhận in. Job đã xác nhận đi qua durable FIFO PrintQueue, không bị xoá khi guest reset.

---

# 27. Cloud/local QR / Digital flow

```text
final-share.jpg
      ↓
CloudShareService
      ↓
Upload final-share media to R2
      ↓
Create Neon token/share record
      ↓
Tokenized Vercel landing page URL
      ↓
QR Generator
      ↓
QRCodeCard or QR unavailable/local fallback
```

Ví dụ cloud landing URL:

```json
{
  "qr": {
    "url": "https://momentai.example/s/abc123-redacted"
  }
}
```

Local fallback URL, khi configured/reachable:

```json
{
  "qr": {
    "url": "http://192.168.1.25:3789/s/abc123?token=redacted"
  }
}
```

Cloud QR phải dùng tokenized Vercel landing page backed by Neon/R2. Token hết hạn sau 10 phút từ lúc tạo share/landing record và app restart không làm mất token chưa hết hạn. QR không được expose local absolute path, raw R2 key, bucket internals hoặc QR secret/token trong log. Local QR fallback phải dùng endpoint reachable từ điện thoại guest trên cùng network/booth hotspot, không được là `localhost`-only và không được serve arbitrary file/directory listing.

---

# 28. Guest-confirmed print flow

```text
final-print.jpg
      ↓
ResultScreen Print action
      ↓
Guest confirms print
      ↓
PrintService
      ↓
Create durable PrintJob with idempotency key
      ↓
Print Queue
      ↓
Printer Worker
      ↓
FakePrinterAdapter or WindowsPrintAdapter when CP1000 is available
      ↓
If production hardware: Windows Print System
      ↓
Canon SELPHY CP1000
```

Print Job:

```json
{
  "jobId": "print_001",
  "sessionId": "sess_001",
  "templateId": "tpl_wedding_4_01",
  "file": "final-print.jpg",
  "paper": "4x6",
  "copies": 1,
  "status": "queued"
}
```

---

# 29. Result Screen components

```text
ResultScreen
├── SuccessHeading
├── FinalPhotoPreview
├── QRCodeCard or QRUnavailableFallback
├── PrintConfirmButton when GUEST_CONFIRM print is enabled
├── PrintStatus
├── SessionCountdown
└── DoneButton
```

Guest thấy:

```text
Final Photo

Cloud QR, local fallback hoặc QR unavailable fallback

"Quét để tải ảnh" hoặc "QR chưa khả dụng"

[ IN ẢNH ] nếu GUEST_CONFIRM print được bật

Print status: idle / queued / submitted / failed

01:42

[ HOÀN THÀNH ]
```

---

# 30. Result ViewModel

Frontend không nên tự query nhiều service.

SessionController trả về:

```json
{
  "finalImageUrl": "output/final-share.jpg",
  "qrCode": "...",
  "qrStatus": "available",
  "canConfirmPrint": true,
  "printStatus": "idle",
  "timeoutSeconds": 120
}
```

---

# 31. Timeout 2 phút

Khi Result ready:

```text
timer = 120 seconds
```

Hai trường hợp:

## Guest bấm Done

```text
DONE
 ↓
Complete Session
 ↓
Reset Guest UI
```

## Guest bỏ đi

```text
02:00
↓
...
↓
00:00
↓
Complete Session
↓
Reset Guest UI
```

---

# 32. Reset Guest Session

Clear:

```text
captureFormat
photos reference
selectedTemplate
slotAssignments
typedText
drawing
result UI
QR UI
```

Không clear:

```text
Event
Camera connection
Printer connection
Camera settings
Template cache
Printer config
```

Đặc biệt:

```text
DO NOT DISCONNECT CANON EOS 6D
```

---

# 33. Camera session lifecycle

Đúng:

```text
CameraOS Start
      ↓
Initialize CameraService with active adapter
      ↓
Use Fake/Device in dev or Canon after physical spike evidence
      ↓
Keep healthy CameraService session/live-view policy alive
      ↓
Guest Session A
      ↓
Reset Guest UI
      ↓
Guest Session B
      ↓
Reset Guest UI
      ↓
Guest Session C
      ↓
...
```

Sai:

```text
Guest Session
↓
Connect Camera
↓
Capture
↓
Disconnect Camera
```

---

# 34. Full internal flow

```text
┌───────────────────────────┐
│       START SCREEN        │
└─────────────┬─────────────┘
              │
            START
              │
              ▼
      Create Guest Session
              │
              ▼
┌───────────────────────────┐
│    SELECT SHOT FORMAT     │
└─────────────┬─────────────┘
              │
              ▼
       CaptureFormat
  shotCount / slotCount
              │
              ▼
┌───────────────────────────┐
│          CAPTURE          │
└─────────────┬─────────────┘
              │
              ▼
       CaptureManager
              │
              ▼
        CameraService
              │
              ▼
   Active CameraAdapter
   Fake / Device / Canon
              │
              ▼
         Raw Photos
              │
              ▼
          Photo Pool
              │
              ▼
┌───────────────────────────┐
│      SELECT TEMPLATE      │
└─────────────┬─────────────┘
              │
              ▼
     TemplateService
              │
 Filter by Event + Format
              │
              ▼
      Selected Template
              │
              ▼
       Shot → Slot Map
              │
              ▼
        Live Preview
              │
        ┌─────┴─────┐
        │           │
   Customizable?    No
        │           │
       Yes          │
        │           │
        ▼           │
 Text / Drawing     │
        │           │
        └─────┬─────┘
              │
              ▼
      CompositionEngine
              │
       ┌──────┼──────┐
       ▼      ▼      ▼
    Master   Share   Print
              │      │
              ▼      ▼
      Cloud QR/Local Fallback  Print available after guest confirmation
              │      │
              ▼      ▼
┌───────────────────────────┐
│    FINAL RESULT SCREEN    │
│                           │
│ Final Image               │
│ Cloud QR / Local Fallback │
│ Print Confirm + Status    │
│ 2-minute Timeout          │
└─────────────┬─────────────┘
              │
        DONE / TIMEOUT
              │
              ▼
      Complete Session
              │
              ▼
       Reset Guest UI
              │
              ▼
             START
```

---

# 35. Data ownership

| Data | Owner |
|---|---|
| Current Event | EventService |
| Capture Format | CaptureFormatService |
| Shot Count | CaptureFormat |
| Camera Connection | CameraService |
| Raw JPEG | PhotoStorage |
| Photo Pool | Session |
| Template List | TemplateService |
| Template Slot Config | Template |
| Shot → Slot Mapping | Assignment / Composition |
| Typed Text | Session Customization |
| Drawing | Session Customization |
| Master Output | CompositionEngine |
| Share Output | CompositionEngine |
| Print Output | CompositionEngine |
| QR URL | LocalShareService / ShareService |
| Print Job | PrintService |
| Session State | SessionController |

---

# 36. Frontend structure

```text
GuestApp
├── StartScreen
├── SelectShotScreen
├── CaptureScreen
├── TemplateScreen
├── CustomizeScreen
└── ResultScreen
```

Shared:

```text
components/
├── EventBranding
├── ResultSampleCard
├── ShotFormatCard
├── CameraLiveView
├── CountdownOverlay
├── ShotProgress
├── TemplateCard
├── TemplateLivePreview
├── EditableTextRegion
├── VirtualKeyboard
├── DrawCanvas
├── DrawToolbar
├── FinalPhotoPreview
├── QRCodeCard
├── PrintStatus
└── SessionCountdown
```

---

# 37. CameraOS Core structure

```text
CameraOS Core
├── SessionController
├── EventService
├── CaptureFormatService
├── CaptureManager
├── CameraService
│   ├── FakeCameraAdapter
│   ├── DeviceCameraAdapter
│   └── CanonAdapter / CanonCameraBridge / CanonEDSDKAdapter after physical spike
├── CanonCommandShadowLogger
├── PhotoStorage
├── TemplateService
├── AssignmentEngine
├── PreviewRenderer
├── CompositionEngine
├── LocalShareService / ShareService
└── PrintService
```

---

# 38. Ví dụ session 6 shots hoàn chỉnh

```text
START
 ↓
Create session
 ↓
Select 6 Shots
 ↓
captureFormat = format_6shot
 ↓
shotCount = 6
 ↓
Capture:
P1
P2
P3
P4
P5
P6
 ↓
Photo Pool ready
 ↓
TemplateService:
event = Wedding
format = 6shot
 ↓
Guest selects Template B
 ↓
Assignment:
P1→S1
P2→S2
P3→S3
P4→S4
P5→S5
P6→S6
 ↓
Template:
allowTyping = true
 ↓
Guest types:
"Happy Wedding"
 ↓
CompositionEngine
 ↓
final-master.png
final-share.jpg
final-print.jpg
 ↓
share.jpg → Cloud QR/Local Fallback
print.jpg → Guest-confirmed durable FIFO print queue
 ↓
Result Screen
 ↓
DONE or 120 sec
 ↓
Complete Session
 ↓
Reset Guest UI
 ↓
START
```

---

# 39. Session state machine

```text
CREATED
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
RESULT_READY
   ↓
COMPLETED
```

Optional error states:

```text
CAMERA_ERROR
CAPTURE_ERROR
IMAGE_ERROR
COMPOSITION_ERROR
PRINT_ERROR
```

---

# 40. Các nguyên tắc kỹ thuật bắt buộc

## 40.1 Guest UI không gọi hardware trực tiếp

Sai:

```text
React Button
→ Canon EDSDK
```

Đúng:

```text
Guest UI
→ SessionController
→ CaptureManager
→ CameraService
→ Active CameraAdapter
   ├── FakeCameraAdapter
   ├── DeviceCameraAdapter
   └── CanonAdapter after physical spike evidence
```

## 40.2 Template không chứa ảnh Guest

Template chỉ chứa:

```text
layout
slots
assets
text config
draw config
print config
```

Ảnh Guest thuộc Session.

## 40.3 Raw photo luôn được giữ

Không overwrite file original sau khi render.

## 40.4 Preview và Print Render khác nhau

Preview:

```text
optimized resolution
fast rendering
```

Print:

```text
full print resolution
high quality
correct DPI
```

## 40.5 Printer không block Guest UI

Print chạy thông qua queue.

## 40.6 Result timeout không disconnect camera

Chỉ reset Guest state.

---

# 41. Pipeline cốt lõi

Toàn bộ Photobooth có thể rút gọn thành:

```text
EVENT
  ↓
SHOT FORMAT
  ↓
CAPTURE
  ↓
PHOTO POOL
  ↓
EVENT TEMPLATE
  ↓
SHOT → SLOT ASSIGNMENT
  ↓
TEXT / DRAW
  ↓
COMPOSITION
  ↓
MASTER / SHARE / PRINT
  ↓
QR + PRINTER
  ↓
SESSION COMPLETE
```

---

# 42. Definition of Done cho một Guest Session

Một session chỉ được coi là hoàn thành khi:

- Capture Format đã được lưu.
- Đủ số ảnh theo shotCount.
- Tất cả ảnh original đã được lưu.
- Template đã được chọn.
- Shot → Slot mapping hoàn chỉnh.
- Custom text/drawing nếu có đã được lưu.
- Final composition render thành công.
- Share output đã tạo.
- Print output đã tạo.
- Cloud QR đã tạo hoặc có local/unavailable fallback.
- Print job durable FIFO đã được enqueue nếu V1 `GUEST_CONFIRM` print được bật và guest xác nhận in.
- Session state = `COMPLETED`.
- Guest UI được reset.
- Camera vẫn ở trạng thái READY cho Guest tiếp theo.

---

# 43. Source of Truth

Từ thời điểm này, flow chuẩn của MomentAI Photobooth là:

```text
START
↓
SELECT 1 / 2 / 4 / 6 SHOTS
↓
AUTO CAPTURE
↓
SELECT TEMPLATE THEO EVENT + SHOT FORMAT
↓
TYPE / DRAW NẾU TEMPLATE CHO PHÉP
↓
FINAL COMPOSITION
↓
RESULT + CLOUD QR/LOCAL FALLBACK + GUEST-CONFIRMED QUEUED PRINT
↓
DONE / 2-MINUTE TIMEOUT
↓
RESET
↓
START
```

Mọi thay đổi frontend, template system, camera flow hoặc print flow cần giữ tương thích với pipeline này.
