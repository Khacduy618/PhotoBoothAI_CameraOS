import { getLayoutGeometry } from "@/services/layout/layout-engine";
import type {
    BoothCountdownSeconds,
    BoothLayoutConfig,
    BoothLayoutId,
} from "@/types/customization";

export const boothLayoutConfigs = [
    {
        id: "2x2",
        name: "2x2",
        description: "Bốn ảnh dạng lưới vuông, dễ thương và dễ chia sẻ.",
        columns: 2,
        rows: 2,
        shotCount: 4,
        outputWidth: 1600,
        outputHeight: 1600,
        orientation: "square",
    },
    {
        id: "1x4-vertical",
        name: "1x4 dọc",
        description: "Bốn ảnh dạng strip dọc phong cách photobooth cổ điển.",
        columns: 1,
        rows: 4,
        shotCount: 4,
        outputWidth: 1200,
        outputHeight: 4800,
        orientation: "portrait",
    },
    {
        id: "2x3",
        name: "2x3",
        description: "Sáu ảnh dạng lưới dọc cho nhóm bạn và sự kiện.",
        columns: 2,
        rows: 3,
        shotCount: 6,
        outputWidth: 1600,
        outputHeight: 2400,
        orientation: "portrait",
    },
] as const satisfies readonly BoothLayoutConfig[];

export const countdownSecondOptions = [
    3,
    6,
    8,
    10,
] as const satisfies readonly BoothCountdownSeconds[];

export const defaultBoothLayoutId: BoothLayoutId =
    boothLayoutConfigs[0].id;

export const defaultCountdownSeconds: BoothCountdownSeconds =
    countdownSecondOptions[0];

export function resolveBoothLayoutConfig(
    layoutId: string,
): BoothLayoutConfig {
    const staticConfig = boothLayoutConfigs.find((layout) => layout.id === layoutId) ?? boothLayoutConfigs[0];
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
    return boothLayoutConfigs.some((layout) => layout.id === layoutId);
}

export function isBoothCountdownSeconds(
    seconds: number,
): seconds is BoothCountdownSeconds {
    return countdownSecondOptions.some((option) => option === seconds);
}
