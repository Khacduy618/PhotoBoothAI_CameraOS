import type { CameraStatus } from "@/types/camera";

/**
 * Exposes a localized, decoupled display label for core CameraStatus enums.
 * This separates state definitions from UI language strings for clean i18n support.
 */
export function getCameraStatusLabel(status: CameraStatus): string {
    switch (status) {
        case "idle":
            return "Chờ kết nối";
        case "requesting-permission":
            return "Đang yêu cầu quyền truy cập camera...";
        case "connecting":
            return "Đang kết nối camera...";
        case "initializing":
            return "Đang khởi tạo cấu hình...";
        case "ready":
            return "Camera sẵn sàng";
        case "disconnected":
            return "Camera đã ngắt kết nối. Vui lòng kết nối lại.";
        case "error":
            return "Lỗi kết nối camera";
        default:
            return "Không xác định";
    }
}
