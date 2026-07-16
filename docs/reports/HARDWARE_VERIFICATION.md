# Hardware Verification

Ngày tạo: 2026-07-16

## Current verification status

Hiện tại mới kiểm thử tính năng chụp và luồng sử dụng chính trên **máy Mac**.

Chưa có trong môi trường hiện tại:

- Capture card.
- HDMI capture.
- Camera rời/DSLR/mirrorless thật.
- Printer.
- Kiosk touchscreen.
- Storage/USB workflow thực tế.

Vì vậy không claim production hardware readiness ở thời điểm này.

## Verified so far

| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| Mac local browser flow | Đã thử sơ bộ | Luồng chụp/chính đã được thử trên Mac |
| Built-in/webcam capture | Cần ghi rõ thiết bị cụ thể | Chưa có log thiết bị chi tiết |
| Capture card | Chưa verify | Chưa có phần cứng |
| HDMI capture | Chưa verify | Chưa có phần cứng |
| External camera | Chưa verify | Chưa có camera |
| Printer | Chưa verify | Chưa có printer integration |
| Kiosk touchscreen | Chưa verify | Chưa có thiết bị |
| Offline operation | Chưa verify đầy đủ | Core hiện local-first nhưng chưa có storage pipeline |

## Required hardware verification matrix

### Camera / capture input

- [ ] Built-in Mac camera.
- [ ] USB webcam.
- [ ] HDMI capture card.
- [ ] DSLR/mirrorless via HDMI capture.
- [ ] Camera disconnect while previewing.
- [ ] Camera reconnect after disconnect.
- [ ] Permission denied recovery.
- [ ] Multiple camera selection.

### Capture quality

- [ ] Output orientation correct.
- [ ] Output aspect ratio correct.
- [ ] Output resolution matches expected constraints.
- [ ] Capture latency acceptable.
- [ ] Repeated capture does not leak memory noticeably.
- [ ] Low light behavior acceptable.
- [ ] Bright light/backlight behavior acceptable.

### AI gesture recognition

- [ ] MediaPipe model loads offline.
- [ ] Open palm recognized at intended distance.
- [ ] Closed fist recognized at intended distance.
- [ ] False positives acceptable.
- [ ] Gesture detection still acceptable under event lighting.
- [ ] AI failure does not stop camera preview.
- [ ] Manual capture fallback works with AI disabled/failing.

### Printer / output

Not implemented yet, but future verification should include:

- [ ] Printer detected.
- [ ] Printer offline state shown clearly.
- [ ] Print queue retry.
- [ ] Print failure does not lose captured photo.
- [ ] Selected photo prints correctly.

### Storage

Not implemented yet, but future verification should include:

- [ ] Captured photo is persisted before processing.
- [ ] Reload does not silently lose latest saved photo.
- [ ] Storage full/error state is visible.
- [ ] Original photo remains if AI processing fails.

## Minimum hardware smoke test before field use

Before using with real users, verify at least:

1. Target Mac/kiosk machine.
2. Intended camera/capture-card path.
3. Intended browser/runtime.
4. 10 consecutive capture/retake cycles.
5. Camera disconnect/reconnect.
6. AI unavailable/manual fallback.
7. At least 15 minutes preview uptime.
8. No silent loss of captured photos once storage is implemented.

## Remaining risk statement

Until capture card, HDMI capture, external camera, and printer hardware are available, hardware readiness remains **unverified**. Current confidence only covers local Mac POC behavior and automated code-level lifecycle checks.
