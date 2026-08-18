# PhotoBoothAI CameraOS — Codebase Audit Report

Ngày phân tích: 2026-07-16
Repository: `photoboothai_cameraos`
Loại dự án: Next.js / React / TypeScript / MediaPipe Gesture POC

---

## 1. Tóm tắt kết luận

Codebase hiện tại đang ở trạng thái **POC/MVP rất sớm**, chưa phải một hệ thống PhotoBoothAI hoàn chỉnh.

Hiện tại dự án đã có:

- Trang `/booth` chạy camera preview.
- Kết nối camera qua `navigator.mediaDevices.getUserMedia`.
- Nhận diện gesture bằng MediaPipe:
  - `Open_Palm`
  - `Closed_Fist`
- Luồng cơ bản:
  - mở camera
  - nhận diện gesture
  - giữ nắm tay để countdown
  - capture frame từ video
  - hiển thị ảnh kết quả
  - tải ảnh về máy
  - chụp lại
- Có cấu hình tập trung trong `config/booth.config.ts`.
- Có abstraction ban đầu cho camera adapter.

Tuy nhiên, logic sản phẩm chưa ổn định để dùng production vì còn thiếu nhiều tầng quan trọng:

- Chưa có session storage.
- Chưa có lưu ảnh bền vững.
- Chưa có backend/API.
- Chưa có in ảnh.
- Chưa có photo selection flow.
- Chưa có processing pipeline.
- Chưa có explicit state machine đầy đủ như định hướng trong `AGENTS.md`.
- Chưa có test.
- Lint hiện tại đang fail.
- Cấu trúc file còn pha trộn giữa POC UI và business logic.
- AI hiện mới dừng ở gesture recognition, chưa có AI xử lý ảnh/generative/enhancement.

Đánh giá tổng thể:

| Hạng mục | Trạng thái |
|---|---|
| Camera preview | Có, mức POC |
| Capture ảnh | Có, từ canvas |
| Gesture AI | Có, MediaPipe basic |
| Countdown | Có |
| Lưu ảnh | Chưa có bền vững |
| Session | Chưa có |
| Processing ảnh | Chưa có |
| In ảnh | Chưa có |
| State machine chuẩn | Chưa đủ |
| Error recovery | Chưa đủ |
| Testing | Chưa có |
| Production readiness | Chưa đạt |
| Khả năng scale | Có nền tảng, nhưng cần refactor sớm |

---

## 2. Confirmed repository facts

### 2.1 Công nghệ chính

File: `package.json`

Dự án dùng:

- `next`: `16.2.10`
- `react`: `19.2.4`
- `react-dom`: `19.2.4`
- `typescript`
- `tailwindcss`
- `@mediapipe/tasks-vision`
- `qrcode.react`
- `lucide-react`

Scripts hiện có:

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint"
}
```

Chưa có script test.

---

## 3. Hiện tại đang thực hiện được những gì?

### 3.1 Camera connection

File: `hooks/use-camera.ts`

Có hook `useCamera()` quản lý:

- `stream`
- `devices`
- `error`
- `isConnecting`
- `connect`
- `disconnect`
- `loadDevices`
- `adapter`

Luồng kết nối:

1. Tạo `CaptureCardAdapter`.
2. Gọi `adapter.connect(deviceId)`.
3. Lấy `MediaStream`.
4. Set vào state.
5. Load danh sách camera bằng `enumerateDevices`.

### 3.2 Capture card adapter

File: `services/camera/capture-card.adapter.ts`

Có class:

```ts
export class CaptureCardAdapter implements CameraAdapter
```

Chức năng:

- `connect(deviceId?)`
- `disconnect()`
- `getStream()`
- `capture(video)`

Capture được thực hiện bằng canvas:

1. Tạo canvas theo kích thước video.
2. Mirror ảnh bằng `context.translate(...)` và `context.scale(-1, 1)`.
3. Draw video vào canvas.
4. Convert sang JPEG blob bằng `canvas.toBlob(..., "image/jpeg", 0.94)`.

### 3.3 Gesture recognition

File: `hooks/use-gesture-recognizer.ts`

Có tích hợp MediaPipe:

```ts
import {
  FilesetResolver,
  GestureRecognizer,
} from "@mediapipe/tasks-vision";
```

Model path:

```ts
boothConfig.mediapipe.modelUrl
```

WASM path:

```ts
boothConfig.mediapipe.wasmUrl
```

Config hiện tại:

```ts
delegate: "CPU"
runningMode: "VIDEO"
numHands: boothConfig.gesture.numberOfHands
```

Gesture allowlist:

```ts
categoryAllowlist: [
  "Open_Palm",
  "Closed_Fist",
]
```

Có throttle inference bằng:

```ts
boothConfig.gesture.inferenceIntervalMs
```

Hiện đang đặt là `66ms`, tương đương khoảng 15 FPS.

### 3.4 Booth state machine đơn giản

File: `hooks/use-booth-machine.ts`

State hiện có:

```ts
export type BoothState =
    | "idle"
    | "ready"
    | "countdown"
    | "capturing"
    | "result"
    | "error";
```

Luồng chính:

```text
idle
  -> ready khi Open_Palm ổn định
  -> countdown khi Closed_Fist ổn định
  -> capturing
  -> result nếu capture thành công
  -> error nếu capture lỗi
```

Có manual capture fallback qua button `Chụp thủ công`.

### 3.5 UI hiện tại

File: `components/camera/camera-preview.tsx`

UI hiện có:

- Header “MomentAI Gesture POC”.
- Chọn camera.
- Nút “Kết nối lại”.
- Video preview trong khung `aspect-video`.
- Overlay:
  - gesture label
  - confidence
  - hold progress
  - state hiện tại
  - countdown
- Footer:
  - loading model
  - camera/gesture error
  - nút chụp thủ công
- Result screen:
  - hiển thị ảnh đã chụp
  - tải ảnh
  - chụp lại

---

## 4. Logic tính năng đã ổn định chưa?

### Kết luận ngắn

Chưa ổn định để production. Đủ tốt cho POC gesture camera, nhưng chưa đủ cho sản phẩm photobooth thật.

### 4.1 Điểm tốt

#### Có fallback chụp thủ công

Nếu gesture không hoạt động, user vẫn có thể bấm nút chụp.

#### Recognition không chạy mọi frame

Inference được giới hạn bằng:

```ts
inferenceIntervalMs: 66
```

Điều này tốt cho hiệu năng vì không block preview quá nhiều.

#### Có grace period khi mất gesture ngắn hạn

Config:

```ts
lostGestureGraceMs: 250
```

Giúp gesture không reset ngay nếu model mất tay trong thời gian ngắn.

#### Có action lock

Trong `use-booth-machine.ts`:

```ts
const actionLockedRef = useRef(false);
```

Giúp tránh trigger capture nhiều lần liên tiếp.

### 4.2 Vấn đề logic hiện tại

#### State machine chưa khớp định hướng kiến trúc

Trong `AGENTS.md`, state machine mục tiêu là:

```text
idle → camera-ready → countdown → capturing → processing → previewing → selecting → printing → completed
```

Hiện tại code chỉ có:

```text
idle → ready → countdown → capturing → result/error
```

Thiếu:

- `camera-ready`
- `processing`
- `previewing`
- `selecting`
- `printing`
- `completed`
- recoverable error states
- fatal error states

#### `ready` state chưa có ý nghĩa nghiệp vụ rõ

Hiện tại:

- `Open_Palm` làm state chuyển từ `idle` sang `ready`.
- Nhưng sau đó `Closed_Fist` vẫn có thể bắt đầu countdown từ `idle` hoặc `ready`.

Điều này khiến `ready` chỉ là label UI, chưa phải gate logic thật.

#### Error state khó recovery

Khi capture lỗi:

```ts
setState("error");
actionLockedRef.current = false;
```

Nhưng UI hiện tại không có màn hình hoặc hành động rõ ràng cho state `error`.

Footer chỉ show `cameraError || gesture.error`, không show capture error cụ thể từ `useBoothMachine`.

#### Countdown không cancel được

Khi countdown đã bắt đầu, nếu user bỏ tay ra hoặc camera mất kết nối, countdown vẫn tiếp tục.

Production cần:

- cancel countdown
- retry
- timeout
- camera disconnect handling
- explicit failure reason

#### Capture chưa lưu bền vững

Ảnh chỉ tồn tại dưới dạng object URL:

```ts
URL.createObjectURL(blob)
```

Khi reload page, ảnh mất.

Điều này chưa đạt nguyên tắc trong `AGENTS.md`:

> Never lose captured photos silently

#### Không có session model

Photobooth thường cần:

- session ID
- nhiều ảnh trong một session
- trạng thái session
- thời gian tạo
- selected photo
- output file path
- print status

Hiện tại chưa có.

---

## 5. Có thể scale sau này không?

### Kết luận ngắn

Có thể scale nếu refactor sớm. Hiện tại code có một số abstraction tốt, nhưng nếu tiếp tục thêm feature trực tiếp vào `CameraPreview`, sẽ nhanh chóng khó maintain.

### 5.1 Điểm hỗ trợ scale

#### Có adapter camera

File:

```text
services/camera/capture-card.adapter.ts
types/camera.ts
```

Interface:

```ts
export interface CameraAdapter {
    connect(deviceId?: string): Promise<MediaStream>;
    disconnect(): void;
    getStream(): MediaStream | null;
    capture(video: HTMLVideoElement): Promise<Blob>;
    getCapabilities?(): Promise<CameraCapabilities>;
    setISO?(value: number): Promise<void>;
    setAperture?(value: number): Promise<void>;
    setShutterSpeed?(value: string): Promise<void>;
    setWhiteBalance?(value: string): Promise<void>;
}
```

Đây là hướng đúng để sau này thay capture card bằng DSLR, webcam, phone camera, hoặc camera SDK.

#### Có config tập trung

File:

```text
config/booth.config.ts
```

Các thông số gesture, countdown, camera, mediapipe đã tập trung một chỗ.

#### Có tách hook AI

File:

```text
hooks/use-gesture-recognizer.ts
```

Tách AI gesture riêng khỏi camera adapter là hướng tốt.

### 5.2 Điểm cản scale

#### `CameraPreview` đang ôm quá nhiều trách nhiệm

File: `components/camera/camera-preview.tsx`

Hiện component này xử lý:

- camera stream binding
- auto connect
- object URL lifecycle
- capture
- gesture hook
- booth state machine hook
- result screen
- camera selector
- UI overlay
- retake
- manual capture

Nên tách ra:

```text
features/booth/
  components/
    BoothScreen.tsx
    CameraViewport.tsx
    GestureOverlay.tsx
    CountdownOverlay.tsx
    CaptureResult.tsx
    CameraDeviceSelector.tsx
  hooks/
    useBoothController.ts
  machine/
    booth-machine.ts
  services/
    session.service.ts
    photo-storage.service.ts
