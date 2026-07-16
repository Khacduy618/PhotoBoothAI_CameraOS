# Stabilize POC Plan

Ngày tạo: 2026-07-16

## Goal

Ổn định PhotoBoothAI CameraOS POC ở mức tối thiểu để quality gate cơ bản chạy được, không mở rộng scope tính năng.

## Approved scope

1. Tạo plan riêng cho phase `Stabilize POC`.
2. Fix ESLint ignore cho MediaPipe generated files.
3. Fix các lỗi React hook lint hiện tại.
4. Chạy `pnpm lint`.
5. Chạy `pnpm build`.

## Acceptance criteria

- Có file plan trong `docs/STABILIZE_POC_PLAN.md`.
- ESLint không lint vendor/generated MediaPipe WASM files trong `public/mediapipe/**`.
- Các lỗi `react-hooks/set-state-in-effect` trong hook hiện tại được xử lý mà không thay đổi luồng POC chính.
- `pnpm lint` hoàn tất thành công.
- `pnpm build` hoàn tất thành công.

## Risks

- Worktree đang có nhiều file untracked/modified; chỉ chỉnh các file trong scope.
- Việc tắt rule quá rộng có thể che lỗi thật; chỉ ignore generated/vendor assets.
- Sửa hook để pass lint không được làm thay đổi behavior capture/gesture hiện tại.
- Build có thể phát hiện lỗi khác ngoài lint.

## Implementation plan

1. Inspect current worktree and lint config.
2. Add MediaPipe generated path to ESLint global ignores.
3. Refactor `use-booth-machine.ts` để tránh setState trực tiếp trong effect body bằng cách defer state transition qua timer cleanup-safe.
4. Refactor `use-gesture-recognizer.ts` để tránh setState trực tiếp trong effect body bằng cách defer initialization/reset scheduling qua timer cleanup-safe.
5. Run `pnpm lint`.
6. Run `pnpm build`.
7. Record evidence and remaining risks.

## Out of scope

- Không refactor toàn bộ state machine.
- Không thêm session storage.
- Không thêm AI processing.
- Không đổi UI/UX ngoài mức cần thiết cho lint/build.
- Không sửa README/home page trong phase này.

## Rollback plan

- Nếu ESLint ignore gây vấn đề, revert thay đổi trong `eslint.config.mjs`.
- Nếu hook behavior bị ảnh hưởng, revert hook changes và chọn hướng cấu hình rule cụ thể hơn.
- Nếu build fail vì vấn đề không thuộc scope, ghi nhận rõ và xin scope bổ sung.
