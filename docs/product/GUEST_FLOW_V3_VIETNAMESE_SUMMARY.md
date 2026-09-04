# MomentAI Guest Flow V3 — Tóm tắt tiếng Việt

Status: Tài liệu tóm tắt flow màn hình, data và backend/system cho Guest Flow V3, cập nhật theo Production Brief v3.1 và quyết định PM.
Source architecture: `docs/architecture/MomentAI_Guest_Internal_System_Design.md`. Các quyết định production được ghi trực tiếp trong tài liệu này và bộ Guest Flow V3 docs.
Target V1: Windows 10 x64 booth PC / Mini PC form factor + Electron packaged as Windows `.exe` + Vite React renderer. App production lưu data trong `%LOCALAPPDATA%`, mở fullscreen kiosk, hỗ trợ startup/auto-launch sau Windows login, và Admin/operator nằm trong Electron, ẩn/passcode-gated với guest. Share production dùng cloud landing page Vercel + Neon + R2 với local QR fallback/dev/offline. macOS chỉ là development path với Device/Fake adapter; React Native, iPad app và macOS production runtime không thuộc phạm vi V1.

## 1. Flow màn hình guest

```text
START / SHOWCASE
→ CHỌN SỐ ẢNH
→ CHỤP TỰ ĐỘNG
→ CHỌN TEMPLATE / KHUNG MẪU
→ CUSTOMIZE, nếu template cho phép type/draw
→ RENDER THÀNH PHẨM
→ MÀN KẾT THÚC: ẢNH FINAL + CLOUD QR/LOCAL FALLBACK + GUEST-CONFIRMED QUEUED PRINT
→ DONE hoặc TIMEOUT 120 GIÂY
→ RESET GUEST SESSION
→ START
```

Guest chỉ cần chọn:

1. số ảnh muốn chụp: 1, 2, 4 hoặc 6 shots;
2. template/khung mẫu tương thích;
3. nhập text hoặc vẽ nếu template cho phép.

Guest không chọn:

- layout riêng;
- thứ tự ảnh;
- giấy in;
- máy in;
- frame/sticker/theme/style riêng ngoài template.

Các thứ đó do hệ thống tự quyết định từ:

```text
Shot Format
+ Template
+ Event
+ Print Profile
```

## 2. Màn 01 — Start / Showcase

Guest thấy:

- branding event;
- sample kết quả;
- giới thiệu 1/2/4/6 shots;
- một nút chính: Bắt đầu.

Backend/system lúc idle:

- Active Event config đã load;
- Template cache sẵn sàng;
- Health gate tính `READY` / `DEGRADED` / `BLOCKED`;
- Camera service dùng active adapter phù hợp: Fake / Device / Canon;
- Printer service có thể READY, DEGRADED hoặc DISABLED theo event print policy;
- Cloud QR/share có thể AVAILABLE hoặc UNAVAILABLE theo Vercel/Neon/R2 upload/retrieval; Local QR fallback có thể AVAILABLE hoặc UNAVAILABLE theo network reachability;
- Chưa có guest session active.

Khi bấm Start:

```text
StartButton
→ SessionController.createSession()
→ tạo sessionId
→ status = SELECTING_FORMAT
```

## 3. Màn 02 — Chọn số ảnh

Guest thấy 4 lựa chọn:

| Lựa chọn | ID | Số ảnh | Bố cục hệ thống |
|---|---|---:|---|
| 1 Shot | `format_1shot` | 1 | `single` |
| 2 Shots | `format_2shot` | 2 | `vertical_2` |
| 4 Shots | `format_4shot` | 4 | `vertical_4` |
| 6 Shots | `format_6shot` | 6 | `2col_3row` |

Khi chọn format:

```text
selectCaptureFormat(formatId)
→ CaptureFormatService.load(formatId)
→ session.captureFormat = format
```

Khi bấm Continue:

```text
status = READY_TO_CAPTURE
→ CaptureScreen
```

## 4. Màn 03 — Chụp tự động

Guest thấy:

- live view camera gần full screen;
- countdown 3, 2, 1;
- tiến độ shot, ví dụ 2/4;
- flash/capture feedback;
- trạng thái đang chụp/lưu.

Luồng backend cho mỗi shot:

```text
CaptureManager
→ countdown
→ CameraService.capture()
→ active CameraAdapter: Fake / Device / Canon
→ nếu Canon: CanonAdapter / CanonCameraBridge / EDSDK / EOS 6D
→ nhận/acquire still image
→ validate image
→ PhotoStorage.saveOriginal()
→ tạo Photo object
→ thêm vào session.photos
```

Điều kiện hoàn tất capture:

```text
savedPhotoCount == session.captureFormat.shotCount
```

Ví dụ chọn 4 shots thì phải có 4 ảnh original đã lưu thành công mới đi tiếp.

