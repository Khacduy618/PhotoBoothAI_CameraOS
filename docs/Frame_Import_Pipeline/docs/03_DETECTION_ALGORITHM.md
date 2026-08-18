# 03 — Detection Algorithm

## 1. Input

```ts
type AnalyzeInput = {
  framePng: Blob | Buffer;
  optionalMaskPng?: Blob | Buffer;
};
```

## 2. Chọn nguồn mask

```text
Nếu có companion mask
    → dùng mask
Nếu không
    → dùng alpha channel của frame PNG
```

## 3. Alpha threshold

Không dùng duy nhất `alpha === 0`.

Khuyến nghị:

```ts
alphaThreshold = 16
```

Transparent pixel:

```ts
alpha <= alphaThreshold
```

## 4. Binary mask

```text
1 = photo-slot candidate
0 = frame content
```

## 5. Morphological cleanup

Để xử lý anti-alias và lỗ nhỏ:

```text
binary mask
→ opening nhỏ
→ closing nhỏ
→ connected components
```

MVP browser thuần có thể bỏ morphology nếu Canva contract nghiêm.

## 6. Connected components

Dùng flood fill hoặc union-find để tìm từng vùng liên thông.

Mỗi component cần:

```ts
type RawComponent = {
  area: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  touchesCanvasEdge: boolean;
};
```

## 7. Candidate filtering

Loại bỏ component nếu:

- Chạm mép canvas.
- Quá nhỏ.
- Quá lớn.
- Tỷ lệ width/height bất thường.
- Fill ratio quá thấp.
- Không khớp nhóm layout.

Giá trị ban đầu:

```ts
minAreaRatio = 0.015
maxAreaRatio = 0.45
minWidthRatio = 0.10
minHeightRatio = 0.08
minFillRatio = 0.70
```

`fillRatio`:

```text
component pixel area / bounding-box area
```

Photo slot chữ nhật thường có fill ratio cao.

## 8. Bounding box

```ts
x = minX
y = minY
width = maxX - minX + 1
height = maxY - minY + 1
```

Normalize:

```ts
normalizedX = x / imageWidth
normalizedY = y / imageHeight
normalizedWidth = width / imageWidth
normalizedHeight = height / imageHeight
```

## 9. Infer shot count

Chỉ chấp nhận:

```text
1, 2, 4, 6
```

Nếu candidate count khác:

```text
needs-review hoặc rejected
```

## 10. Slot ordering

### Vertical strip

Sort theo `centerY`.

### Grid

1. Sort theo `centerY`.
2. Group thành row dựa trên tolerance.
3. Trong mỗi row sort theo `centerX`.
4. Gán order từ trên xuống, trái sang phải.

Row tolerance khởi đầu:

```ts
rowTolerance = medianSlotHeight * 0.35
```

## 11. Confidence score

Gợi ý trọng số:

```text
valid slot count      30%
similar dimensions    20%
grid alignment        20%
spacing consistency   15%
not touching edge     10%
high fill ratio        5%
```

Kết quả:

```text
>= 0.90   auto-approved
0.65–0.89 needs-review
< 0.65    rejected
```

## 12. Trường hợp phức tạp

### Decoration tạo lỗ transparent

Sẽ bị lọc bằng:

- area ratio
- fill ratio
- layout consistency
- edge-touching rule

### Slot không phải rectangle

MVP vẫn dùng bounding box và PNG overlay che hình dạng.

### Nền ngoài transparent

Alpha detection không đáng tin. Bắt buộc companion mask.

### Ảnh mẫu vẫn còn trong slot

Không detect được bằng alpha. Reject với warning:

```text
NO_TRANSPARENT_SLOT_FOUND
```