```

#### State machine đang nằm trong React hook

`use-booth-machine.ts` hiện là hook state thủ công.

Với flow phức tạp hơn, nên tách pure reducer/state machine để test được:

```text
features/booth/machine/booth-machine.ts
features/booth/machine/booth-machine.test.ts
```

#### Chưa có backend/local storage layer

Để scale PhotoBoothAI thật, cần một local-first storage layer:

- File system API qua backend route hoặc local service.
- IndexedDB nếu chạy browser-only.
- Session manifest JSON.
- Photo blob/file path.
- Print queue.

#### Chưa có module boundaries rõ theo pipeline

Theo `AGENTS.md`, pipeline cần tách:

```text
Camera
Preview
Recognition
Capture
Processing
Session
Storage
Printing
```

Hiện tại mới có:

- Camera
- Preview
- Recognition
- Capture

Chưa có:

- Processing
- Session
- Storage
- Printing

---

## 6. Có sai sót về cấu trúc file không?

### 6.1 Không phải sai nghiêm trọng, nhưng cấu trúc còn POC

Hiện tại cấu trúc:

```text
components/camera/
hooks/
services/camera/
types/
config/
```

Cấu trúc này ổn cho POC, nhưng chưa tối ưu cho feature-based scaling.

### 6.2 Vấn đề cụ thể

#### README vẫn là mặc định

File: `README.md`

Nội dung vẫn là template Next.js. Cần thay bằng:

- Mô tả MomentAI CameraOS.
- Cách chạy.
- Cách mở `/booth`.
- Yêu cầu camera permission.
- MediaPipe model.
- Known limitations.
- Hardware verification notes.

#### Home page vẫn là mặc định

File: `app/page.tsx`

Cần đổi sang landing/dev entry cho app:

- Link vào `/booth`.
- Trạng thái POC.
- Hướng dẫn cấp quyền camera.

#### Metadata vẫn là mặc định

File: `app/layout.tsx`

Cần đổi:

```ts
title: "MomentAI CameraOS"
description: "Local-first camera OS for PhotoBoothAI"
```

#### Public WASM bị lint scan

Lint hiện đang quét file generated/vendor:

```text
public/mediapipe/wasm/vision_wasm_internal.js
```

Đây là file generated từ MediaPipe, không nên lint.

Cần cấu hình ESLint ignore:

```text
public/mediapipe/**
.next/**
node_modules/**
```

#### Không có test folder

Chưa thấy:

```text
tests/
__tests__/
*.test.ts
*.spec.ts
```

Trong khi `AGENTS.md` yêu cầu test cho:

- state machine
- session logic
- capture
- processing
- storage
- e2e photobooth flow

#### `.next` tồn tại trong workspace

Có thư mục `.next` trong repo working directory. Nếu đã được ignore thì không sao, nhưng không nên đưa vào git.

Cần kiểm tra `git status` để đảm bảo `.next` không bị track.

---

## 7. Có thiếu sót về tính năng AI không?

### Kết luận ngắn

Có. AI hiện tại chỉ là gesture recognition rất cơ bản. Chưa có AI photo booth đúng nghĩa nếu mục tiêu là PhotoBoothAI.

### 7.1 AI hiện có

Hiện có:

- MediaPipe GestureRecognizer.
- Model local:

```text
public/models/gesture_recognizer.task
```

- WASM local:

```text
public/mediapipe/wasm/
```

- Detect 2 gesture:
  - `Open_Palm`
  - `Closed_Fist`

### 7.2 AI còn thiếu

Tuỳ định hướng sản phẩm, các AI feature còn thiếu có thể gồm:

#### Gesture AI nâng cao

- Multiple hands.
- Hand position zones.
- Gesture calibration per device/user.
- Lighting adaptation.
- Gesture debug panel.
- False-positive suppression.
- Gesture cooldown.
- Confidence smoothing.
- Camera mirroring consistency.

#### Face/person AI

- Face detection.
- Face alignment.
- Auto framing.
- Eye open / smile detection.
- Group detection.
- Subject presence check.
- Blur detection.
- Bad photo detection.

#### Image enhancement AI

- Background removal.
- Background replacement.
- Style transfer.
- Skin smoothing.
- Lighting correction.
- Super resolution.
- Generative template effects.

#### Operational AI fallback

Theo `AGENTS.md`, nếu AI fail:

- preview vẫn sống
- disable gestures
- allow touch controls
- log diagnostics

Hiện tại đã có manual capture fallback, nhưng chưa đầy đủ:

- chưa có explicit `ai-disabled` mode
- chưa có diagnostic logs structured
- chưa có retry model load
- chưa có clear UI mode khi AI fail
- chưa có telemetry local

### 7.3 Rủi ro AI hiện tại

#### MediaPipe chạy trên main thread

`recognizer.recognizeForVideo(...)` chạy trong hook trên main thread.

Dù đã throttle 15 FPS, trên máy yếu có thể ảnh hưởng preview/UI.

Nên cân nhắc:

- Web Worker.
- OffscreenCanvas.
- giảm input resolution cho inference.
- tách preview resolution và inference resolution.
- cho phép tắt AI khi performance thấp.

#### Delegate đang cố định CPU

File: `use-gesture-recognizer.ts`

```ts
delegate: "CPU"
```

Comment ghi CPU ổn định hơn cho POC macOS.

Production cần config:

```ts
delegate: "CPU" | "GPU"
```

và benchmark theo thiết bị.

#### Không kiểm tra model file missing

Nếu `public/models/gesture_recognizer.task` thiếu hoặc load lỗi, UI chỉ show error message. Chưa có:

- retry
- fallback mode rõ ràng
- health check
- preflight

---

## 8. Tốc độ có thể tối ưu hơn không?

### Kết luận ngắn

Có. Hiện tại tốc độ đủ cho POC, nhưng còn nhiều điểm tối ưu trước production.

### 8.1 Điểm đã làm tốt

#### Inference throttle

Config:

```ts
inferenceIntervalMs: 66
```

Tương đương khoảng 15 FPS, giúp giảm tải.

#### Không inference khi video chưa sẵn sàng

Code kiểm tra:

```ts
video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
video.videoWidth > 0
video.videoHeight > 0
!video.paused
!video.ended
```

#### Không overlap inference

Có flag:

```ts
isDetectingRef.current
```

### 8.2 Điểm cần tối ưu

#### Tách inference khỏi main thread

Hiện inference chạy trong requestAnimationFrame callback trên main thread.

Nên đưa vào worker nếu:

- kiosk chạy máy yếu
- UI bị giật
- model phức tạp hơn
- thêm face detection/photo AI

#### Giảm resolution cho AI

Camera đang request:

```ts
1280x720 @ 30fps
```

Gesture recognition không nhất thiết cần full 720p.

Có thể:

- preview vẫn 720p hoặc 1080p
- inference dùng frame downscale 256-512px
- capture dùng full frame

#### Tối ưu capture canvas

Mỗi lần capture tạo canvas mới:

```ts
document.createElement("canvas")
```

Với capture đơn lẻ không vấn đề. Nhưng nếu burst/multi-shot, nên reuse canvas hoặc service capture riêng.

#### Tránh setState quá thường xuyên

`useGestureRecognizer` gọi `setResult` trong loop inference. 15 FPS vẫn ổn, nhưng nếu tăng FPS sẽ gây render nhiều.

Có thể tối ưu bằng:

- update UI ở max 10-15 FPS
- lưu raw detection trong ref
- chỉ setState khi gesture hoặc progress thay đổi đáng kể
- dùng external store nếu cần

#### Object URL lifecycle cần chặt hơn

Hiện đã revoke object URL khi retake/unmount, đây là tốt.

Nhưng nếu có multi-photo session, cần quản lý nhiều object URL/file path rõ ràng.

---

## 9. Kết quả lint/build

Đã chạy:

```bash
pnpm lint && pnpm build
```

Kết quả: fail tại bước lint, nên build không chạy tiếp.

### 9.1 Lỗi trong code app

File: `hooks/use-booth-machine.ts`

```text
97:13 error react-hooks/set-state-in-effect
```

Do gọi:

```ts
setState("ready");
```

trực tiếp trong effect.

File: `hooks/use-gesture-recognizer.ts`

```text
155:14 error react-hooks/set-state-in-effect
172:13 error react-hooks/set-state-in-effect
```

Do effect gọi `initialize()` và `resetGesture()` dẫn tới setState.

Cần đánh giá lại rule hoặc refactor pattern effect.

### 9.2 Lỗi do lint quét MediaPipe generated WASM JS

File:

```text
public/mediapipe/wasm/vision_wasm_internal.js
```

Nhiều lỗi/warning kiểu:

- `@typescript-eslint/no-require-imports`
- `@typescript-eslint/no-this-alias`
- `react-hooks/rules-of-hooks`
- `@typescript-eslint/no-unused-vars`

Đây là vendor/generated file, không nên lint.

Cần cấu hình ESLint ignore cho:

```text
public/mediapipe/**
```

---

## 10. Acceptance criteria đề xuất cho giai đoạn ổn định MVP

Để xem là MVP ổn định hơn, nên đạt các tiêu chí sau:

### Camera/Preview

- User mở `/booth` và thấy preview camera.
- Nếu camera permission denied, UI hiển thị lỗi rõ ràng.
- Nếu camera disconnect, app không crash và có nút reconnect.
- Có thể chọn camera input.

### Gesture

- Nếu MediaPipe load thành công, app nhận `Open_Palm` và `Closed_Fist`.
- Nếu MediaPipe fail, preview vẫn chạy.
- Nếu AI fail, gesture bị disable nhưng manual capture vẫn hoạt động.
- Có UI báo AI disabled/fallback mode.

### Capture

- Countdown hoạt động.
- User có thể cancel hoặc retake.
- Capture không xảy ra nhiều lần do duplicate gesture.
- Ảnh capture được lưu vào session/local storage trước khi hiển thị result.
- Không mất ảnh silently.

### Session

- Mỗi lượt chụp có session ID.
- Session lưu metadata:
  - createdAt
  - photos
  - selectedPhoto
  - status
- Reload không làm mất ảnh đã capture gần nhất, nếu mục tiêu local-first.

### Processing

- Có placeholder processing state.
- Nếu processing fail, ảnh gốc vẫn còn.
- AI processing không block preview.

### Printing

- Có print state hoặc print placeholder.
- Nếu printer offline, UI báo lỗi rõ.
- Print failure không làm mất ảnh.

### Testing

- Có unit test state machine.
- Có test cho camera adapter capture logic ở mức mock.
- Có test cho session storage.
- `pnpm lint` pass.
- `pnpm build` pass.

---

## 11. Proposed design để scale an toàn

### 11.1 Tách theo feature/pipeline

Đề xuất cấu trúc:

```text
features/
  booth/
    components/
      BoothScreen.tsx
      CameraViewport.tsx
      GestureOverlay.tsx
      CountdownOverlay.tsx
      CaptureResult.tsx
      CameraDeviceSelector.tsx
      BoothErrorBanner.tsx
    hooks/
      useBoothController.ts
    machine/
      booth-machine.ts
      booth-machine.types.ts
    services/
      booth-session.service.ts

services/
  camera/
    capture-card.adapter.ts
    camera-device.service.ts
  recognition/
    mediapipe-gesture.service.ts
  storage/
    photo-storage.service.ts
    session-storage.service.ts
  processing/
    image-processing.service.ts
  printing/
    print-queue.service.ts

types/
  booth.ts
  camera.ts
  gesture.ts
  session.ts
  photo.ts
  print.ts

config/
  booth.config.ts
```

### 11.2 State machine nên mở rộng

Từ:

```ts
"idle" | "ready" | "countdown" | "capturing" | "result" | "error"
```

Sang:

```ts
type BoothState =
  | "idle"
  | "camera-ready"
  | "gesture-ready"
  | "countdown"
  | "capturing"
  | "processing"
  | "previewing"
  | "selecting"
  | "printing"
  | "completed"
  | "recoverable-error"
  | "fatal-error";
```

Hoặc chia nhỏ:

```ts
type BoothMode =
  | "setup"
  | "capture"
  | "review"
  | "print"
  | "complete";

type BoothErrorKind =
  | "camera-permission-denied"
  | "camera-disconnected"
  | "ai-unavailable"
  | "capture-failed"
  | "storage-failed"
  | "processing-failed"
  | "printer-offline";
```

### 11.3 AI fallback mode

Nên có contract rõ:

```ts
interface RecognitionStatus {
  enabled: boolean;
  loading: boolean;
  available: boolean;
  error?: string;
  mode: "active" | "disabled" | "failed" | "unsupported";
}
```

UI dùng status này để hiển thị:

- “AI gesture ready”
- “AI gesture unavailable — use touch capture”
- “Retry AI”

### 11.4 Storage/session local-first

Tối thiểu cần:

```ts
interface BoothSession {
  id: string;
  createdAt: string;
  status: BoothSessionStatus;
  photos: BoothPhoto[];
}

interface BoothPhoto {
  id: string;
  sessionId: string;
  objectUrl?: string;
  localPath?: string;
  blob?: Blob;
  createdAt: string;
  originalPreserved: boolean;
}
```

Browser-only có thể dùng IndexedDB.
Nếu có backend local app, nên lưu vào filesystem.

---

## 12. Impacted files/modules

Các file nên chỉnh trong phase tiếp theo:

### High priority

```text
eslint.config.mjs
README.md
app/page.tsx
app/layout.tsx
components/camera/camera-preview.tsx
hooks/use-booth-machine.ts
hooks/use-gesture-recognizer.ts
types/booth.ts
```

### Medium priority

```text
services/camera/capture-card.adapter.ts
hooks/use-camera.ts
config/booth.config.ts
```

### New files đề xuất

```text
features/booth/machine/booth-machine.ts
features/booth/machine/booth-machine.test.ts
types/session.ts
types/photo.ts
services/storage/session-storage.service.ts
services/storage/photo-storage.service.ts
```

---

## 13. Implementation tasks đề xuất

### Phase 1 — Stabilize POC

1. Cấu hình ESLint ignore cho MediaPipe generated files.
2. Fix hoặc điều chỉnh lỗi `react-hooks/set-state-in-effect`.
3. Đổi README khỏi template Next.js.
4. Đổi home page và metadata.
5. Thêm error UI cho capture error.
6. Thêm explicit AI fallback UI.
7. Chạy lại:
   - `pnpm lint`
   - `pnpm build`

### Phase 2 — Refactor booth flow

1. Tách `CameraPreview` thành component nhỏ.
2. Tách state machine thành pure module.
3. Thêm state `camera-ready`, `processing`, `previewing`.
4. Thêm unit test cho transition.
5. Thêm capture cancel/retry behavior.

### Phase 3 — Local-first session/photo storage

1. Thiết kế `BoothSession`.
2. Lưu ảnh sau capture vào IndexedDB hoặc local backend.
3. Đảm bảo ảnh gốc không mất nếu processing fail.
4. Thêm session recovery.
5. Thêm test session logic.

### Phase 4 — AI hardening

1. Thêm recognition status.
2. Thêm retry MediaPipe.
3. Thêm AI disabled mode.
4. Benchmark CPU/GPU delegate.
5. Cân nhắc worker/offscreen inference.
6. Thêm debug panel cho confidence/FPS.

### Phase 5 — Full photobooth pipeline

1. Processing stage.
2. Photo selection.
3. Print queue.
4. Printer offline handling.
5. Completion screen.
6. E2E test complete flow.

---

## 14. Test plan

### 14.1 Commands

Sau khi fix lint:

```bash
pnpm lint
pnpm build
```

Sau khi thêm test framework:

```bash
pnpm test
```

### 14.2 Manual test checklist

#### Camera

- Mở `/booth`.
- Cho phép camera.
- Preview hiển thị.
- Chọn camera khác nếu có.
- Bấm reconnect.
- Tắt quyền camera và kiểm tra lỗi.

#### Gesture

- Đưa tay open palm.
- Kiểm tra state sang ready.
- Giữ closed fist.
- Countdown chạy.
- Capture thành công.
- Kiểm tra manual capture khi che tay hoặc AI lỗi.

#### Capture

- Ảnh hiển thị đúng chiều.
- Tải ảnh được.
- Chụp lại revoke ảnh cũ.
- Không capture duplicate khi giữ nắm tay lâu.

#### AI failure

- Đổi path model sai để test fail.
- Preview vẫn chạy.
- Manual capture vẫn dùng được.
- UI báo lỗi dễ hiểu.

#### Performance

- Kiểm tra CPU usage.
- Kiểm tra preview có giật không.
- Test trên máy yếu hoặc kiosk hardware thật.
- Test nhiều lần capture liên tục.

---

## 15. Risks and rollback

### 15.1 Rủi ro hiện tại

#### Mất ảnh

Ảnh chỉ nằm trong memory object URL. Reload là mất.

#### AI ảnh hưởng preview

MediaPipe chạy main thread, có thể giật UI trên máy yếu.

#### State machine chưa đủ

Dễ phát sinh bug khi thêm processing/printing nếu không refactor.

#### Không có test

Thay đổi nhỏ trong gesture/countdown có thể làm hỏng flow mà không biết.

#### Lint fail

Hiện CI/build quality gate chưa sạch.

### 15.2 Migration concerns

Nếu refactor quá lớn một lần, dễ làm hỏng POC đang chạy.

Nên đi theo hướng:

1. Fix lint/build.
2. Thêm tests quanh behavior hiện tại.
3. Tách state machine.
4. Tách UI.
5. Thêm storage/session.

### 15.3 Rollback strategy

Mỗi phase nên commit nhỏ:

- Nếu refactor state machine lỗi, rollback về hook hiện tại.
- Nếu AI worker gây lỗi, fallback về main-thread recognizer.
- Nếu storage lỗi, vẫn giữ original blob/object URL flow như temporary fallback.
- Nếu processing fail, luôn giữ ảnh gốc.

---

## 16. Kết luận cuối

Codebase hiện tại phù hợp với một **gesture camera POC** và đã có hướng đúng ở vài điểm:

- Có camera adapter.
- Có config tập trung.
- Có MediaPipe local.
- Có gesture throttle.
- Có manual capture fallback.
- Có capture cơ bản.

Nhưng chưa thể xem là PhotoBoothAI CameraOS hoàn chỉnh hoặc production-ready.

Các việc cần ưu tiên:

1. Fix lint/build.
2. Không lint vendor MediaPipe files.
3. Refactor `CameraPreview` vì đang quá lớn.
4. Tách state machine khỏi React hook.
5. Thêm session/photo storage để không mất ảnh.
6. Thêm AI fallback mode rõ ràng.
7. Thêm test cho state machine và capture/session.
8. Mở rộng pipeline theo `AGENTS.md`: processing, selecting, printing, completed.
9. Tối ưu performance bằng worker/downscale nếu target kiosk yếu.

Đánh giá readiness:

```text
POC readiness:        70%
MVP readiness:        35%
Production readiness: 15%
Scalability base:     45%
AI completeness:      20%
```