Nếu shot #2 lỗi sau khi shot #1 đã lưu, shot #1 vẫn phải được giữ. Hệ thống không được xoá ảnh đã chụp thành công.

## 5. Photo Pool

Sau khi chụp xong, session có danh sách ảnh gốc:

```json
[
  {
    "photoId": "photo_001",
    "sessionId": "sess_001",
    "shotIndex": 1,
    "originalPath": "originals/capture_01.jpg",
    "status": "valid",
    "capturedAt": "2026-08-11T15:00:01+07:00"
  }
]
```

Nguyên tắc:

- ảnh gốc thuộc PhotoStorage;
- session chỉ tham chiếu tới ảnh;
- template không chứa ảnh guest;
- ảnh gốc không bị overwrite bởi preview, customize, QR hay print.

## 6. Màn 04 — Chọn template / khung mẫu

Guest chỉ thấy template phù hợp với event và shot format đã chọn.

Query logic:

```text
eventId = session.eventId
AND captureFormatId = session.captureFormat.id
AND status = PUBLISHED
```

Ví dụ guest chọn 4 Shots thì chỉ thấy template dành cho 4 Shots của event hiện tại.

Template chứa:

- canvas size;
- slot ảnh;
- background;
- overlay;
- decoration;
- text config;
- drawing config;
- print profile.

Template không chứa ảnh guest.

## 7. Shot → Slot mapping

Guest Flow V3 không cho guest đổi thứ tự ảnh.

Mapping mặc định:

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

Backend:

```text
Photo Pool
+ Selected Template
→ AssignmentEngine
→ session.slotAssignments
```

## 8. Màn 05 — Customize có điều kiện

Template quyết định có cho customize không.

Ví dụ:

```json
{
  "customization": {
    "allowTyping": true,
    "allowDraw": false
  }
}
```

Nếu:

```text
allowTyping = false
allowDraw = false
```

thì bỏ qua màn Customize và đi thẳng tới render final.

Nếu cho type:

```text
Guest tap text region
→ VirtualKeyboard
→ nhập text
→ session.customization.text
→ preview update
```

Nếu cho draw:

```text
Guest vẽ bằng touch/pointer
→ DrawCanvas
→ lưu stroke data
→ session.customization.drawing
```

Drawing nên lưu dạng stroke data, không chỉ bitmap, để render lại chất lượng cao khi in.

## 9. Final Composition

Khi guest bấm hoàn tất customize hoặc template không cần customize:

```text
Photo Pool
+ Template
+ Slot Assignments
+ Text
+ Drawing
+ Event Branding
→ CompositionEngine
```

Render order:

```text
BACKGROUND
→ PHOTO SLOT 1
→ PHOTO SLOT 2
→ PHOTO SLOT ...
→ OVERLAY
→ DECORATION
→ EVENT BRANDING
→ TEXT
→ DRAWING
```

Composition tạo 3 output:

| Output | File ví dụ | Dùng cho |
|---|---|---|
| Master | `final-master.png` | archive, re-render, reprint |
| Share | `final-share.jpg` | Cloud QR landing page Vercel/Neon/R2 hoặc Local QR fallback/dev/offline |
| Print | `final-print.jpg` | printer |

## 10. Màn 06 — Result + Cloud QR/Local Fallback + Guest-confirmed Queued Print

Đây là màn kết thúc.

Guest thấy:

- ảnh final;
- Cloud QR để tải ảnh qua landing page Vercel/Neon/R2 khi cloud share thành công;
- Local QR fallback/dev/offline hoặc fallback rõ ràng khi QR không khả dụng;
- trạng thái in;
- nút Print khi event bật `GUEST_CONFIRM`;
- countdown 120 giây;
- nút Done.

Sau khi composition xong, hệ thống chuẩn bị share output:

```text
final-share.jpg
→ CloudShareService upload R2 + tạo Neon token/share record
→ Vercel landing page URL có token
→ QR Generator
→ QRCodeCard hoặc QR unavailable/local fallback
```

QR token hết hạn sau 10 phút kể từ lúc tạo landing/share record. App restart không làm mất token chưa hết hạn. Cloud/local QR không được expose local absolute path, raw R2 key hoặc QR secret. Local QR fallback chỉ hợp lệ khi URL không phải `localhost` và điện thoại guest truy cập được cùng network/booth hotspot.

Khi guest xác nhận in:

```text
final-print.jpg
→ PrintService
→ tạo durable PrintJob với idempotency key
→ durable FIFO PrintQueue
→ FakePrinterAdapter hoặc WindowsPrintAdapter khi CP1000 khả dụng
→ nếu production hardware: Windows Print System
→ Canon SELPHY CP1000
```

