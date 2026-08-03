# 01 — Solution Architecture

## 1. Bài toán

Một frame Canva có thể chứa 1, 2, 4 hoặc 6 vị trí ảnh. Khi import 10–100 file, hệ thống phải tự xác định:

- Có bao nhiêu photo slot.
- Slot nằm ở đâu.
- Kích thước từng slot.
- Thứ tự gán ảnh.
- File có đạt chuẩn hay không.
- Có thể tự publish hay cần người duyệt.

Không thể yêu cầu developer nhập metadata thủ công cho từng frame.

## 2. Giải pháp tối ưu

Dùng một `Frame Import Pipeline` độc lập với PhotoBooth runtime.

```text
Designer
  ↓
Canva PNG Export
  ↓
Batch Upload
  ↓
Import Queue
  ↓
PNG Decode
  ↓
Alpha Mask
  ↓
Connected Components
  ↓
Slot Candidates
  ↓
Layout Inference
  ↓
Confidence Score
  ↓
Preview Render
  ↓
Approve / Fine Tune / Reject
  ↓
FrameDefinition
  ↓
Frame Registry
```

## 3. Hai hệ thống tách biệt

### Frame Studio / Import Tool

Chịu trách nhiệm:

- Nhận file.
- Phân tích alpha.
- Sinh metadata.
- Tạo preview.
- Cho phép duyệt.
- Export frame pack.

### PhotoBooth Runtime

Chịu trách nhiệm:

- Đọc `FrameDefinition`.
- Gán ảnh theo `slot.order`.
- Render ảnh.
- Overlay frame PNG.
- Xuất derivative.

Runtime tuyệt đối không chạy detection.

## 4. Primary path và fallback

### Primary path: transparent photo slots

Chỉ các vùng dùng để chèn ảnh được transparent.

Ưu điểm:

- Nhanh.
- Offline.
- Batch tốt.
- Không cần AI.
- Dễ kiểm thử.

### Fallback: companion mask

Mỗi frame có thể đi cùng:

```text
frame.png
frame.mask.png
```

Quy ước mask:

- Trắng: photo slot.
- Đen: không phải slot.
- Các vùng trắng tách rời tương ứng các slot.

Mask được dùng khi:

- Nền tổng của frame cũng trong suốt.
- Slot nối với vùng trong suốt ngoài frame.
- Canva tạo alpha phức tạp.
- Decoration có nhiều lỗ trong suốt lớn.

### Last fallback: visual correction

Người dùng không nhập số. Họ kéo/resize vùng slot trực tiếp trên preview.

## 5. Component boundaries

```text
frame-import/
├── decoder
├── alpha-mask
├── connected-components
├── candidate-filter
├── layout-inference
├── slot-ordering
├── confidence
├── preview
├── persistence
└── batch-orchestrator
```

## 6. Source of truth

```text
FrameDefinition
```

không phải:

- PNG preview.
- DOM position.
- Canvas temporary state.
- Detection result chưa duyệt.

## 7. Publish rule

Một frame chỉ được publish khi:

- Có số slot thuộc `1 | 2 | 4 | 6`.
- Tất cả slot nằm trong canvas.
- Không có duplicate order.
- Asset load được.
- Preview render thành công.
- Confidence đủ cao hoặc người dùng đã confirm.
