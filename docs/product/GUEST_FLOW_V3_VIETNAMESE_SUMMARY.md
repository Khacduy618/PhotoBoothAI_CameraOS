# MomentAI Guest Flow V3 — Tóm tắt tiếng Việt

Status: Tài liệu tóm tắt flow màn hình, data và backend/system cho Guest Flow V3.
Source architecture: `docs/architecture/MomentAI_Guest_Internal_System_Design.md`.

## 1. Flow màn hình guest

```text
START / SHOWCASE
→ CHỌN SỐ ẢNH
→ CHỤP TỰ ĐỘNG
→ CHỌN TEMPLATE / KHUNG MẪU
→ CUSTOMIZE, nếu template cho phép type/draw
→ RENDER THÀNH PHẨM
→ MÀN KẾT THÚC: ẢNH FINAL + QR + AUTO PRINT NGẦM
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

- Event config đã load;
- Template cache sẵn sàng;
- Camera service sẵn sàng;
- Printer service sẵn sàng nếu bật print;
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
→ CanonAdapter / Canon EDSDK
→ Canon EOS 6D chụp
→ nhận/download JPEG
→ validate JPEG
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
| Share | `final-share.jpg` | upload cloud, QR, gallery |
| Print | `final-print.jpg` | printer |

## 10. Màn 06 — Result + QR + Auto Print ngầm

Đây là màn kết thúc.

Guest thấy:

- ảnh final;
- QR để tải ảnh từ cloud;
- trạng thái in;
- countdown 120 giây;
- nút Done.

Sau khi composition xong, hệ thống chạy song song:

```text
final-share.jpg
→ DeliveryService upload cloud
→ tạo cloud download URL
→ QR Generator
→ QRCodeCard
```

và:

```text
final-print.jpg
→ PrintService
→ tạo PrintJob
→ PrintQueue
→ Printer Worker
→ macOS Print System
→ Photo Printer
```

Auto Print là hoạt động ngầm sau khi final hoàn tất, chạy trên màn Result + QR. Guest không cần chọn máy in hoặc giấy.

Nếu print lỗi:

- QR vẫn hiển thị;
- ảnh vẫn được giữ;
- print status báo lỗi/retry;
- không xoá session media.

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
→ connect Canon EOS 6D
→ prepare PrinterService
→ show StartScreen

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
→ DeliveryService upload share lên cloud
→ QR Generator tạo QR
→ PrintService enqueue print ngầm
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

### Cloud/QR lỗi

- Báo QR/cloud unavailable.
- Giữ ảnh và outputs.
- Không expose local path.

### Print lỗi

- Chỉ ảnh hưởng print status.
- QR vẫn dùng được.
- Media không bị xoá.

## 14. Hardware target

Target mới:

- Camera: Canon EOS 6D;
- Host: macOS;
- Camera integration: Canon EDSDK;
- Printer: macOS print system / photo printer.

PASS hardware chỉ được claim khi có bằng chứng real device cụ thể. Nếu chỉ test bằng mock/dev browser thì phải ghi PARTIAL.
