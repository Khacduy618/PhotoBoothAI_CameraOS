import type {
    StickerConfig,
    TextLabelPresetConfig,
} from "@/types/theme";

export const stickerConfigs = [
    {
        id: "sparkle-heart",
        name: "Tim lấp lánh",
        description: "Sticker trái tim mềm mại cho ảnh đôi và bạn bè.",
        emoji: "💖",
    },
    {
        id: "cute-star",
        name: "Ngôi sao",
        description: "Sticker sao vui nhộn cho layout sự kiện.",
        emoji: "⭐",
    },
    {
        id: "party-popper",
        name: "Tiệc vui",
        description: "Sticker pháo giấy cho sinh nhật và activation.",
        emoji: "🎉",
    },
    {
        id: "flower-bloom",
        name: "Hoa nhỏ",
        description: "Sticker hoa dễ thương cho khung pastel.",
        emoji: "🌸",
    },
] as const satisfies readonly StickerConfig[];

export const textLabelPresetConfigs = [
    {
        id: "best-day-ever",
        text: "Best Day Ever",
        description: "Nhãn vui vẻ cho mọi sự kiện.",
    },
    {
        id: "happy-birthday",
        text: "Happy Birthday",
        description: "Nhãn sinh nhật.",
    },
    {
        id: "love-this-moment",
        text: "Love This Moment",
        description: "Nhãn kỷ niệm dễ thương.",
    },
    {
        id: "event-2026",
        text: "Event 2026",
        description: "Nhãn sự kiện mặc định có thể thay sau.",
    },
] as const satisfies readonly TextLabelPresetConfig[];

export function resolveStickerConfig(
    stickerId: string,
): StickerConfig {
    return (
        stickerConfigs.find((sticker) => sticker.id === stickerId) ??
        stickerConfigs[0]
    );
}

export function resolveTextLabelPresetConfig(
    presetId: string,
): TextLabelPresetConfig {
    return (
        textLabelPresetConfigs.find((preset) => preset.id === presetId) ??
        textLabelPresetConfigs[0]
    );
}
