# 08 — Operations and Failure Handling

## 1. Failure policy

Không tự publish frame có confidence thấp.

## 2. Rejection reasons

### No alpha

File có thể:

- chứa ảnh mẫu
- export sai
- không bật transparent background

Action:

- hướng dẫn export lại
- hoặc yêu cầu companion mask

### Transparent background nối ra mép

Action:

- reject alpha path
- yêu cầu companion mask

### Unsupported slot count

Action:

- review
- xóa candidate giả
- hoặc thêm slot còn thiếu

### Inconsistent slot sizes

Không nhất thiết reject. Có thể là thiết kế hợp lệ.

Action:

- needs-review

## 3. Versioning

```ts
analyzerVersion: "alpha-slot-analyzer-v1"
frameDefinitionVersion: 1
```

Khi thay thuật toán:

- không âm thầm thay metadata cũ
- cho phép re-analyze
- lưu lịch sử

## 4. Audit fields

```ts
createdAt
createdBy
reviewedAt
reviewedBy
sourceHash
analyzerVersion
confidence
warnings
```

## 5. Security

- Chỉ nhận PNG.
- Kiểm tra MIME thực tế.
- Giới hạn kích thước file.
- Giới hạn dimensions.
- Không fetch URL từ metadata.
- Asset path phải local.
- Không tin filename từ client.

## 6. Recommended limits

```text
Max files per batch: 25
Max file size: 15 MB
Max dimensions: 4000 × 6000
Min dimensions: 600 × 900
```

## 7. Rollback

Publish tạo version mới.

Nếu frame lỗi:

- disable frame version
- quay về version trước
- không xóa asset đang được session cũ tham chiếu
