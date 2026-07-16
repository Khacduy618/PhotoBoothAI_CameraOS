# Manual Smoke Test Checklist

Ngày tạo: 2026-07-16

## Context

Hiện tại POC mới được thử tính năng chụp và luồng sử dụng chính trên máy Mac. Chưa có capture card, HDMI capture, camera rời hoặc printer tại môi trường test hiện tại.

Checklist này dùng để kiểm thử thủ công khi có browser/camera/hardware phù hợp.

## Environment

- OS: macOS hoặc kiosk target OS
- Browser: Chrome/Edge/Safari phiên bản mới
- App URL: `http://localhost:3000/booth`
- Command khởi chạy: `pnpm dev`

## Preflight

- [ ] Node.js version `>=20.19.0`.
- [ ] `pnpm install` hoàn tất.
- [ ] `pnpm lint` pass.
- [ ] `pnpm build` pass.
- [ ] `pnpm test` pass.
- [ ] Browser có quyền camera.
- [ ] MediaPipe model tồn tại tại `public/models/gesture_recognizer.task`.
- [ ] MediaPipe WASM assets tồn tại tại `public/mediapipe/wasm`.

## Camera preview

- [ ] Mở `/booth`.
- [ ] Browser hỏi quyền camera nếu chưa cấp quyền.
- [ ] Cho phép camera.
- [ ] Preview hiển thị trong khung video.
- [ ] Preview không bị freeze trong ít nhất 60 giây.
- [ ] Nếu có nhiều camera, dropdown hiển thị danh sách camera.
- [ ] Chọn camera khác và bấm `Kết nối lại`.
- [ ] App không crash khi reconnect.

## Gesture AI

- [ ] UI hiển thị trạng thái đang tải model gesture.
- [ ] Sau khi model load, không còn lỗi MediaPipe.
- [ ] Đưa bàn tay mở vào khung hình.
- [ ] UI nhận `Open Palm` và confidence thay đổi.
- [ ] Giữ open palm đủ lâu, booth state chuyển `READY`.
- [ ] Đưa nắm tay vào khung hình.
- [ ] UI nhận `Closed Fist` và confidence thay đổi.
- [ ] Giữ closed fist đủ lâu, countdown bắt đầu.

## Capture flow

- [ ] Countdown hiển thị từ cấu hình hiện tại.
- [ ] Countdown không làm preview crash.
- [ ] Sau countdown, app capture ảnh.
- [ ] Result screen hiển thị ảnh vừa chụp.
- [ ] Ảnh đúng chiều mong đợi với preview mirror.
- [ ] Nút tải ảnh hoạt động.
- [ ] Nút `Chụp lại` reset về preview.
- [ ] Chụp lại lần 2 không dùng lại ảnh cũ.

## Manual fallback

- [ ] Không cần gesture, bấm `Chụp thủ công`.
- [ ] Countdown bắt đầu.
- [ ] Capture thành công.
- [ ] Manual capture vẫn hoạt động nếu AI gesture không nhận tay.

## Recovery checks

- [ ] Bấm `Chụp lại` trong result screen đưa state về idle.
- [ ] Reconnect camera sau khi preview đang chạy.
- [ ] Từ chối quyền camera trong browser và xác nhận UI báo lỗi rõ ràng.
- [ ] Nếu model MediaPipe bị thiếu hoặc path sai, preview vẫn có thể chạy và manual capture vẫn dùng được.
- [ ] Điều hướng ra khỏi `/booth` trong lúc countdown không gây capture muộn hoặc console error nghiêm trọng.
- [ ] Refresh page trong lúc app đang idle không gây lỗi.

## Performance smoke

- [ ] Preview mượt trong ít nhất 2 phút.
- [ ] Gesture overlay không lag nghiêm trọng.
- [ ] CPU không tăng bất thường khi chỉ preview.
- [ ] Capture hoàn tất trong thời gian người dùng chấp nhận được.

## Notes

Ghi lại:

- Browser/version:
- Camera/capture device:
- Resolution thực tế:
- Lỗi console nếu có:
- FPS/CPU cảm nhận:
- Kết quả pass/fail:
