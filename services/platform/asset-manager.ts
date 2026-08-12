import type { FrameConfig, ThemeConfig, StyleConfig, StickerConfig, TextLabelPresetConfig } from "@/types/theme";
import { frameConfigs, resolveFrameConfig as resolveBundledFrameConfig } from "@/config/frame.config";
import { themeConfigs, styleConfigs } from "@/config/theme.config";
import { stickerConfigs, textLabelPresetConfigs } from "@/config/sticker.config";
import { LocalFrameRegistry } from "@/services/frame/local-frame-registry";

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
        kind: "none" | "solid" | "template" | "png-overlay";
        assetUrl?: string;
    };
}

const frameThumbnailById: Record<string, string> = {
    none: "bg-neutral-900 border border-white/10",
    "white-border": "bg-[#ffffff] border border-neutral-300",
    gold: "bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500",
    "canva-placeholder": "bg-gradient-to-br from-pink-100 via-white to-amber-100 border border-pink-300",
    girly: "bg-pink-200 border border-pink-300",
    conan: "bg-slate-800 border border-slate-900",
    "steven-universe": "bg-gradient-to-tr from-sky-400 via-pink-400 to-yellow-200",
    tinder: "bg-gradient-to-r from-rose-500 to-orange-500",
    matcha: "bg-emerald-100 border border-emerald-200",
};

const frameCategoryById: Record<string, string> = {
    none: "Classic",
    "white-border": "Classic",
    gold: "Party",
    "canva-placeholder": "Canva",
    girly: "Pastel",
    conan: "Anime",
    "steven-universe": "Cartoon",
    tinder: "Social",
    matcha: "Nature",
};

export class AssetManager {
    static getThemes(): ThemeConfig[] {
        return [...themeConfigs];
    }

    static getFramePackages(): FramePackage[] {
        const bundledPackages: FramePackage[] = frameConfigs.map((frame) => ({
            id: frame.id,
            metadata: {
                name: frame.name,
                category: frameCategoryById[frame.id] ?? "Local",
                description: frame.description,
            },
            thumbnailUrl: frameThumbnailById[frame.id] ?? "bg-white border border-neutral-200",
            config: {
                borderColor: frame.borderColor,
                borderWidthRatio: frame.borderWidth / 1200,
                kind: frame.kind ?? "solid",
                assetUrl: "assetUrl" in frame ? (frame.assetUrl as string | undefined) : undefined,
            },
        }));

        const importedRuntimeFrames = LocalFrameRegistry.getPublishedRuntimeFrames();
        const importedPackages: FramePackage[] = importedRuntimeFrames.map((frame) => ({
            id: frame.id,
            metadata: {
                name: frame.name,
                category: "Imported Canva",
                description: frame.description || "Khung PNG import từ Canva",
            },
            thumbnailUrl: "bg-gradient-to-br from-emerald-100 via-white to-pink-100 border border-emerald-300",
            config: {
                borderColor: frame.borderColor,
                borderWidthRatio: (frame.borderWidth || 0) / 1200,
                kind: frame.kind ?? "png-overlay",
                assetUrl: frame.assetUrl,
            },
        }));

        return [...importedPackages, ...bundledPackages];
    }

    static getFramePackageById(id: string): FramePackage | undefined {
        return this.getFramePackages().find((p) => p.id === id);
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
        const imported = LocalFrameRegistry.getPublishedRuntimeFrames().find((f) => f.id === frameId);
        if (imported) {
            return imported;
        }
        return resolveBundledFrameConfig(frameId);
    }
}
