# 07 — Test and Acceptance

## Unit tests

- Alpha threshold.
- Binary mask generation.
- Connected components.
- Bounding box.
- Edge-touch detection.
- Candidate filtering.
- Shot-count inference.
- Row grouping.
- Slot ordering.
- Confidence scoring.
- Normalization.
- Duplicate hash.

## Fixture matrix

| Fixture | Expected |
|---|---|
| 1 transparent slot | 1 slot, auto-approved |
| 2 horizontal slots | 2 slots |
| 2 vertical slots | 2 slots |
| 4 grid slots | 4 slots |
| 4 vertical film strip | 4 slots |
| 6 grid slots | 6 slots |
| no alpha | rejected |
| transparent full background | needs-review/rejected |
| tiny transparent decorations | ignored |
| mask dimension mismatch | rejected |
| one malformed slot | needs-review |

## Batch acceptance

- Upload 10 files một lần.
- Từng file có progress độc lập.
- Một file lỗi không làm dừng batch.
- Kết quả chia đúng ba nhóm.
- Approve All không publish item needs-review.
- Export pack chứa asset và metadata đầy đủ.

## Rendering acceptance

- Ảnh không bị kéo méo.
- Ảnh map đúng slot order.
- Frame overlay chỉ vẽ một lần.
- Preview trùng output final.
- Frame hoạt động offline.
- Runtime không chạy analyzer.

## Performance budget

Mục tiêu MVP trên máy kiosk hiện đại:

- Decode + analyze 1200×1800: dưới 500 ms/file trung bình.
- 10 file: dưới 8 giây tổng với worker concurrency hợp lý.
- UI không block.
- Preview lazy-render.
