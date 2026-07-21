import {
    defaultBoothLayoutId,
    defaultCountdownSeconds,
    isBoothCountdownSeconds,
    isBoothLayoutId,
} from "@/config/layout.config";
import type {
    BoothSelection,
    FrameConfig,
    StyleConfig,
    ThemeConfig,
} from "@/types/theme";

export const themeConfigs = [
    {
        id: "classic",
        name: "Classic",
        description: "Nền sáng, chữ tối, phù hợp sự kiện trang trọng.",
        backgroundColor: "#f8fafc",
        textColor: "#111827",
        accentColor: "#2563eb",
    },
    {
        id: "party",
        name: "Party",
        description: "Màu nổi bật cho tiệc và activation.",
        backgroundColor: "#1e1b4b",
        textColor: "#ffffff",
        accentColor: "#f97316",
    },
    {
        id: "minimal",
        name: "Minimal",
        description: "Tối giản, ưu tiên ảnh chụp.",
        backgroundColor: "#ffffff",
        textColor: "#18181b",
        accentColor: "#71717a",
    },
] as const satisfies readonly ThemeConfig[];

export const frameConfigs = [
    {
        id: "none",
        name: "Không khung",
        description: "Giữ ảnh sạch, không thêm viền.",
        borderColor: "transparent",
        borderWidth: 0,
        kind: "none",
    },
    {
        id: "white-border",
        name: "Khung trắng",
        description: "Khung trắng photobooth để thêm nhãn, sticker và nét vẽ custom.",
        borderColor: "#ffffff",
        borderWidth: 32,
        kind: "solid",
    },
    {
        id: "pink-heart",
        name: "Khung Tim Dễ Thương",
        description: "Khung họa tiết Trái tim hồng Pastel đáng yêu.",
        borderColor: "#fce7f3",
        borderWidth: 36,
        kind: "template",
        patternUrl: "/frames/pink-heart-pattern.jpg",
    },
    {
        id: "lavender-star",
        name: "Khung Mây Sao Tím",
        description: "Khung họa tiết Ngôi sao lấp lánh tím pastel.",
        borderColor: "#f3e8ff",
        borderWidth: 36,
        kind: "template",
        patternUrl: "/frames/lavender-star-pattern.jpg",
    },
    {
        id: "gold",
        name: "Viền vàng",
        description: "Khung viền vàng nổi bật cho khoảnh khắc kỷ niệm.",
        borderColor: "#facc15",
        borderWidth: 32,
        kind: "solid",
    },
] as const satisfies readonly FrameConfig[];

export const styleConfigs = [
    {
        id: "none",
        name: "Không style",
        description: "Giữ màu ảnh gốc.",
        mode: "none",
    },
    {
        id: "grayscale",
        name: "Đen trắng",
        description: "Hiệu ứng đơn sắc cổ điển.",
        mode: "grayscale",
    },
    {
        id: "warm",
        name: "Warm",
        description: "Tông ấm nhẹ cho ảnh sự kiện.",
        mode: "warm",
    },
] as const satisfies readonly StyleConfig[];

export const defaultBoothCustomization = {
    stickerItems: [],
    textLabels: [],
    drawingStrokes: [],
    overlays: [],
} as const;

export const defaultBoothSelection: BoothSelection = {
    themeId: themeConfigs[0].id,
    frameId: frameConfigs[0].id,
    styleId: styleConfigs[0].id,
    layoutId: defaultBoothLayoutId,
    countdownSeconds: defaultCountdownSeconds,
    customization: defaultBoothCustomization,
};

export function resolveThemeConfig(
    themeId: string,
): ThemeConfig {
    return (
        themeConfigs.find((theme) => theme.id === themeId) ??
        themeConfigs[0]
    );
}

export function resolveFrameConfig(
    frameId: string,
): FrameConfig {
    return (
        frameConfigs.find((frame) => frame.id === frameId) ??
        frameConfigs[0]
    );
}

export function resolveStyleConfig(
    styleId: string,
): StyleConfig {
    return (
        styleConfigs.find((style) => style.id === styleId) ??
        styleConfigs[0]
    );
}

export function normalizeBoothSelection(
    selection: Partial<BoothSelection> | undefined,
): BoothSelection {
    return {
        ...defaultBoothSelection,
        ...selection,
        frameColor: selection?.frameColor,
        customization: {
            ...defaultBoothCustomization,
            ...selection?.customization,
        },
        layoutId: selection?.layoutId && isBoothLayoutId(selection.layoutId)
            ? selection.layoutId
            : defaultBoothSelection.layoutId,
        countdownSeconds: selection?.countdownSeconds &&
            isBoothCountdownSeconds(selection.countdownSeconds)
            ? selection.countdownSeconds
            : defaultBoothSelection.countdownSeconds,
    };
}

export function isBoothSelectionComplete(
    selection: BoothSelection,
): boolean {
    return Boolean(
        themeConfigs.some((theme) => theme.id === selection.themeId) &&
            frameConfigs.some((frame) => frame.id === selection.frameId) &&
            styleConfigs.some((style) => style.id === selection.styleId) &&
            isBoothLayoutId(selection.layoutId) &&
            isBoothCountdownSeconds(selection.countdownSeconds),
    );
}
