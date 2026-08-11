# MomentAI CameraOS — Guest Flow & Internal System Design
## Source of Truth for Product, UI/UX, Frontend, Camera Core, Backend & Printing

**Version:** 1.0  
**Target Camera:** Canon EOS 6D  
**Host:** macOS  
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
RESULT + QR
        │
        ├── Digital Output
        └── Auto Print
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
│          Guest UI           │
└──────────────┬──────────────┘
               │ IPC / Local API
               ▼
┌─────────────────────────────┐
│      Session Controller     │
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
 CanonAdapter
        │
        ▼
 Canon EDSDK
        │
        ▼
 Canon EOS 6D

                      Share ──→ QR / Delivery
                      Print ──→ Print Queue ──→ Printer
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
CanonEDSDKAdapter
   ↓
Canon EDSDK
   ↓
Canon EOS 6D
```

Guest UI không được gọi camera trực tiếp.

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
Canon EOS 6D
      ↓
Shutter
      ↓
Camera object event
      ↓
Download JPEG
      ↓
Validate JPEG
      ↓
StorageService.save()
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

- QR
- gallery
- cloud
- social

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

# 26. Screen 06 — RESULT + QR

Khi composition hoàn tất:

```text
Composition Complete
        │
        ├──────────────┐
        │              │
        ▼              ▼
 DeliveryService    PrintService
```

Hai luồng chạy song song.

---

# 27. QR / Digital flow

```text
final-share.jpg
      ↓
DeliveryService
      ↓
Local / Cloud Storage
      ↓
Session Download URL
      ↓
QR Generator
      ↓
QRCodeCard
```

Ví dụ:

```json
{
  "qr": {
    "url": "https://gallery.momentai.vn/s/abc123"
  }
}
```

---

# 28. Print flow

```text
final-print.jpg
      ↓
PrintService
      ↓
Create PrintJob
      ↓
Print Queue
      ↓
Printer Worker
      ↓
macOS Print System
      ↓
Photo Printer
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
├── QRCodeCard
├── PrintStatus
├── SessionCountdown
└── DoneButton
```

Guest thấy:

```text
Final Photo

QR Code

"Quét để tải ảnh"

"Ảnh đang được in..."

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
  "printStatus": "printing",
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
Connect Canon EOS 6D
      ↓
Keep Camera Session Alive
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
       Canon EOS 6D
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
             QR   PrintQueue
              │      │
              ▼      ▼
┌───────────────────────────┐
│    FINAL RESULT SCREEN    │
│                           │
│ Final Image               │
│ QR                        │
│ Print Status              │
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
| QR URL | DeliveryService |
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
│   └── CanonEDSDKAdapter
├── PhotoStorage
├── TemplateService
├── AssignmentEngine
├── PreviewRenderer
├── CompositionEngine
├── DeliveryService
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
share.jpg → QR
print.jpg → Print Queue
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
→ CanonAdapter
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
- QR đã tạo hoặc có fallback.
- Print job đã được enqueue nếu Auto Print bật.
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
RESULT + QR + AUTO PRINT
↓
DONE / 2-MINUTE TIMEOUT
↓
RESET
↓
START
```

Mọi thay đổi frontend, template system, camera flow hoặc print flow cần giữ tương thích với pipeline này.
