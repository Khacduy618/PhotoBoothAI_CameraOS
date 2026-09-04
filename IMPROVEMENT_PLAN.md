# MomentAI CameraOS — Improvement Roadmap

**Cập nhật:** 2026-09-03  
**Nguyên tắc:** 4 việc/ngày, ưu tiên từ critical → high → medium → low  
**Quy tắc:** Mỗi việc phải có test hoặc manual evidence trước khi đánh dấu DONE

---

## ✅ ĐÃ HOÀN THÀNH (Cleanup Sprint)

- [x] Xóa dead code: components/booth, wizard, editor, customize, result, momentai-photobooth, selectors
- [x] Xóa dead code: components/camera (camera-preview, camera-provider)
- [x] Xóa dead services: render (layout-compositor, render-plan, text-layout, photo-slot-resolver, object-fit, …)
- [x] Xóa dead services: layout/layout-engine, layout/overlay-manager, booth/booth-flow-machine
- [x] Xóa dead services: platform/asset-manager, platform/plugin-registry
- [x] Xóa dead hooks: use-booth-machine
- [x] app/ giờ là API-only layer (xóa layout.tsx, page.tsx, globals.css, operator/, share/)
- [x] CI architecture check cập nhật để check API routes thay vì UI pages

---

## 🔴 TUẦN 1 — CRITICAL FIXES (P0/P1)

### Ngày 1 — Fix QR URL + Print Flow
- [ ] **[P0]** Validate `MOMENTAI_LANDING_BASE_URL` bắt buộc khi app start — throw error rõ ràng nếu thiếu thay vì fallback `localhost:5174`
- [ ] **[P0]** Thêm env validation vào `windowmini-bootstrap.ts` và Electron `app.ready` handler
- [ ] **[P1]** Sửa print flow: giữ màn hình "Đang in…" cho đến khi nhận ACK thực sự từ printer adapter thay vì show DONE ngay khi job queued
- [ ] **[P1]** Thêm `PrintStatus` polling trên `G08_DONE` screen — refresh mỗi 3 giây, hiện kết quả thật

### Ngày 2 — Navigation Guard + Admin Passcode
- [ ] **[P1]** Sửa navigation lock: release sau `action.finally()` chứ không phải `setTimeout(900ms)` cứng
- [ ] **[P1]** Gate admin passcode bypass `'0000'` bằng `isDev` flag — production không cho bypass
- [ ] **[P2]** Thêm error boundary cho `MomentAIGuestFlowController` — crash không được để lộ stack trace lên guest screen
- [ ] **[P2]** Thêm unit test cho navigation lock logic

### Ngày 3 — Session Architecture
- [ ] **[P1]** Di chuyển session orchestrator state ra khỏi Next.js HTTP process — session phải sống trong Electron Main (hoặc SQLite persistent store)
- [ ] **[P1]** `dispatchGuestSessionAction` phải dùng Electron IPC làm **primary**, HTTP làm fallback dev-only — thêm warning log khi dùng HTTP fallback trong production
- [ ] **[P2]** Thêm session recovery: nếu Electron restart giữa session, load lại từ SQLite
- [ ] **[P2]** Viết test: session survive Electron renderer reload

### Ngày 4 — Admin UI: Event Management
- [ ] **[P1]** Build `EventsPanel` component trong `AdminShell` — list/create events từ `admin.events.list()` / `admin.events.create()`
- [ ] **[P1]** Kết nối `EventsPanel` với IPC (đã wired sẵn: `cameraos:admin:events:list`, `cameraos:admin:events:create`)
- [ ] **[P2]** Thêm tab navigation trong `AdminShell`: [Frame Import] [Events] [Health] [Logs]
- [ ] **[P2]** Persist selected tab trong `localStorage` để không reset khi toggle admin

---

## 🟡 TUẦN 2 — HIGH PRIORITY (P1/P2)

### Ngày 5 — Admin UI: Health Dashboard
- [ ] **[P1]** Implement `WindowMiniAdminHealthService.snapshot()` thực sự — query camera status qua `canonRuntime.state`, query printer via print queue, query storage via SQLite check
- [ ] **[P1]** Build `HealthPanel` UI: hiển thị camera/printer/storage/network status với màu sắc rõ ràng
- [ ] **[P2]** Auto-refresh health snapshot mỗi 10 giây khi AdminShell mở
- [ ] **[P2]** Show timestamp của lần check cuối cùng

### Ngày 6 — Admin UI: Log Viewer
- [ ] **[P1]** Implement `WindowMiniAdminLogsService.tail()` thực sự — đọc từ `artifacts/logs/momentai-cameraos.log`
- [ ] **[P1]** Build `LogsPanel` UI: hiển thị structured logs, filter theo level (info/warn/error), auto-scroll
- [ ] **[P2]** Thêm nút "Clear Logs" và "Download Logs" cho operator
- [ ] **[P2]** Highlight error/warn lines với màu đỏ/vàng

### Ngày 7 — Admin UI: Storage Cleanup
- [ ] **[P2]** Build `CleanupPanel` UI: hiển thị `cleanup.summary()` — dung lượng sessions, số file, ước tính có thể giải phóng
- [ ] **[P2]** Nút "Chạy Cleanup Ngay" với xác nhận — gọi `cleanup.runNow()`
- [ ] **[P2]** Hiển thị kết quả cleanup: bao nhiêu session đã xóa, dung lượng giải phóng
- [ ] **[P2]** Thêm cảnh báo nếu storage > 80% dung lượng disk