V1 dùng `PrintPolicy=GUEST_CONFIRM`. Guest được bấm xác nhận in nhưng không chọn máy in, giấy, layout, số bản hoặc print profile. Printer chậm/busy thì job sau xếp hàng; guest reset không xoá hoặc dừng print job.

Nếu print lỗi:

- QR vẫn hiển thị;
- ảnh vẫn được giữ;
- print status báo lỗi cho guest/operator;
- queue dừng, không auto retry;
- Admin reprint/resume thủ công;
- không xoá session media, print output hoặc durable job record.

## 11. Timeout và reset

Result screen có timer 120 giây.

Nếu guest bấm Done:

```text
DONE
→ complete session
→ reset guest UI
→ Start
```

Nếu guest bỏ đi:

```text
120 giây hết
→ complete session
→ reset guest UI
→ Start
```

Reset guest session sẽ clear:

- captureFormat active;
- photo references trong UI active;
- selectedTemplate;
- slotAssignments;
- typed text;
- drawing;
- result UI;
- QR UI.

Reset không clear:

- Event config;
- Camera connection;
- Printer connection;
- Camera settings;
- Template cache;
- Printer config.

Đặc biệt:

```text
Không disconnect Canon EOS 6D khi reset guest session.
```

## 12. Backend/system hoạt động tổng quát

```text
CameraOS Start
→ load EventConfig
→ load TemplateCache
→ initialize CameraService với Fake / Device / Canon adapter theo config và hardware availability
→ initialize PrinterService với FakePrinter hoặc WindowsPrintAdapter khi CP1000 khả dụng
→ run HardwareHealthService / readiness gate
→ show StartScreen nếu READY/allowed DEGRADED, hoặc operator recovery nếu BLOCKED

Guest Start
→ SessionController.createSession()
→ SelectShotScreen
→ CaptureFormatService chọn format
→ CaptureScreen
→ CaptureManager chụp đủ số ảnh
→ PhotoStorage lưu originals
→ TemplateService lọc template
→ AssignmentEngine map shot vào slot
→ Customize nếu template cho phép
→ CompositionEngine render master/share/print
→ CloudShareService tạo Vercel/Neon/R2 QR hoặc LocalShareService fallback nếu configured/reachable
→ QR Generator tạo QR hoặc fallback
→ PrintService enqueue durable FIFO print job khi guest xác nhận in
→ ResultScreen
→ Done/Timeout
→ SessionController.complete()
→ reset Guest UI
→ quay lại StartScreen
```

## 13. Fallback và lỗi chính

### Camera lỗi

- Không cho capture nếu camera chưa sẵn sàng.
- Hiển thị hướng dẫn operator retry.
- Ảnh đã lưu vẫn giữ.

### Capture lỗi

- Shot lỗi không được tính là shot hợp lệ.
- Cho retry/reset rõ ràng.
- Partial originals đã lưu không bị xoá.

### Storage lỗi

- Nếu original chưa lưu được thì không được coi session thành công.
- Báo lỗi rõ ràng.
- Không silent mất ảnh.

### Template lỗi

- Nếu không có template phù hợp thì báo rõ.
- Không cho composition với template invalid.

### Composition lỗi

- Giữ originals.
- Cho retry composition hoặc reset an toàn.

### Cloud/local QR/share lỗi

- Báo QR unavailable/fallback nếu cloud upload/retrieval lỗi hoặc điện thoại không truy cập được local fallback endpoint.
- QR token hết hạn sau 10 phút và expired page không được expose media.
- Cleanup eligible sau 30 phút nhưng không xoá dependency của print/share recovery.
- Giữ ảnh và outputs.
- Không expose local absolute path, raw R2 key, `localhost`-only URL hoặc QR secret.

### Print lỗi

- Chỉ ảnh hưởng print status.
- QR vẫn dùng được.
- Media không bị xoá.

## 14. Hardware target

Target mới:

- Camera: Canon EOS 6D;
- Host: Windows 10 x64 booth PC;
- Desktop shell: Electron packaged as Windows `.exe`;
- Renderer: Vite React + TypeScript;
- Admin/operator: nằm trong Electron, ẩn/passcode-gated với guest;
- Production data: `%LOCALAPPDATA%` app-owned MomentAI Photobooth directory;
- Kiosk: fullscreen guest mode + startup/auto-launch sau Windows login;
- Camera integration: Canon EDSDK qua USB;
- Printer: Canon SELPHY CP1000 qua Windows Print System.

PASS hardware/runtime chỉ được claim khi có bằng chứng real device cụ thể trên target Windows 10 x64 booth PC. Cloud QR PASS cần bằng chứng scan từ điện thoại thật qua deployed Vercel/Neon/R2 path; Local QR PASS cần bằng chứng scan từ điện thoại thật trên cùng network reachable. Nếu chỉ test bằng fake adapter/mock/dev browser/shadow mode thì phải ghi PARTIAL hoặc Not tested.
