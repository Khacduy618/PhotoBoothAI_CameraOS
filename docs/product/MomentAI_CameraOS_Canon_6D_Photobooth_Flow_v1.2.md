# MOMENTAI CAMERAOS
## Tài liệu thiết kế flow Photobooth với Canon EOS 6D

**Phiên bản:** 1.2  
**Ngày cập nhật:** 03/08/2026  
**Phạm vi:** Canon EOS 6D đời đầu (2012), Photobooth chạy tại sự kiện, tự động Live View - chụp nhiều lần - ghép khung - lưu phiên - in ảnh.

> Lưu ý: tài liệu này mặc định nói về **Canon EOS 6D đời đầu**, không phải EOS 6D Mark II. Nếu dùng 6D Mark II, kiến trúc tổng thể vẫn giữ nguyên nhưng cần kiểm tra lại phiên bản EDSDK, firmware và các thuộc tính camera hỗ trợ.

## Điểm cập nhật trong phiên bản 1.2

Phần **[6. System Design: kết nối và vận hành Canon EOS 6D với máy Mac](#6-system-design-kết-nối-và-vận-hành-canon-eos-6d-với-máy-mac)** đã được bổ sung trực tiếp trong file Markdown. Phần này bao gồm:

- Sơ đồ kết nối vật lý Canon 6D, máy Mac, màn hình, máy in và nguồn điện.
- Sơ đồ các process/service chạy trên macOS.
- Cơ chế Camera Worker giữ độc quyền EDSDK session và camera handle.
- Luồng Live View, trigger chụp, nhận event và tải JPEG về Mac.
- Luồng xử lý ảnh, ghép layout, print queue, reconnect, timeout và retry.
- Checklist xác nhận kết nối Canon 6D ↔ Mac hoạt động đúng.

---

# 1. Mục tiêu hệ thống

MomentAI CameraOS là lớp nền tảng điều khiển thiết bị và phiên chụp. Photobooth là ứng dụng đầu tiên chạy trên CameraOS.

Một phiên Photobooth hoàn chỉnh phải thực hiện được:

1. Khởi động và kiểm tra Canon EOS 6D, máy in, thư mục lưu trữ và tài nguyên khung.
2. Hiển thị Live View để khách căn chỉnh tư thế.
3. Cho khách chọn layout, frame, countdown và số bản in.
4. Tự động chụp đúng số ảnh mà layout yêu cầu.
5. Nhận và tải file JPEG gốc từ camera về máy tính.
6. Cho phép chụp lại nếu cần.
7. Crop, resize, áp dụng filter và ghép ảnh theo layout.
8. Xuất riêng file master, file chia sẻ và file in.
9. Đưa lệnh in vào hàng đợi, tránh in trùng hoặc mất phiên.
10. Lưu đầy đủ metadata để có thể khôi phục, in lại và đồng bộ cloud sau này.

---

# 2. Vì sao Canon EOS 6D không dùng CCAPI

Canon EOS 6D có Wi-Fi tích hợp nhưng **không có nghĩa là camera cung cấp Canon Camera Control API (CCAPI)**. Đối với EOS 6D đời đầu, hướng triển khai phù hợp cho Photobooth là kết nối USB và điều khiển bằng EDSDK hoặc một lớp PTP tương thích đã được kiểm thử.

CCAPI là API HTTP/REST dành cho các model Canon được hỗ trợ cụ thể. Wi-Fi của EOS 6D chủ yếu phục vụ phần mềm và ứng dụng Canon, không biến camera thành một REST server mà CameraOS có thể gọi tự do.

Với Photobooth, USB còn có lợi thế:

- Kết nối vật lý ổn định hơn mạng Wi-Fi tại sự kiện.
- Trigger chụp và nhận sự kiện ảnh mới có tính xác định cao hơn.
- Tải JPEG gốc nhanh và ít phụ thuộc chất lượng mạng.
- Không bị nhiễu bởi hàng trăm điện thoại hoặc access point tại địa điểm.
- Dễ triển khai watchdog, reconnect và kiểm tra trạng thái thiết bị.

**Kết luận:**

```text
Canon EOS 6D đời đầu
    ├── USB + EDSDK: Live View, trigger, download JPEG, đọc/ghi settings
    └── HDMI + capture card: preview tùy chọn, không dùng làm ảnh in cuối
```

---

# 3. Kiến trúc kết nối phần cứng

## 3.1. Kết nối tối thiểu cho MVP

```text
Canon EOS 6D
    │
    ├── USB Mini-B ───────────────► Máy tính chạy CameraOS
    │                                - Live View
    │                                - Điều khiển chụp
    │                                - Tải JPEG gốc
    │
    ├── Hot shoe / sync ──────────► Flash hoặc trigger đèn
    │
    └── Dummy battery / AC adapter ► Nguồn liên tục

Máy tính CameraOS
    ├── USB ──────────────────────► Máy in ảnh
    ├── Màn hình cảm ứng ─────────► Giao diện khách hàng
    └── SSD nội bộ ───────────────► Lưu phiên và hàng đợi in
```

## 3.2. Kết nối có HDMI preview

```text
Canon EOS 6D
    ├── USB ───────────────► Camera Control Service
    └── HDMI ─► Capture Card ─► Preview Service
```

HDMI chỉ nên là lựa chọn bổ sung khi Live View qua EDSDK không đủ mượt. Ảnh in cuối phải lấy từ JPEG gốc do camera tạo ra, không lấy frame từ capture card.

## 3.3. Thiết bị khuyến nghị

- Canon EOS 6D và lens phù hợp không gian, ví dụ 24-70 mm hoặc prime 35/50 mm.
- Cáp USB Mini-B tốt, chiều dài vừa đủ, có kẹp chống tuột.
- Dummy battery hoặc bộ AC adapter tương thích.
- Tripod chắc chắn.
- Đèn flash studio hoặc LED có ánh sáng ổn định.
- Màn hình cảm ứng cho khách.
- Máy tính có SSD và đủ cổng USB.
- Máy in ảnh dye-sublimation hoặc máy in hỗ trợ driver ổn định.
- UPS cho máy tính, màn hình và hệ thống mạng nếu dùng cloud.

---

# 4. Thiết lập Canon EOS 6D trước sự kiện

## 4.1. Thiết lập chụp đề xuất

```text
Mode                 : M
Image quality        : JPEG Large/Fine
ISO                  : 100-800 tùy ánh sáng
Shutter speed        : khoảng 1/125 s hoặc phù hợp flash
Aperture             : f/5.6-f/8 cho nhóm người
White balance        : cố định, không Auto nếu ánh sáng ổn định
Picture Style        : Neutral/Standard tùy pipeline màu
Auto power off       : Disable
Image review         : Off hoặc ngắn nhất
Long exposure NR     : Off
High ISO NR          : Low/Standard tùy nhu cầu
Wi-Fi                : Off khi điều khiển qua USB
Storage              : Host hoặc Host + Camera tùy EDSDK/model
```

## 4.2. Focus

Hai phương án:

**Manual Focus - ưu tiên cho booth cố định**

- Đánh dấu vị trí đứng.
- Lấy nét trước tại khoảng cách đó.
- Chuyển lens sang MF.
- Tránh camera hunting hoặc chụp trượt vì ánh sáng tối.

**Autofocus**

- Dùng One Shot AF.
- Có ánh sáng hỗ trợ lấy nét.
- CameraService phải xử lý trường hợp không khóa được AF.
- Không để Continuous AF chạy liên tục nếu gây nóng hoặc chậm.

## 4.3. Kiểm tra trước khi vận hành

- Camera nhận USB ổn định.
- Không mở EOS Utility đồng thời với CameraOS.
- Pin giả hoạt động liên tục ít nhất vài giờ.
- Thẻ nhớ không đầy nếu bật lưu song song.
- Lens đúng tiêu cự và không bị chuyển nhầm sang MF/AF.
- Flash/đèn đồng bộ đúng.
- Đồng hồ camera và máy tính gần đúng để hỗ trợ audit.

---

# 5. Kiến trúc phần mềm CameraOS

```text
┌───────────────────────────────────────────────┐
│                Photobooth UI                  │
│ Attract / Layout / Frame / Countdown / Review│
└──────────────────────┬────────────────────────┘
                       │ IPC / WebSocket
┌──────────────────────▼────────────────────────┐
│               Session Controller              │
│ State machine của toàn bộ một phiên chụp      │
└───────┬───────────┬───────────┬───────────────┘
        │           │           │
        ▼           ▼           ▼
 Camera Service  Composition  Print Service
 EDSDK Adapter   Service      Queue + Adapter
        │           │           │
        ▼           ▼           ▼
 Canon EOS 6D   Final images   Printer/Driver

                  ┌─────────────┐
                  │Storage/DB   │
                  │SQLite/files │
                  └─────────────┘
```

## 5.1. Các service chính

### DeviceMonitor

- Kiểm tra camera, printer, disk, nguồn và kết nối.
- Phát hiện disconnect/reconnect.
- Cập nhật health status cho kỹ thuật viên.

### CanonEdsdkAdapter

- Initialize/terminate EDSDK.
- Liệt kê camera và mở session.
- Start/stop EVF Live View.
- Trigger shutter.
- Nhận object event và tải JPEG.
- Đọc/ghi ISO, Tv, Av, white balance nếu model hỗ trợ.
- Chuyển lỗi native thành lỗi chuẩn của CameraOS.

### LiveViewService

- Nhận EVF frames.
- Giới hạn FPS phù hợp để UI không quá tải.
- Chèn guide nhẹ trên preview.
- Không thực hiện render frame in độ phân giải cao.

### SessionController

- Quản lý state machine.
- Tạo session ID.
- Điều phối countdown, capture, download, review, compose và print.
- Không để UI gọi trực tiếp EDSDK.

### CompositionService

- Đọc template/layout config.
- Auto-rotate theo EXIF.
- Crop theo slot và ưu tiên khuôn mặt nếu có.
- Resize, filter, overlay, logo, QR.
- Tạo master/share/print output.

### PrintService

- Tạo print job.
- Queue, retry, timeout và chống duplicate.
- Lưu trạng thái in.
- Cho phép kỹ thuật viên reprint.

### StorageService

- Lưu session metadata.
- Lưu originals và outputs.
- Atomic write để tránh file hỏng.
- Dọn cache nhưng không xóa originals khi chưa có chính sách retention.

---

# 6. System Design: kết nối và vận hành Canon EOS 6D với máy Mac

Phần này mô tả rõ hai lớp cần phân biệt:

- **Kết nối vật lý:** Canon EOS 6D, cáp USB, máy Mac, màn hình và máy in.
- **Kết nối phần mềm:** EDSDK, Camera Worker, Session Controller, UI, xử lý ảnh và hàng đợi in.

Mục tiêu là để CameraOS luôn giữ quyền điều khiển camera ổn định, không để giao diện hoặc một tiến trình khác gọi camera trực tiếp.

## 6.1. Sơ đồ kết nối vật lý

```text
                         ┌────────────────────────┐
                         │      Canon EOS 6D      │
                         │ JPEG Large/Fine + M    │
                         └───────────┬────────────┘
                                     │ USB Mini-B
                                     │ Control + EVF + JPEG transfer
                                     ▼
┌──────────────────┐       ┌────────────────────────────┐
│ Màn hình cảm ứng │◄─────►│          Máy Mac           │
│ UI cho khách     │ HDMI/ │                            │
└──────────────────┘ USB-C │ CameraOS Desktop App       │
                           │ Camera Worker + EDSDK      │
                           │ Image Processor + SQLite   │
                           │ Print Queue                │
                           └───────┬───────────┬────────┘
                                   │           │
                              USB/CUPS     SSD nội bộ
                                   │           │
                                   ▼           ▼
                           ┌────────────┐  sessions/
                           │ Máy in ảnh│  logs/
                           └────────────┘  print-queue/

Nguồn độc lập:
Canon 6D ← Dummy battery/AC adapter
Máy Mac + màn hình + máy in ← ổ điện ổn định hoặc UPS
```

### Quy tắc kết nối

1. Canon 6D chỉ có **một tiến trình Camera Worker** được phép mở EDSDK session.
2. UI giao tiếp với Camera Worker bằng IPC/WebSocket cục bộ, không gọi EDSDK trực tiếp.
3. Ảnh in lấy từ JPEG gốc tải qua USB, không lấy từ Live View hoặc HDMI capture.
4. Không chạy EOS Utility, Lightroom tethering hoặc ứng dụng khác đồng thời.
5. Nên cắm camera trực tiếp vào Mac; tránh hub không có nguồn cho đường camera.
6. Cáp camera phải có kẹp giữ cáp để tránh rung hoặc tuột khi booth hoạt động.

## 6.2. Sơ đồ component chạy trên máy Mac

```text
┌─────────────────────────────────────────────────────────────┐
│                       CameraOS trên macOS                    │
│                                                             │
│  ┌──────────────────────┐       IPC       ┌───────────────┐ │
│  │ Photobooth UI        │◄───────────────►│ App Backend   │ │
│  │ React/Electron/Tauri │                 │ API Gateway   │ │
│  └──────────────────────┘                 └───────┬───────┘ │
│                                                   │ commands │
│                                        events     ▼          │
│  ┌──────────────────────┐               ┌──────────────────┐ │
│  │ Session Controller   │◄─────────────►│ Camera Worker    │ │
│  │ State machine        │               │ single process   │ │
│  └──────┬───────┬───────┘               └────────┬─────────┘ │
│         │       │                                 │ EDSDK     │
│         │       ├──────────────┐                  ▼           │
│         │                      │          ┌─────────────────┐ │
│         ▼                      ▼          │ Canon EOS 6D    │ │
│  ┌─────────────┐       ┌─────────────┐   │ USB/PTP session │ │
│  │ Composition │       │ Print Worker│   └─────────────────┘ │
│  │ Sharp/OpenCV│       │ CUPS/driver │                       │
│  └──────┬──────┘       └──────┬──────┘                       │
│         └──────────┬───────────┘                              │
│                    ▼                                          │
│          ┌──────────────────────┐                              │
│          │ Storage + SQLite     │                              │
│          │ sessions/jobs/logs   │                              │
│          └──────────────────────┘                              │
└─────────────────────────────────────────────────────────────┘
```

### Trách nhiệm và tiến trình

| Thành phần | Chạy ở đâu | Trách nhiệm chính | Không được làm |
|---|---|---|---|
| Photobooth UI | Renderer/UI process | Hiển thị Live View, lựa chọn, countdown, tiến độ | Gọi EDSDK hoặc gửi lệnh in trực tiếp |
| App Backend | Main process | IPC, xác thực command, chuyển event về UI | Giữ logic capture phức tạp trong UI |
| Session Controller | Main/Core process | Điều phối state machine của một phiên | Chạm trực tiếp vào native pointer của EDSDK |
| Camera Worker | Native child process/service | Sở hữu duy nhất EDSDK session và camera handle | Render frame, ghép layout hoặc in |
| Composition Worker | Worker process | Decode, crop, resize, ghép frame, xuất ảnh | Chặn Camera Worker trong lúc xử lý ảnh |
| Print Worker | Background worker | Queue, gửi CUPS/driver, retry, reprint | Nhận click UI rồi in ngay không qua queue |
| Storage/SQLite | Local disk | Metadata, originals, outputs, print jobs, recovery | Chỉ lưu trạng thái trong RAM |

## 6.3. Camera Worker và cơ chế giữ camera

Camera Worker phải là **single owner** của Canon EOS 6D. Khi hệ thống khởi động, worker mở session một lần và giữ session trong suốt thời gian vận hành. Không mở/đóng session sau từng ảnh vì sẽ làm tăng độ trễ và dễ phát sinh lỗi thiết bị bận.

```text
START WORKER
   ↓
Initialize EDSDK
   ↓
Discover Canon EOS 6D
   ↓
Acquire camera lock trong CameraOS
   ↓
Open EDSDK session
   ↓
Register object/property/state callbacks
   ↓
Set save destination và capacity
   ↓
Start EVF Live View
   ↓
CAMERA_READY
   ↓
Giữ session + bơm event loop liên tục
```

Camera Worker nên có các command giới hạn:

```text
camera.connect
camera.disconnect
camera.startLiveView
camera.stopLiveView
camera.capture
camera.download
camera.getProperties
camera.setProperty
camera.keepAlive
camera.reset
```

Và phát các event chuẩn hóa:

```text
camera.connected
camera.ready
camera.liveViewFrame
camera.captureStarted
camera.imageAvailable
camera.imageDownloaded
camera.busy
camera.disconnected
camera.error
```

Mỗi command cần có `commandId`, timeout và kết quả rõ ràng để Session Controller không gửi trùng lệnh shutter.

## 6.4. Luồng Live View từ Canon 6D lên màn hình Mac

```text
Canon EOS 6D
   │ EVF frame qua EDSDK
   ▼
Camera Worker
   │ decode hoặc chuyển JPEG buffer
   ▼
LiveView Frame Buffer
   │ giữ frame mới nhất, bỏ frame cũ nếu UI chậm
   ▼
IPC/WebSocket local
   ▼
Photobooth UI
   │ overlay guide/countdown bằng UI layer
   ▼
Màn hình cảm ứng
```

Nguyên tắc vận hành:

- Ưu tiên độ trễ thấp hơn việc hiển thị mọi frame.
- Chỉ giữ **latest frame** để tránh tăng RAM và backlog.
- Có thể giới hạn 12-20 FPS tùy Mac và độ ổn định của EDSDK.
- Guide, countdown và hiệu ứng được vẽ tại UI, không ghi vào ảnh gốc.
- Nếu không nhận frame trong khoảng timeout, DeviceMonitor đánh dấu Live View degraded và yêu cầu worker restart EVF.

## 6.5. Sequence chụp một ảnh và tải về Mac

```text
Khách/UI          Session Controller       Camera Worker        Canon 6D          Storage
   │                      │                       │                  │                 │
   │ Start capture        │                       │                  │                 │
   ├─────────────────────►│                       │                  │                 │
   │                      │ Countdown             │                  │                 │
   │◄─────────────────────┤                       │                  │                 │
   │                      │ camera.capture(id)    │                  │                 │
   │                      ├──────────────────────►│ shutter command  │                 │
   │                      │                       ├─────────────────►│                 │
   │                      │                       │ object event     │                 │
   │                      │                       │◄─────────────────┤                 │
   │                      │                       │ download JPEG    │                 │
   │                      │                       ├──────────────────┼────────────────►│
   │                      │ imageDownloaded      │                  │ atomic rename   │
   │                      │◄──────────────────────┤                  │                 │
   │ Capture completed    │ validate + next      │                  │                 │
   │◄─────────────────────┤                       │                  │                 │
```

### Điều kiện được xem là chụp thành công

Một lần chụp chỉ hoàn thành khi thỏa tất cả điều kiện:

1. Canon nhận shutter command.
2. Camera phát object event cho ảnh mới.
3. JPEG được tải hết vào file tạm.
4. File JPEG decode được và có kích thước hợp lệ.
5. File tạm được atomic rename sang `capture_NN.jpg`.
6. Metadata capture được commit vào SQLite/session.json.

Không tăng `captureIndex` chỉ vì shutter command đã gửi thành công.

## 6.6. Luồng chụp nhiều ảnh theo layout

```text
Layout selected
   ↓
Read captureCount từ layout config
   ↓
FOR index = 1..captureCount
   ├─ Verify camera = READY
   ├─ Countdown
   ├─ Trigger một commandId duy nhất
   ├─ Wait imageDownloaded hoặc timeout
   ├─ Validate + persist
   ├─ Show thumbnail
   └─ Delay giữa hai ảnh
   ↓
All captures persisted
   ↓
Composition Worker
   ↓
Create master/share/print
   ↓
Queue print job
```

Session Controller phải serialize capture: tại một thời điểm chỉ có một ảnh ở trạng thái `CAPTURING` hoặc `DOWNLOADING`. Không gửi lần chụp tiếp theo khi JPEG trước chưa lưu xong.

## 6.7. Luồng xử lý ảnh và in trên Mac

```text
originals/capture_01..NN.jpg
          │
          ▼
Composition Worker
  1. đọc EXIF + auto rotate
  2. kiểm tra orientation
  3. crop theo slot/face-aware crop
  4. resize theo canvas
  5. filter/màu
  6. frame, logo, text, QR
          │
          ├──► final-master.png
          ├──► final-share.jpg
          └──► final-print.jpg
                         │
                         ▼
                    Print Queue
                         │
                         ▼
                 Print Worker/CUPS
                         │
                         ▼
                     Máy in ảnh
```

Camera Worker và Print Worker phải độc lập. Trong khi ảnh của phiên A đang in, camera vẫn có thể chuẩn bị phiên B nếu tài nguyên Mac đáp ứng và nghiệp vụ cho phép.

## 6.8. Health state giữa Canon 6D và Mac

| Health state | Ý nghĩa | UI khách | Hành động hệ thống |
|---|---|---|---|
| `DISCONNECTED` | Mac không thấy camera | Khóa nút bắt đầu | Quét thiết bị, chờ reconnect |
| `CONNECTING` | Đang initialize/open session | Hiện “Đang kết nối camera” | Không nhận capture command |
| `READY` | Session mở, có thể chụp | Cho phép bắt đầu | Keep-alive và theo dõi event |
| `LIVE_VIEW_DEGRADED` | Có camera nhưng EVF không cập nhật | Hiện cảnh báo nhẹ hoặc pause | Restart EVF, không đóng session ngay |
| `BUSY` | Camera đang ghi/tải ảnh | Khóa thao tác chụp | Chờ object/download complete |
| `RECOVERING` | Worker đang reconnect/reset | Chuyển màn hình kỹ thuật | Recreate worker/session |
| `FATAL` | Lỗi lặp lại hoặc SDK không khởi tạo | Dừng booth | Yêu cầu kỹ thuật viên kiểm tra |

## 6.9. Reconnect khi cáp USB bị rút

```text
USB disconnected
   ↓
Camera Worker phát camera.disconnected
   ↓
Session Controller đóng băng capture hiện tại
   ↓
Đánh dấu session = INTERRUPTED, không xóa ảnh đã tải
   ↓
Terminate worker cũ nếu handle bị treo
   ↓
DeviceMonitor phát hiện lại Canon 6D
   ↓
Tạo Camera Worker mới
   ↓
Initialize EDSDK + Open Session + Start EVF
   ↓
Đối chiếu captureIndex với file/DB
   ↓
Cho phép chụp lại ảnh còn thiếu hoặc tiếp tục session
```

Không nên cố tái sử dụng native camera handle sau khi USB đã mất. Cách an toàn là huỷ worker bị lỗi và tạo worker mới để tránh EDSDK session ở trạng thái không xác định.

## 6.10. Timeout và retry đề xuất

| Hoạt động | Timeout khởi điểm | Retry | Sau khi thất bại |
|---|---:|---:|---|
| Tìm camera | 10 giây | liên tục theo chu kỳ | Giữ booth ở maintenance |
| Open session | 8 giây | 2 | Restart Camera Worker |
| Nhận Live View frame | 3 giây | 2 lần restart EVF | Reconnect session |
| Trigger shutter | 5 giây | Không gửi lại mù quáng | Kiểm tra object event trước |
| Download JPEG | 20 giây | 1-2 | Giữ captureIndex, cho chụp lại |
| Compose ảnh | 30 giây | 1 | Đưa session vào recovery |
| Gửi print job | 15 giây | Theo print policy | Giữ job trong queue |

Các giá trị trên là điểm bắt đầu; cần đo thực tế với cáp, file JPEG, Mac và máy in được sử dụng.

## 6.11. Cấu trúc IPC gợi ý

Command từ Session Controller:

```json
{
  "commandId": "cmd_01HXYZ",
  "type": "camera.capture",
  "sessionId": "session_20260803_170501_A8F2",
  "captureIndex": 2,
  "timeoutMs": 20000
}
```

Event từ Camera Worker:

```json
{
  "event": "camera.imageDownloaded",
  "commandId": "cmd_01HXYZ",
  "sessionId": "session_20260803_170501_A8F2",
  "captureIndex": 2,
  "path": "originals/capture_02.jpg",
  "width": 5472,
  "height": 3648,
  "bytes": 8245120
}
```

`commandId` giúp chống duplicate và liên kết đúng event với lần chụp. `sessionId` ngăn ảnh của phiên cũ bị gắn nhầm vào phiên mới.

## 6.12. Deployment đề xuất trên macOS

```text
MomentAI CameraOS.app
├── UI/Main Process
├── camera-worker
│   └── Canon EDSDK dylib/framework
├── composition-worker
├── print-worker
├── resources/
│   ├── layouts/
│   ├── frames/
│   └── fonts/
└── Application Support/MomentAI CameraOS/
    ├── cameraos.db
    ├── sessions/
    ├── print-queue/
    ├── logs/
    └── recovery/
```

CameraOS cần kiểm tra quyền truy cập thiết bị, quyền ghi thư mục Application Support và khả năng gọi CUPS/driver máy in. Các native library phải được đóng gói đúng kiến trúc CPU của máy Mac và ký ứng dụng phù hợp khi phát hành.

## 6.13. Checklist xác nhận hệ thống đã kết nối đúng

- macOS nhận Canon EOS 6D trong System Information/USB.
- Camera Worker tìm thấy đúng model và serial nếu SDK trả về.
- EDSDK session mở thành công; EOS Utility không chạy.
- Live View có frame liên tục và không tăng RAM theo thời gian.
- Chụp thử nhận đúng một object event cho mỗi command.
- JPEG tải về đúng độ phân giải gốc của camera.
- Rút và cắm lại USB có thể recover mà không restart toàn bộ máy Mac.
- Composition Worker xử lý ảnh trong khi Camera Worker vẫn phản hồi health check.
- Print job được lưu trước khi gửi máy in và có thể reprint.
- Restart ứng dụng vẫn đọc lại được session và print queue chưa hoàn thành.

---

# 7. Flow khởi động CameraOS

```text
BOOTING
   ↓
LOAD_CONFIGURATION
   ↓
CHECK_STORAGE
   ↓
INITIALIZE_DATABASE
   ↓
CHECK_CAMERA
   ↓
OPEN_CAMERA_SESSION
   ↓
CHECK_PRINTER
   ↓
LOAD_LAYOUTS_AND_FRAMES
   ↓
START_LIVE_VIEW
   ↓
READY / IDLE
```

## 7.1. Checklist startup

1. Đọc file cấu hình môi trường.
2. Tạo lock file để tránh chạy hai instance CameraOS.
3. Kiểm tra thư mục có quyền ghi.
4. Kiểm tra dung lượng trống tối thiểu.
5. Mở SQLite và chạy migration nếu cần.
6. Initialize EDSDK.
7. Tìm Canon EOS 6D theo device identifier.
8. Open camera session.
9. Đặt save destination phù hợp.
10. Register property, state và object events.
11. Start Live View.
12. Kiểm tra printer và paper profile.
13. Load layout/frame assets và validate dimensions.
14. Khôi phục print jobs chưa hoàn tất sau lần crash trước.
15. Chuyển hệ thống sang READY.

## 7.2. Khi camera chưa kết nối

```text
CAMERA_DISCONNECTED
    ├── Hiển thị màn hình kỹ thuật viên
    ├── Disable nút bắt đầu phiên
    ├── Tự scan lại theo chu kỳ
    └── Khi phát hiện camera: open session → start live view → READY
```

## 7.3. Khi máy in offline

Có hai policy:

- **Strict:** không cho bắt đầu phiên mới.
- **Capture-first:** vẫn cho chụp, lưu output và giữ print job trong queue.

Với sự kiện, nên dùng Capture-first và hiển thị cảnh báo rõ cho nhân viên.

---

# 8. Flow giao diện khách hàng

## 8.1. Attract Screen

```text
Logo / video giới thiệu
"Chạm để bắt đầu"
```

Khi khách chạm:

- Tạo session draft.
- Reset cấu hình từ phiên trước.
- Bắt đầu timeout phiên.

## 8.2. Chọn layout

Ví dụ:

| Layout | Số lần chụp | Dạng output |
|---|---:|---|
| 1 ảnh lớn | 1 | 4x6 hoặc digital |
| 3 ảnh dọc | 3 | Photo strip |
| 2x2 | 4 | Grid 4 ảnh |
| 1x4 | 4 | Strip 4 ảnh |
| 2x3 | 6 | Grid 6 ảnh |

Số lần chụp được lấy từ `captureCount` của layout, không cho UI tự đoán.

## 8.3. Chọn frame

- Frame theo sự kiện.
- Sticker.
- Logo thương hiệu.
- Tên sự kiện và ngày.
- Text tùy chỉnh nếu business flow cho phép.

## 8.4. Chọn countdown

- 3 giây.
- 6 giây.
- 8 giây.
- 10 giây.

Cần tách:

- `countdownSeconds`: thời gian chuẩn bị trước mỗi ảnh.
- `intervalSeconds`: thời gian nghỉ sau khi tải ảnh và trước ảnh tiếp theo.

## 8.5. Chọn số bản in

Có thể giới hạn theo gói:

- 1 bản.
- 2 bản.
- Không in, chỉ nhận QR.

## 8.6. Xác nhận

Hiển thị tóm tắt:

```text
Layout: 2x2
Số ảnh: 4
Countdown: 6 giây
Frame: Wedding White
Bản in: 2
```

---

# 9. Flow Live View

```text
Canon EOS 6D
   ↓ EVF frame qua EDSDK
CanonEdsdkAdapter
   ↓
LiveViewService
   ↓
Shared frame buffer / IPC
   ↓
Photobooth UI
```

Preview có thể hiển thị:

- Safe area theo tỷ lệ layout.
- Hướng dẫn vị trí khuôn mặt.
- Số ảnh hiện tại.
- Countdown.
- Trạng thái "Đang chụp" hoặc "Đang lưu ảnh".

Không nên:

- Áp filter nặng trực tiếp vào mỗi EVF frame.
- Render full-resolution frame overlay trong preview.
- Cho nhiều component cùng đọc EDSDK stream.
- Dùng HDMI frame làm ảnh gốc.

Live View cần watchdog. Nếu không nhận frame trong khoảng timeout:

```text
EVF_STALLED
→ stop EVF
→ wait ngắn
→ start EVF lại
→ nếu thất bại: reconnect camera session
```

---

# 10. Flow tự động chụp theo layout

Ví dụ layout 2x2:

```json
{
  "id": "layout_2x2",
  "captureCount": 4,
  "countdownSeconds": 6,
  "intervalSeconds": 3
}
```

State machine cho một ảnh:

```text
PREPARE_CAPTURE
    ↓
COUNTDOWN
    ↓
TRIGGER_CAPTURE
    ↓
WAIT_CAMERA_EVENT
    ↓
DOWNLOAD_ORIGINAL
    ↓
VALIDATE_IMAGE
    ↓
GENERATE_THUMBNAIL
    ↓
SHOW_QUICK_PREVIEW
    ↓
NEXT_CAPTURE / REVIEW
```

## 10.1. Pseudo-code

```ts
for (let index = 1; index <= session.captureCount; index++) {
  await showCapturePosition(index, session.captureCount);
  await runCountdown(session.countdownSeconds);

  const requestId = createCaptureRequest(session.id, index);
  await camera.capture(requestId);

  const captured = await camera.waitForNewImage({
    requestId,
    timeoutMs: 15000,
  });

  const localFile = await camera.downloadImage(captured, {
    destination: session.originalPath(index),
  });

  await imageValidator.validate(localFile);
  await storage.markCaptureCompleted(session.id, index, localFile);
  await ui.showCapturePreview(localFile);

  if (index < session.captureCount) {
    await delay(session.intervalSeconds * 1000);
  }
}
```

## 10.2. Trigger và nhận file

Quy trình logic:

```text
SessionController
→ CanonEdsdkAdapter.capture()
→ Canon EOS 6D chụp
→ Object event báo có item mới
→ Adapter lấy metadata item
→ Download stream về file tạm
→ Verify file
→ Rename atomic thành capture_XX.jpg
→ Complete transfer
```

## 10.3. Không tăng index khi ảnh chưa hợp lệ

Nếu capture 03 lỗi:

```text
captureIndex vẫn là 3
→ retry download
→ nếu không được: chụp lại ảnh 3
→ chỉ chuyển sang ảnh 4 sau khi ảnh 3 VALID
```

---

# 11. Validate ảnh và xử lý lỗi

Mỗi file ảnh cần kiểm tra:

- File tồn tại.
- Kích thước lớn hơn ngưỡng tối thiểu.
- Giải mã JPEG thành công.
- Chiều rộng/chiều cao hợp lệ.
- Không trùng checksum với ảnh trước ngoài ý muốn.
- EXIF có thể đọc được hoặc pipeline xử lý được khi thiếu EXIF.

Kiểm tra nâng cao tùy chọn:

- Có ít nhất một khuôn mặt.
- Ảnh không quá tối/sáng.
- Blur score không dưới ngưỡng.
- Khuôn mặt không bị crop ngoài safe area.
- Mắt nhắm hoặc biểu cảm chưa đạt.

Các lỗi quan trọng:

| Mã lỗi | Xử lý |
|---|---|
| CAMERA_BUSY | Chờ ngắn và retry có giới hạn |
| CAPTURE_TIMEOUT | Kiểm tra event, reconnect nếu cần |
| DOWNLOAD_FAILED | Retry stream, không tăng capture index |
| JPEG_INVALID | Xóa file tạm và chụp lại |
| STORAGE_FULL | Dừng phiên an toàn, không tiếp tục chụp |
| CAMERA_DISCONNECTED | Giữ session, hướng dẫn cắm lại USB |
| FLASH_NOT_FIRED | Cảnh báo/chụp lại nếu có cơ chế phát hiện |

---

# 12. Review và chụp lại

## 12.1. Fast mode

Phù hợp sự kiện đông:

```text
Chụp đủ → tự động compose → in → QR → hoàn tất
```

## 12.2. Review mode

Hiển thị thumbnails và cho phép:

- Chụp lại một vị trí.
- Đổi vị trí ảnh.
- Chọn filter.
- Xác nhận để ghép.

Khi chụp lại ảnh 2:

```text
originals/capture_02.jpg
→ archive/capture_02_v1.jpg

ảnh mới
→ originals/capture_02.jpg
```

Metadata vẫn lưu lịch sử để audit. Nên giới hạn số lần retake để tránh nghẽn hàng.

---

# 13. Định nghĩa layout và frame

## 13.1. Layout config mẫu

```json
{
  "id": "layout_2x2_4x6",
  "name": "2 x 2 - 4x6",
  "captureCount": 4,
  "canvas": {
    "width": 1200,
    "height": 1800,
    "dpi": 300
  },
  "slots": [
    { "index": 1, "x": 60,  "y": 120, "width": 520, "height": 700 },
    { "index": 2, "x": 620, "y": 120, "width": 520, "height": 700 },
    { "index": 3, "x": 60,  "y": 860, "width": 520, "height": 700 },
    { "index": 4, "x": 620, "y": 860, "width": 520, "height": 700 }
  ],
  "assets": {
    "background": "background.png",
    "overlay": "overlay.png"
  }
}
```

## 13.2. Cấu trúc frame

```text
frames/
└── wedding-white-01/
    ├── frame.json
    ├── thumbnail.jpg
    ├── background.png
    ├── overlay.png
    ├── stickers/
    └── fonts/
```

## 13.3. Thứ tự render

```text
Canvas/background
→ Photo slots
→ Color correction/filter
→ Decorative overlay
→ Stickers
→ Logo
→ Event name/date
→ QR code nếu dùng
```

---

# 14. Pipeline xử lý ảnh

## 14.1. Xử lý từng ảnh

```text
JPEG gốc
→ Verify
→ Auto-rotate theo EXIF
→ Decode sang working color space
→ White balance/color correction tùy chọn
→ Detect face tùy chọn
→ Crop theo tỷ lệ slot
→ Resize chất lượng cao
→ Sharpen nhẹ sau resize
→ Insert vào canvas
```

## 14.2. Crop đúng cách

Không kéo giãn ảnh để vừa slot.

Dùng cover crop:

```text
scale ảnh để phủ kín slot
→ crop phần dư
→ ưu tiên giữ khuôn mặt và khoảng trống phía trên đầu
```

## 14.3. Ba output riêng

### Master

- PNG hoặc TIFF tùy pipeline.
- Độ phân giải đầy đủ.
- Dùng re-render/in lại.

### Share

- JPEG quality khoảng 85-90.
- Kích thước tối ưu cho QR/cloud.
- Có thể thêm watermark nhẹ.

### Print

- JPEG quality cao.
- Kích thước đúng paper profile.
- Có bleed/crop margin phù hợp driver.
- Không dựa vào metadata DPI một cách mù quáng; pixel dimensions phải đúng.

```text
output/
├── final-master.png
├── final-share.jpg
└── final-print.jpg
```

---

# 15. Layout photo strip

Với layout 1x4, file chia sẻ và file in có thể khác nhau.

```text
final-share.jpg
→ một strip dọc

final-print.jpg
→ hai strip giống nhau đặt cạnh nhau trên giấy 4x6
```

Minh họa:

```text
┌──────────────┬──────────────┐
│   Photo 1    │   Photo 1    │
│   Photo 2    │   Photo 2    │
│   Photo 3    │   Photo 3    │
│   Photo 4    │   Photo 4    │
│ Logo / Date  │ Logo / Date  │
└──────────────┴──────────────┘
```

Nên tách `ShareRenderer` và `PrintRenderer` dù dùng chung ảnh nguồn.

---

# 16. Flow in ảnh

```text
COMPOSITION_READY
    ↓
CREATE_PRINT_JOB
    ↓
VALIDATE_PAPER_PROFILE
    ↓
ADD_TO_PRINT_QUEUE
    ↓
SEND_TO_OS_OR_VENDOR_DRIVER
    ↓
WAIT/OBSERVE_STATUS
    ↓
COMPLETED hoặc FAILED
```

## 16.1. Print job mẫu

```json
{
  "jobId": "print_20260803_A91D",
  "sessionId": "session_20260803_170001_A8F2",
  "file": "output/final-print.jpg",
  "printerId": "photo_printer_01",
  "paperProfile": "4x6_borderless",
  "copies": 2,
  "status": "QUEUED",
  "retryCount": 0,
  "idempotencyKey": "session_20260803_170001_A8F2:final-print:2"
}
```

## 16.2. Trạng thái in

```text
QUEUED
VALIDATING
SENDING
SENT_TO_OS
PRINTING          (nếu driver cung cấp)
COMPLETED         (nếu xác nhận được)
ASSUMED_COMPLETED (nếu chỉ biết đã gửi thành công)
FAILED
CANCELLED
```

## 16.3. Chống in trùng

- Mỗi print job có idempotency key.
- Nút in chỉ enqueue, không gọi driver trực tiếp.
- Disable nút khi job đang gửi.
- Restart app phải đọc lại queue từ SQLite.
- Reprint tạo job mới có lý do và người thực hiện.

## 16.4. Printer offline

```text
job giữ trạng thái QUEUED/FAILED_RETRYABLE
→ cảnh báo kỹ thuật viên
→ retry có backoff
→ không xóa output của session
```

---

# 17. Cấu trúc lưu trữ session

```text
sessions/
└── 2026-08-03/
    └── session_20260803_170001_A8F2/
        ├── session.json
        ├── originals/
        │   ├── capture_01.jpg
        │   ├── capture_02.jpg
        │   ├── capture_03.jpg
        │   └── capture_04.jpg
        ├── archive/
        ├── thumbnails/
        ├── processed/
        ├── output/
        │   ├── final-master.png
        │   ├── final-share.jpg
        │   └── final-print.jpg
        ├── print/
        │   └── print-job.json
        └── logs/
```

## 17.1. session.json mẫu

```json
{
  "sessionId": "session_20260803_170001_A8F2",
  "status": "COMPLETED",
  "createdAt": "2026-08-03T17:00:01+07:00",
  "completedAt": "2026-08-03T17:01:18+07:00",
  "camera": {
    "model": "Canon EOS 6D",
    "connection": "USB",
    "adapter": "CanonEdsdkAdapter",
    "iso": 400,
    "shutter": "1/125",
    "aperture": "f/5.6",
    "whiteBalance": "5600K"
  },
  "layout": {
    "id": "layout_2x2_4x6",
    "captureCount": 4
  },
  "frame": {
    "id": "wedding-white-01",
    "version": "1.0.0"
  },
  "captures": [
    { "index": 1, "file": "originals/capture_01.jpg", "status": "VALID" },
    { "index": 2, "file": "originals/capture_02.jpg", "status": "VALID" },
    { "index": 3, "file": "originals/capture_03.jpg", "status": "VALID" },
    { "index": 4, "file": "originals/capture_04.jpg", "status": "VALID" }
  ],
  "outputs": {
    "master": "output/final-master.png",
    "share": "output/final-share.jpg",
    "print": "output/final-print.jpg"
  },
  "print": {
    "copies": 2,
    "jobId": "print_20260803_A91D",
    "status": "COMPLETED"
  }
}
```

---

# 18. State machine toàn hệ thống

```text
BOOTING
  ↓
DEVICE_CHECK
  ↓
IDLE
  ↓
CONFIGURING_SESSION
  ↓
LIVE_VIEW
  ↓
COUNTDOWN
  ↓
CAPTURING
  ↓
WAITING_IMAGE
  ↓
DOWNLOADING
  ↓
VALIDATING
  ↓
CAPTURE_PREVIEW
  ├── COUNTDOWN (ảnh tiếp theo)
  └── REVIEW (đã đủ ảnh)
         ↓
      COMPOSING
         ↓
      PRINT_QUEUED
         ↓
      SHOW_RESULT
         ↓
      COMPLETED
         ↓
       IDLE
```

Error states:

```text
CAMERA_DISCONNECTED
CAMERA_BUSY
LIVE_VIEW_STALLED
CAPTURE_TIMEOUT
DOWNLOAD_FAILED
INVALID_IMAGE
COMPOSITION_FAILED
PRINTER_OFFLINE
PRINT_FAILED
STORAGE_FULL
SESSION_TIMEOUT
```

Không nên quản lý flow bằng nhiều boolean rời rạc như `isCapturing`, `isDownloading`, `isPrinting`. State machine giúp ngăn các trạng thái mâu thuẫn và dễ resume sau lỗi.

---

# 19. Recovery sau crash hoặc mất điện

Khi CameraOS chạy lại:

1. Tìm session có trạng thái chưa kết thúc.
2. Kiểm tra originals đã tải đủ chưa.
3. Nếu đủ ảnh nhưng chưa compose, chạy compose lại.
4. Nếu đã có final-print nhưng print job chưa hoàn tất, đưa lại queue theo policy.
5. Không tự in lại khi không chắc job trước đã in hay chưa; yêu cầu kỹ thuật viên xác nhận.
6. Ghi recovery event vào log.

Nên dùng atomic operations:

```text
capture_01.jpg.part
→ validate hoàn tất
→ rename capture_01.jpg
```

Tương tự với output và session metadata.

---

# 20. API nội bộ đề xuất

```ts
interface CameraAdapter {
  connect(): Promise<CameraInfo>;
  disconnect(): Promise<void>;
  startLiveView(): Promise<void>;
  stopLiveView(): Promise<void>;
  capture(request: CaptureRequest): Promise<void>;
  waitForNewImage(options: WaitImageOptions): Promise<CameraObject>;
  downloadImage(object: CameraObject, destination: string): Promise<string>;
  getSettings(): Promise<CameraSettings>;
  setSettings(settings: Partial<CameraSettings>): Promise<void>;
  healthCheck(): Promise<DeviceHealth>;
}
```

Adapter tree:

```text
CameraAdapter
├── CanonEdsdkAdapter     ← Canon EOS 6D
├── CanonCcapiAdapter     ← Canon hỗ trợ CCAPI trong tương lai
├── GPhotoPtpAdapter      ← adapter thử nghiệm/fallback
├── SonyAdapter
├── NikonAdapter
└── WebcamAdapter
```

Điều này giữ CameraOS không bị khóa vào một model camera.

---

# 21. Stack triển khai đề xuất

## Phương án ưu tiên cho MVP Windows

```text
Electron + React UI
Node.js Session Controller
C++ hoặc C# native Canon EDSDK service
Sharp/OpenCV cho composition
SQLite cho session và print queue
Windows Print API hoặc vendor driver
```

## Phương án macOS

```text
Electron/Tauri + React UI
Native helper tương thích EDSDK macOS
Sharp/OpenCV
SQLite
CUPS/vendor driver
```

Tuy nhiên, với camera DSLR cũ như EOS 6D, cần kiểm thử kỹ phiên bản EDSDK và hệ điều hành thực tế. Không nên chọn macOS chỉ vì UI thuận tiện nếu driver camera hoặc máy in không ổn định. Một máy Windows chuyên dụng thường dễ khóa phiên bản driver và vận hành kiosk hơn.

## Nguyên tắc process isolation

Nên chạy Camera Adapter ở process riêng:

```text
UI process
Session process
Camera native process
Print worker process
```

Nếu EDSDK/native process crash, CameraOS có thể restart riêng camera service thay vì đóng toàn bộ booth.

---

# 22. Logging và quan sát hệ thống

Mỗi log nên có:

- Timestamp.
- Session ID.
- Device ID.
- State hiện tại.
- Event/action.
- Duration.
- Error code native và normalized code.

Ví dụ:

```json
{
  "time": "2026-08-03T17:00:42.531+07:00",
  "level": "INFO",
  "sessionId": "session_20260803_170001_A8F2",
  "state": "DOWNLOADING",
  "event": "camera.image.download.completed",
  "captureIndex": 2,
  "durationMs": 842,
  "fileSize": 6834201
}
```

Dashboard kỹ thuật viên nên hiển thị:

- Camera connected/disconnected.
- Live View FPS.
- Capture success rate.
- Download duration.
- Disk free.
- Printer status và queue length.
- Số phiên hoàn thành/thất bại.
- Nhiệt độ thiết bị nếu có dữ liệu.

---

# 23. Bảo mật và quyền riêng tư

- Không upload ảnh nếu khách chưa đồng ý theo policy sự kiện.
- QR link phải có token khó đoán và thời hạn.
- Không expose thư mục sessions qua static web server công khai.
- Mã hóa secret và API key.
- Có retention policy, ví dụ tự xóa originals sau số ngày quy định.
- Audit thao tác reprint, export và xóa phiên.
- Kiosk UI không được cho truy cập desktop hoặc file system.

---

# 24. Test plan trước khi chạy thật

## 24.1. Camera

- Kết nối/ngắt USB 20 lần.
- Chạy Live View liên tục 2-4 giờ.
- Chụp 100-300 ảnh liên tục theo session.
- Test camera busy.
- Test sleep/auto power off.
- Test tháo lens hoặc lỗi AF.
- Test flash không nổ.

## 24.2. Session

- Layout 1, 3, 4 và 6 ảnh.
- Countdown khác nhau.
- Retake từng vị trí.
- Timeout khách bỏ phiên.
- Crash giữa capture/download/compose.

## 24.3. Composition

- Ảnh portrait/landscape và EXIF rotation.
- Nhiều khuôn mặt.
- Khuôn mặt sát mép.
- Asset frame thiếu hoặc sai kích thước.
- Font tiếng Việt.
- Print dimensions chính xác.

## 24.4. Printer

- Printer offline trước phiên.
- Hết giấy giữa queue.
- Driver treo.
- In hai bản.
- Bấm nút in nhiều lần.
- Restart CameraOS khi queue còn job.

## 24.5. Acceptance test

MVP chỉ được xem là ổn định khi:

- Tối thiểu 100 phiên liên tiếp không mất ảnh.
- Không in trùng ngoài yêu cầu.
- Khi camera disconnect, hệ thống recover được hoặc hướng dẫn rõ.
- Khi printer lỗi, ảnh và print job vẫn còn nguyên.
- Không có session bị ghi đè.
- Thời gian từ ảnh cuối đến preview kết quả nằm trong mục tiêu vận hành.

---

# 25. Flow MVP nên triển khai theo giai đoạn

## Giai đoạn 1 - Camera proof of concept

1. Detect Canon EOS 6D qua USB.
2. Open session.
3. Start Live View.
4. Trigger một ảnh.
5. Download JPEG gốc.
6. Lặp 100 lần để kiểm tra ổn định.

## Giai đoạn 2 - Session capture

1. Tạo session ID.
2. Chọn capture count.
3. Countdown.
4. Chụp đủ số lần.
5. Validate và lưu originals.
6. Retake.

## Giai đoạn 3 - Composition

1. Layout JSON.
2. Crop cover.
3. Overlay frame.
4. Export master/share/print.
5. Test đúng pixel dimensions.

## Giai đoạn 4 - Printing

1. Print queue SQLite.
2. Printer adapter.
3. Idempotency.
4. Retry/reprint.
5. Recovery sau restart.

## Giai đoạn 5 - Production hardening

1. Device watchdog.
2. Technician dashboard.
3. Crash recovery.
4. Logs và metrics.
5. Kiosk mode.
6. Retention và QR/cloud.

Chỉ sau khi core flow ổn định mới bổ sung gesture, AI face crop nâng cao, cloud gallery, multi-camera và plugin marketplace.

---

# 26. Flow hoàn chỉnh dạng rút gọn

```text
START CAMERAOS
→ Check storage/database
→ Connect Canon EOS 6D qua USB
→ Initialize EDSDK và mở camera session
→ Register events
→ Start Live View
→ Check printer và load frame/layout
→ READY

Khách chạm Start
→ Create session
→ Chọn layout
→ Chọn frame
→ Chọn countdown
→ Chọn số bản in
→ Xác nhận
→ Live View
→ Countdown ảnh 1
→ Trigger Canon EOS 6D
→ Nhận event ảnh mới
→ Download JPEG gốc
→ Validate và lưu
→ Lặp đến đủ captureCount
→ Review/retake nếu bật
→ Crop + color + compose frame
→ Export master/share/print
→ Enqueue print job
→ Hiển thị kết quả/QR
→ Complete session
→ Reset về attract screen
```

---

# 27. Kết luận kỹ thuật

Đối với Canon EOS 6D đời đầu, kiến trúc phù hợp nhất cho MomentAI CameraOS là:

```text
USB + Canon EDSDK = đường điều khiển và lấy ảnh chính
HDMI capture card = preview tùy chọn
JPEG từ camera    = nguồn ảnh để ghép và in
State machine      = điều phối phiên
SQLite + filesystem= lưu session và print queue
Printer worker     = in có queue, retry và chống trùng
```

Không thiết kế Photobooth phụ thuộc vào CCAPI vì EOS 6D không phải model CCAPI phù hợp. Tuy nhiên CameraOS vẫn nên có `CameraAdapter` để sau này hỗ trợ Canon CCAPI, Sony, Nikon, Fujifilm, webcam hoặc điện thoại mà không phải viết lại Photobooth App.

---

# 28. Nguồn tham khảo chính thức

1. Canon Europe - Canon SDK for Business Innovation: EDSDK là SDK điều khiển có dây, hỗ trợ Windows, macOS và Linux trên các camera tương thích.  
   https://www.canon-europe.com/business/imaging-solutions/sdk/

2. Canon Europe - Photo Booth Cameras & Solutions: Canon giới thiệu EOS Digital SDK cho các giải pháp photo booth.  
   https://www.canon-europe.com/business/imaging-solutions/photo-booth/

3. Canon Europe - Case study có triển khai EDSDK với Canon EOS 6D.  
   https://www.canon-europe.com/business/insights/case-studies/sharper-cuts-smarter-shapes-mind/

4. Canon Developer Community - Live View resolutions with EDSDK and CCAPI; bảng model minh họa sự khác nhau giữa hỗ trợ EDSDK và CCAPI.  
   https://developercommunity.usa.canon.com/s/article/Liveview-Resolutions-with-EDSDK-and-CCAPI

> Khi triển khai thực tế, cần đăng ký Canon Developer Programme để tải SDK, tài liệu API, sample code và kiểm tra compatibility list của phiên bản EDSDK đang dùng.