### Ngày 8 — Admin ↔ Web Sync
- [ ] **[P1]** Xác định và document rõ: `app/api/admin/frames` serve data từ SQLite nào — đảm bảo cùng file `.cameraos-data/admin.sqlite` với Electron Main
- [ ] **[P1]** Thêm middleware auth token cho `/api/admin/*` routes — hiện tại không có bảo vệ nào
- [ ] **[P2]** `LocalFrameRegistry.refreshFromAdminDb()` thêm retry với exponential backoff khi IPC fails
- [ ] **[P2]** Thêm test: frame imported qua IPC visible ngay lập tức trong guest flow

---

## 🟢 TUẦN 3 — MEDIUM PRIORITY (P2/P3)

### Ngày 9 — Performance: Composition Engine
- [ ] **[P3]** Tách `renderComposition()` sang Web Worker để không block renderer main thread
- [ ] **[P3]** Thêm progress callback: "Đang xử lý ảnh… 40%" thay vì màn hình trắng
- [ ] **[P2]** Giảm preview resolution (tối đa 2160px) tách biệt với print resolution
- [ ] **[P2]** Đo thời gian render thực tế và log vào structured log

### Ngày 10 — Camera Stability
- [ ] **[P2]** Implement auto-reconnect khi `canonRuntime.state` rơi vào `ERROR` hoặc `DISCONNECTED`
- [ ] **[P2]** Thêm UI indicator trên `AttractScreen` khi camera đang kết nối lại
- [ ] **[P2]** Canon shadow mode: thêm structured log đầy đủ hơn với timing data
- [ ] **[P3]** Test: simulate camera disconnect mid-session, verify recovery không mất session data

### Ngày 11 — LocalFrameRegistry Hardening
- [ ] **[P2]** Thêm TTL cho localStorage frame cache — default 24h, clear khi expired
- [ ] **[P2]** Thêm event ID validation khi load frames — tránh frames từ event cũ bleeding vào event mới
- [ ] **[P2]** Unit test `normalizeFrameDefinition` với các edge cases: oversized, low-res, missing targetProduct
- [ ] **[P2]** Unit test `isValidFrameDefinition` với các frame definition không hợp lệ

### Ngày 12 — Testing Coverage
- [ ] **[P2]** Viết unit test cho `MomentAIGuestFlowController` — mock IPC bridge, test state transitions
- [ ] **[P2]** Viết test: start-session → select-format → add-photos → select-template → compose → complete
- [ ] **[P2]** Viết test: QR URL generation với và không có `MOMENTAI_LANDING_BASE_URL`
- [ ] **[P2]** Viết test: `AdminFrameRecord`, `WindowMiniAdminTemplatesService` save/list/remove

---

## 🔵 TUẦN 4 — LOW PRIORITY / NICE TO HAVE (P3)

### Ngày 13 — Security Hardening
- [ ] **[P2]** Thêm auth middleware cho tất cả `/api/admin/*` routes (API key hoặc session token)
- [ ] **[P2]** Rate limiting cho `/api/momentai-guest-session` — tránh DDoS từ local network
- [ ] **[P3]** Audit `share-photo-client.tsx` và `app/s/[sessionId]/route.ts` — xác nhận không expose session data ngoài token owner
- [ ] **[P3]** Review tất cả `console.log` trong production code — xóa hoặc chuyển sang structured logger

### Ngày 14 — Developer Experience
- [ ] **[P3]** Viết `DEVELOPMENT.md` thực sự — hướng dẫn setup từ zero, common errors và cách fix
- [ ] **[P3]** Thêm `ARCHITECTURE.md` cập nhật: mô tả app/ là API-only layer, không phải admin web UI
- [ ] **[P3]** Thêm script `pnpm check:dead-code` để tự động phát hiện file không được import
- [ ] **[P3]** Setup pre-commit hook: typecheck + lint (hiện chỉ có state machine check + privacy scan)

### Ngày 15 — Cloud & QR
- [ ] **[P3]** Document `cloudSyncCoordinator` flow — Phase A / Phase B upload là gì, khi nào trigger
- [ ] **[P3]** Thêm fallback UI khi cloud upload fail: hiển thị local share URL thay vì QR trống
- [ ] **[P3]** Test QR URL trên điện thoại thực sự trong cùng mạng LAN
- [ ] **[P3]** Thêm timeout và error message khi `/s/[sessionId]` không tìm thấy media

### Ngày 16 — Polish & Cleanup
- [ ] **[P3]** Xóa các `*.log`, `*.txt`, `snapshot*.txt`, `screenshot*.png` ở root project nếu còn sót
- [ ] **[P3]** Review và update `README.md` — phản ánh architecture hiện tại (app/ là API-only)
- [ ] **[P3]** Dọn `docs/` — archive các report cũ, giữ lại chỉ docs còn relevant
- [ ] **[P3]** Chạy `pnpm verify` lần cuối sau tất cả changes — đảm bảo clean CI gate

---

## 📊 TỔNG KẾT PRIORITIES

| Priority | Số việc | Tuần |
|---|---|---|
| P0 (Critical — phải fix trước khi deploy) | 2 | Ngày 1 |
| P1 (High — fix trong sprint đầu) | 14 | Ngày 1–8 |
| P2 (Medium — cải thiện chất lượng) | 28 | Ngày 2–12 |
| P3 (Low — nice to have) | 20 | Ngày 9–16 |

---

## 🚨 KHÔNG BAO GIỜ ĐƯỢC LÀM

- ❌ Xóa `app/api/` — các routes này là backbone của toàn hệ thống
- ❌ Disconnect Canon EOS 6D khi reset guest session
- ❌ Merge vào `main` khi `pnpm verify` chưa pass
- ❌ Hardcode production camera device ID hoặc printer name
- ❌ Để session photos không được lưu trước khi render composition
- ❌ Push `.env.local` hoặc bất kỳ secrets lên git
