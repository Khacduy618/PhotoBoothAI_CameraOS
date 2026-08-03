# 02 — Canva Export Contract

## 1. Mục tiêu

Đảm bảo file Canva có thể được phát hiện tự động và xử lý hàng loạt ổn định.

## 2. Canvas chuẩn

MVP:

```text
1200 × 1800 px
4:6 portrait
PNG
```

Later:

```text
1800 × 2700 px
```

Metadata dùng tọa độ chuẩn hóa nên không phụ thuộc độ phân giải.

## 3. Layer contract

Frame nên được thiết kế theo thứ tự:

```text
Top decorations
Text / logo / stickers
Borders around photo slots
Opaque background or texture
Transparent photo slots
```

## 4. Quy tắc quan trọng nhất

> Chỉ vùng photo slot được trong suốt.

Không được:

- Để toàn bộ background transparent.
- Để slot nối ra mép canvas.
- Giữ ảnh mẫu trong photo slot.
- Tạo nhiều vùng transparent lớn không phải slot.

## 5. Cách chuẩn bị từ template có ảnh mẫu

1. Mở template Canva.
2. Xóa ảnh mẫu khỏi từng placeholder.
3. Giữ lại:
   - border
   - paper edge
   - polaroid frame
   - sticker
   - decoration
4. Đảm bảo vùng ảnh trống thực sự trong suốt.
5. Export PNG với transparent background.
6. Kiểm tra bằng checkerboard preview.

## 6. Trường hợp Polaroid

Chỉ phần ảnh bên trong Polaroid transparent.

Phần:

- viền trắng
- phần caption dưới ảnh
- shadow

phải giữ nguyên.

## 7. Trường hợp bo góc

Không cần sinh `cornerRadius` trong MVP nếu PNG overlay che đúng góc.

Renderer có thể draw ảnh theo bounding rectangle, sau đó frame PNG che phần góc.

## 8. Khi không thể tuân thủ alpha contract

Export companion mask:

```text
party-neon.png
party-neon.mask.png
```

Mask phải:

- Cùng width/height với frame.
- Nền đen tuyệt đối.
- Slot trắng tuyệt đối.
- Không dùng gradient.
- Không anti-alias nếu không cần.
- Mỗi slot là một component tách biệt.

## 9. Naming convention

```text
classic-white.png
party-neon.png
wedding-gold.png
graduation-red.png
```

Quy tắc:

- lowercase
- kebab-case
- không dấu
- không space
- không thông tin nhạy cảm

## 10. Batch package

Một batch có thể là:

```text
batch/
├── classic-white.png
├── party-neon.png
├── wedding-gold.png
├── graduation-red.png
└── masks/
    └── wedding-gold.mask.png
```

Importer tự ghép mask theo basename.
