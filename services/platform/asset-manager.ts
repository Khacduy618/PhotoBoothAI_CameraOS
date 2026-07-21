import type { FrameConfig, ThemeConfig, StyleConfig, StickerConfig, TextLabelPresetConfig } from "@/types/theme";
import { themeConfigs, frameConfigs, styleConfigs } from "@/config/theme.config";
import { stickerConfigs, textLabelPresetConfigs } from "@/config/sticker.config";

export interface FramePackage {
    id: string;
    metadata: {
        name: string;
        category: string;
        description: string;
    };
    thumbnailUrl: string;
    config: {
        borderColor: string;
        borderWidthRatio: number;
        kind: "none" | "solid" | "template";
    };
}

const framePackages: FramePackage[] = [
    {
        id: "none",
        metadata: {
            name: "Không khung",
            category: "Classic",
            description: "Giữ ảnh sạch, không thêm viền.",
        },
        thumbnailUrl: "bg-neutral-900 border border-white/10",
        config: { borderColor: "transparent", borderWidthRatio: 0, kind: "none" },
    },
    {
        id: "white-border",
        metadata: {
            name: "Khung trắng",
            category: "Classic",
            description: "Khung trắng photobooth tối giản.",
        },
        thumbnailUrl: "bg-[#ffffff] border border-neutral-300",
        config: { borderColor: "#ffffff", borderWidthRatio: 0.025, kind: "solid" },
    },
    {
        id: "gold",
        metadata: {
            name: "Viền vàng",
            category: "Party",
            description: "Khung vàng sang trọng cho sự kiện.",
        },
        thumbnailUrl: "bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500",
        config: { borderColor: "#facc15", borderWidthRatio: 0.022, kind: "solid" },
    },
    {
        id: "pink-heart",
        metadata: {
            name: "Khung Tim Dễ Thương",
            category: "Pastel",
            description: "Khung họa tiết Trái tim hồng Pastel đáng yêu.",
        },
        thumbnailUrl: "bg-pink-100 bg-[url('/frames/pink-heart-pattern.jpg')] bg-cover border border-pink-300",
        config: { borderColor: "#fce7f3", borderWidthRatio: 0.028, kind: "template" },
    },
    {
        id: "lavender-star",
        metadata: {
            name: "Khung Mây Sao Tím",
            category: "Pastel",
            description: "Khung họa tiết Ngôi sao lấp lánh tím pastel.",
        },
        thumbnailUrl: "bg-purple-100 bg-[url('/frames/lavender-star-pattern.jpg')] bg-cover border border-purple-300",
        config: { borderColor: "#f3e8ff", borderWidthRatio: 0.028, kind: "template" },
    },
    {
        id: "girly",
        metadata: {
            name: "Girly Pink",
            category: "Pastel",
            description: "Khung hồng phấn ngọt ngào dễ thương.",
        },
        thumbnailUrl: "bg-pink-200 border border-pink-300",
        config: { borderColor: "#fbcfe8", borderWidthRatio: 0.028, kind: "solid" },
    },
    {
        id: "conan",
        metadata: {
            name: "Conan Detective",
            category: "Anime",
            description: "Khung phong cách phá án kỳ bí màu xanh đen.",
        },
        thumbnailUrl: "bg-slate-800 border border-slate-900",
        config: { borderColor: "#1e293b", borderWidthRatio: 0.028, kind: "solid" },
    },
    {
        id: "steven-universe",
        metadata: {
            name: "Steven Universe",
            category: "Cartoon",
            description: "Khung vũ trụ lấp lánh rực rỡ sắc màu.",
        },
        thumbnailUrl: "bg-gradient-to-tr from-sky-400 via-pink-400 to-yellow-200",
        config: { borderColor: "#38bdf8", borderWidthRatio: 0.025, kind: "solid" },
    },
    {
        id: "tinder",
        metadata: {
            name: "Tinder Match",
            category: "Social",
            description: "Khung đỏ Tinder nóng bỏng cho cặp đôi.",
        },
        thumbnailUrl: "bg-gradient-to-r from-rose-500 to-orange-500",
        config: { borderColor: "#f43f5e", borderWidthRatio: 0.025, kind: "solid" },
    },
    {
        id: "matcha",
        metadata: {
            name: "Matcha Tea",
            category: "Nature",
            description: "Khung xanh matcha nhẹ nhàng tự nhiên.",
        },
        thumbnailUrl: "bg-emerald-100 border border-emerald-200",
        config: { borderColor: "#d1fae5", borderWidthRatio: 0.028, kind: "solid" },
    },
];

export class AssetManager {
    static getThemes(): ThemeConfig[] {
        return [...themeConfigs];
    }

    static getFramePackages(): FramePackage[] {
        return framePackages;
    }

    static getFramePackageById(id: string): FramePackage | undefined {
        return framePackages.find((p) => p.id === id);
    }

    static getStyleConfigs(): StyleConfig[] {
        return [...styleConfigs];
    }

    static getStickerConfigs(): StickerConfig[] {
        return [...stickerConfigs];
    }

    static getTextLabelPresets(): TextLabelPresetConfig[] {
        return [...textLabelPresetConfigs];
    }

    static getFonts(): { family: string; label: string }[] {
        return [
            { family: "system-ui, sans-serif", label: "Hiện đại (System)" },
            { family: "Georgia, serif", label: "Cổ điển (Georgia)" },
            { family: "Courier New, monospace", label: "Máy đánh chữ (Courier)" },
        ];
    }

    static resolveFrameConfig(frameId: string): FrameConfig {
        const pkg = this.getFramePackageById(frameId);
        if (pkg) {
            return {
                id: pkg.id,
                name: pkg.metadata.name,
                description: pkg.metadata.description,
                borderColor: pkg.config.borderColor,
                borderWidth: Math.round(pkg.config.borderWidthRatio * 1280),
                kind: pkg.config.kind,
            };
        }
        const config = frameConfigs.find((f) => f.id === frameId);
        return config ?? frameConfigs[0];
    }
}
