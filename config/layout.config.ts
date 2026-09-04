import type {
    BoothCountdownSeconds,
    BoothLayoutConfig,
    BoothLayoutId,
} from "@/types/customization";

export const boothLayoutConfigs = [
    { id: "single-portrait-1200x1800", name: "1 ảnh dọc", description: "Một ảnh lớn khổ dọc 1200x1800.", columns: 1, rows: 1, shotCount: 1, outputWidth: 1200, outputHeight: 1800, orientation: "portrait", layoutFamily: "single" },
    { id: "single-landscape-1800x1200", name: "1 ảnh ngang", description: "Một ảnh lớn khổ ngang 1800x1200.", columns: 1, rows: 1, shotCount: 1, outputWidth: 1800, outputHeight: 1200, orientation: "landscape", layoutFamily: "single" },
    { id: "two-portrait-1x2", name: "2 ảnh dọc 1x2", description: "Hai ảnh xếp dọc 1 cột x 2 hàng.", columns: 1, rows: 2, shotCount: 2, outputWidth: 1200, outputHeight: 1800, orientation: "portrait", layoutFamily: "1x2" },
    { id: "two-landscape-1x2", name: "2 ảnh ngang 1x2", description: "Hai ảnh ngang xếp 1 cột x 2 hàng.", columns: 1, rows: 2, shotCount: 2, outputWidth: 1800, outputHeight: 1200, orientation: "landscape", layoutFamily: "1x2" },
    { id: "four-portrait-2x2", name: "4 ảnh dọc 2x2", description: "Bốn ảnh dạng lưới 2x2 trên khổ dọc.", columns: 2, rows: 2, shotCount: 4, outputWidth: 1200, outputHeight: 1800, orientation: "portrait", layoutFamily: "2x2" },
    { id: "four-landscape-2x2", name: "4 ảnh ngang 2x2", description: "Bốn ảnh dạng lưới 2x2 trên khổ ngang.", columns: 2, rows: 2, shotCount: 4, outputWidth: 1800, outputHeight: 1200, orientation: "landscape", layoutFamily: "2x2" },
    { id: "four-portrait-1x4", name: "4 ảnh dọc 1x4", description: "Bốn ảnh xếp một cột trên khổ dọc.", columns: 1, rows: 4, shotCount: 4, outputWidth: 1200, outputHeight: 1800, orientation: "portrait", layoutFamily: "1x4" },
    { id: "four-landscape-1x4", name: "4 ảnh ngang 1x4", description: "Canvas ngang 1800x1200 với 4 slot xếp dọc 1 cột.", columns: 1, rows: 4, shotCount: 4, outputWidth: 1800, outputHeight: 1200, orientation: "landscape", layoutFamily: "1x4" },
    { id: "six-portrait-2x3", name: "6 ảnh dọc 2x3", description: "Sáu ảnh dạng 2 cột x 3 hàng trên khổ dọc.", columns: 2, rows: 3, shotCount: 6, outputWidth: 1200, outputHeight: 1800, orientation: "portrait", layoutFamily: "2x3" },
    { id: "six-landscape-2x3", name: "6 ảnh ngang 2x3", description: "Sáu ảnh ngang dạng 2 cột x 3 hàng trên khổ ngang.", columns: 2, rows: 3, shotCount: 6, outputWidth: 1800, outputHeight: 1200, orientation: "landscape", layoutFamily: "2x3" },
    { id: "eight-portrait-2x4", name: "8 ảnh dọc 2x4", description: "Tám ảnh: 4 hình bên trái và 4 hình bên phải.", columns: 2, rows: 4, shotCount: 8, outputWidth: 1200, outputHeight: 1800, orientation: "portrait", layoutFamily: "2x4" },
    { id: "eight-landscape-2x4", name: "8 ảnh ngang 2x4", description: "Tám ảnh ngang dạng 2 cột x 4 hàng trên khổ ngang.", columns: 2, rows: 4, shotCount: 8, outputWidth: 1800, outputHeight: 1200, orientation: "landscape", layoutFamily: "2x4" },
] as const satisfies readonly BoothLayoutConfig[];

export const countdownSecondOptions = [
    8,
] as const satisfies readonly BoothCountdownSeconds[];

export type BoothShotCount = 1 | 2 | 4 | 6 | 8;

export const defaultLayoutIdByShotCount = Object.freeze({
    1: "single-portrait-1200x1800",
    2: "two-portrait-1x2",
    4: "four-portrait-2x2",
    6: "six-portrait-2x3",
    8: "eight-portrait-2x4",
} satisfies Record<BoothShotCount, BoothLayoutId>);

export const supportedShotCounts = Object.freeze(
    Object.keys(defaultLayoutIdByShotCount).map(Number) as BoothShotCount[],
);

export const defaultBoothLayoutId: BoothLayoutId =
    defaultLayoutIdByShotCount[4];

export function resolveDefaultLayoutIdForShotCount(
    shotCount: number,
): BoothLayoutId {
    return defaultLayoutIdByShotCount[shotCount as BoothShotCount] ?? defaultBoothLayoutId;
}

export const defaultCountdownSeconds: BoothCountdownSeconds =
    countdownSecondOptions[0];

const legacyLayoutAliases: Record<string, BoothLayoutId> = {
    "two-landscape-2x1": "two-landscape-1x2",
    "six-landscape-3x2": "six-landscape-2x3",
    "eight-landscape-4x2": "eight-landscape-2x4",
    "2x2": "four-portrait-2x2",
    "1x4-vertical": "four-portrait-1x4",
    "2x3": "six-portrait-2x3",
    "single-4x6-landscape": "single-landscape-1800x1200",
    "stacked-2-4x6-portrait": "two-portrait-1x2",
    "grid-2x2-4x6-portrait": "four-portrait-2x2",
    "stacked-4-4x6-portrait": "four-portrait-1x4",
    "grid-2x3-4x6-portrait": "six-portrait-2x3",
    "grid-2x4-4x6-portrait": "eight-portrait-2x4",
};

export function resolveBoothLayoutConfig(
    layoutId: string,
): BoothLayoutConfig {
    const resolvedLayoutId = legacyLayoutAliases[layoutId] ?? layoutId;
    return boothLayoutConfigs.find((layout) => layout.id === resolvedLayoutId) ?? boothLayoutConfigs[0];
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
