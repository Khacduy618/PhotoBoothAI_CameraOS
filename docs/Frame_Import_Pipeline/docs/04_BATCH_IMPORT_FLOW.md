# 04 — Batch Import Flow

## 1. Upload

Hỗ trợ chọn hoặc kéo thả nhiều file:

```text
1–100 PNG files
```

MVP nên giới hạn:

```text
10–25 files / batch
```

để UI phản hồi tốt.

## 2. Queue state

```ts
type BatchItemStatus =
  | "queued"
  | "decoding"
  | "analyzing"
  | "previewing"
  | "auto-approved"
  | "needs-review"
  | "rejected"
  | "published";
```

## 3. Pipeline cho mỗi file

```text
Validate file
→ Decode
→ Select alpha/mask source
→ Build binary mask
→ Connected components
→ Filter candidates
→ Infer layout
→ Sort slots
→ Score confidence
→ Render preview
→ Assign status
```

## 4. Batch summary

```ts
type BatchSummary = {
  total: number;
  autoApproved: number;
  needsReview: number;
  rejected: number;
  failed: number;
};
```

## 5. UI đề xuất

```text
┌────────────────────────────────────────────────────┐
│ Upload 10 frames                                   │
├────────────────────────────────────────────────────┤
│ 8 Auto Approved | 1 Review | 1 Rejected            │
├────────────────────────────────────────────────────┤
│ [Preview] party-neon        4 slots   96%   Ready  │
│ [Preview] wedding-gold      2 slots   91%   Ready  │
│ [Preview] retro-strip       4 slots   82%   Review │
│ [Preview] broken-template   0 slots    0%   Reject │
├────────────────────────────────────────────────────┤
│ [Approve All Ready] [Review Problems] [Export]     │
└────────────────────────────────────────────────────┘
```

## 6. Preview

Preview phải:

1. Draw ảnh mẫu vào slot.
2. Draw frame PNG phía trên.
3. Hiện outline slot ở chế độ debug.
4. Hiện slot order.
5. Cho phép bật/tắt frame overlay.

## 7. Fine tune

Chỉ dành cho `needs-review`.

Cho phép:

- Drag slot.
- Resize slot.
- Delete candidate.
- Add slot.
- Reorder slot.
- Re-run validation.

Không yêu cầu nhập tọa độ số.

## 8. Approve all

Chỉ approve các item:

```text
status = auto-approved
```

Item needs-review không được publish ngầm.

## 9. Idempotency

Import cùng file nhiều lần cần hash:

```text
SHA-256(file bytes)
```

Nếu hash đã tồn tại:

- báo duplicate
- không tạo record trùng
- cho phép replace version nếu người dùng chọn

## 10. Output batch

```text
frame-pack/
├── assets/
│   ├── party-neon.png
│   └── wedding-gold.png
├── metadata/
│   ├── party-neon.frame.json
│   └── wedding-gold.frame.json
└── frame-pack.json
```
