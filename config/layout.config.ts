import { getLayoutGeometry } from "@/services/layout/layout-engine";
import type {
    BoothCountdownSeconds,
    BoothLayoutConfig,
    BoothLayoutId,
} from "@/types/customization";

export const boothLayoutConfigs = [
    {
        id: "single-4x6-landscape",
        name: "1 ảnh ngang",
        description: "Một ảnh lớn khổ ngang 6x4, chừa lề 60px để vẽ tay.",
        columns: 1,
        rows: 1,
        shotCount: 1,
        outputWidth: 1800,
        outputHeight: 1200,
        orientation: "landscape",
    },
    {
        id: "stacked-2-4x6-portrait",
        name: "2 ảnh stacked",
        description: "Hai ảnh xếp dọc 1 cột x 2 hàng trên khung 4x6.",
        columns: 1,
        rows: 2,
        shotCount: 2,
        outputWidth: 1200,
        outputHeight: 1800,
        orientation: "portrait",
    },
    {
        id: "grid-2x2-4x6-portrait",
        name: "4 ảnh 2x2",
        description: "Bốn ảnh dạng lưới 2x2 trên khung 4x6 dọc.",
        columns: 2,
        rows: 2,
        shotCount: 4,
        outputWidth: 1200,
        outputHeight: 1800,
        orientation: "portrait",
    },
    {
        id: "stacked-4-4x6-portrait",
        name: "4 ảnh 1 cột",
        description: "Bốn ảnh xếp theo một cột, chừa lề 60px để khách vẽ thêm.",
        columns: 1,
        rows: 4,
        shotCount: 4,
        outputWidth: 1200,
        outputHeight: 1800,
        orientation: "portrait",
    },
    {
        id: "grid-2x3-4x6-portrait",
        name: "6 ảnh 2x3",
        description: "Sáu ảnh dạng lưới 2 cột x 3 hàng trên khung 4x6 dọc.",
        columns: 2,
        rows: 3,
        shotCount: 6,
        outputWidth: 1200,
        outputHeight: 1800,
        orientation: "portrait",
    },
    {
        id: "grid-2x4-4x6-portrait",
        name: "8 ảnh 2x4",
        description: "Tám ảnh dọc: 4 hình bên trái và 4 hình bên phải, chừa lề đáy 60px.",
        columns: 2,
        rows: 4,
        shotCount: 8,
        outputWidth: 1200,
        outputHeight: 1800,
        orientation: "portrait",
    },
] as const satisfies readonly BoothLayoutConfig[];

export const countdownSecondOptions = [
    8,
] as const satisfies readonly BoothCountdownSeconds[];

export const defaultBoothLayoutId: BoothLayoutId =
    boothLayoutConfigs[0].id;

export const defaultCountdownSeconds: BoothCountdownSeconds =
    countdownSecondOptions[0];

const legacyLayoutAliases: Record<string, BoothLayoutId> = {
    "2x2": "grid-2x2-4x6-portrait",
    "1x4-vertical": "stacked-4-4x6-portrait",
    "2x3": "grid-2x3-4x6-portrait",
};

export function resolveBoothLayoutConfig(
    layoutId: string,
): BoothLayoutConfig {
    const resolvedLayoutId = legacyLayoutAliases[layoutId] ?? layoutId;
    const staticConfig = boothLayoutConfigs.find((layout) => layout.id === resolvedLayoutId) ?? boothLayoutConfigs[0];
    const geometry = getLayoutGeometry(staticConfig.id);
    return {
        ...staticConfig,
        columns: geometry.columns,
        rows: geometry.rows,
        outputWidth: geometry.outputWidth,
        outputHeight: geometry.outputHeight,
    };
}

export function isBoothLayoutId(
    layoutId: string,
): layoutId is BoothLayoutId {
    return boothLayoutConfigs.some((layout) => layout.id === layoutId) || layoutId in legacyLayoutAliases;
}

export function isBoothCountdownSeconds(
    seconds: number,
): seconds is BoothCountdownSeconds {
    return countdownSecondOptions.some((option) => option === seconds);
}
