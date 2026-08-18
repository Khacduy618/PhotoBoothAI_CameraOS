# CameraOS Frame Import Pipeline

## Mục tiêu

Tự động tiếp nhận hàng loạt frame PNG từ Canva, phát hiện các vùng ảnh trống, sinh metadata, tạo preview kiểm tra và đăng ký frame vào CameraOS mà không phải nhập thủ công `x`, `y`, `width`, `height`.

Giải pháp tối ưu được chọn:

```text
Canva PNG có các photo slot trong suốt
        ↓
Batch Import
        ↓
Alpha Analyzer
        ↓
Connected Components
        ↓
Candidate Filtering
        ↓
Slot Ordering
        ↓
Confidence Scoring
        ↓
Preview Validation
        ↓
Auto Approve hoặc Needs Review
        ↓
FrameDefinition
        ↓
Frame Registry
```

## Quyết định kiến trúc

1. Runtime PhotoBooth không detect frame.
2. Detection chỉ chạy khi import frame.
3. Nguồn chính là PNG có photo slot trong suốt.
4. Companion mask là fallback chính thức cho frame không thể tuân thủ alpha contract.
5. Không detect trực tiếp từ ảnh mẫu đã được chèn vào frame.
6. Không dùng AI/ML trong MVP.
7. Native Canvas hoặc Sharp/OpenCV chỉ dùng ở Frame Import Pipeline.
8. Metadata dùng tọa độ chuẩn hóa `0..1`.
9. Upload hàng loạt phải trả về ba trạng thái:
   - `auto-approved`
   - `needs-review`
   - `rejected`
10. Mọi frame trước khi publish đều phải có preview với ảnh mẫu.

## Tài liệu

- `docs/01_SOLUTION_ARCHITECTURE.md`
- `docs/02_CANVA_EXPORT_CONTRACT.md`
- `docs/03_DETECTION_ALGORITHM.md`
- `docs/04_BATCH_IMPORT_FLOW.md`
- `docs/05_DATA_MODEL.md`
- `docs/06_IMPLEMENTATION_PLAN.md`
- `docs/07_TEST_AND_ACCEPTANCE.md`
- `docs/08_OPERATIONS_AND_FAILURES.md`

## Mã mẫu

- `src/frame-import/types.ts`
- `src/frame-import/analyze-alpha.ts`
- `src/frame-import/connected-components.ts`
- `src/frame-import/filter-candidates.ts`
- `src/frame-import/order-slots.ts`
- `src/frame-import/confidence.ts`
- `src/frame-import/import-frame.ts`

## Scope hiện tại

### In scope

- PNG
- Batch upload
- Alpha detection
- Companion mask fallback
- Slot metadata generation
- Preview
- Manual visual fine-tune cho case lỗi
- Local frame registry
- 1, 2, 4, 6 photo slots

### Out of scope

- Detect từ ảnh mẫu đã ghép sẵn
- SVG
- JPG/WebP
- AI segmentation
- Cloud frame marketplace
- Runtime frame editor cho attendee
