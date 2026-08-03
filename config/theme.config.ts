import {
    defaultBoothLayoutId,
    defaultCountdownSeconds,
    isBoothLayoutId,
} from "@/config/layout.config";
import { frameConfigs } from "@/config/frame.config";
export { frameConfigs, resolveFrameConfig } from "@/config/frame.config";
import type {
    BoothSelection,
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

export const defaultBoothSelection: BoothSelection = Object.freeze({
    themeId: "classic",
    frameId: "white-border-portrait",
    styleId: "none",
    layoutId: defaultBoothLayoutId,
    countdownSeconds: 8,
    customization: {
        stickerItems: [],
        textLabels: [],
        drawingStrokes: [],
        overlays: [],
    },
});

export function resolveThemeConfig(
    themeId: string,
): ThemeConfig {
    return (
        themeConfigs.find((theme) => theme.id === themeId) ??
        themeConfigs[0]
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
        countdownSeconds: defaultCountdownSeconds,
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
            selection.countdownSeconds === defaultCountdownSeconds,
    );
}
