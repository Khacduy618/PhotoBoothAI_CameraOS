import type { AssetManifest } from "@/types/render-config";

interface PartialPhotoLoadError extends Error {
    partialPhotos?: Map<string, HTMLImageElement>;
}

export interface PreparedAssets {
    background?: HTMLImageElement;
    frame?: HTMLImageElement;
    stickers: Map<string, HTMLImageElement>;
    capturedPhotos: Map<string, ImageBitmap | HTMLImageElement>;
    fonts: ReadonlySet<string>;
}

export class RenderAssetLoaderService {
    public static async loadImage(url: string): Promise<HTMLImageElement> {
        return new Promise<HTMLImageElement>((resolve, reject) => {
            if (typeof window === "undefined") {
                reject(new Error("Cannot load images outside browser context"));
                return;
            }
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = async () => {
                try {
                    if ("decode" in img) {
                        await img.decode();
                    }
                } catch {
                    // Ignore decode errors if image rendered fine
                }
                resolve(img);
            };
            img.onerror = (err) => reject(new Error(`Failed to load image at ${url}: ${err}`));
            img.src = url;
        });
    }

    public static async loadPhoto(
        blob: Blob,
        customCreateImage?: (blob: Blob) => Promise<HTMLImageElement>
    ): Promise<HTMLImageElement> {
        if (customCreateImage) {
            return customCreateImage(blob);
        }
        return new Promise<HTMLImageElement>((resolve, reject) => {
            const url = URL.createObjectURL(blob);
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = async () => {
                try {
                    if ("decode" in img) {
                        await img.decode();
                    }
                } catch {
                    // Ignore decode error
                }
                URL.revokeObjectURL(url);
                resolve(img);
            };
            img.onerror = (err) => {
                URL.revokeObjectURL(url);
                reject(new Error(`Failed to load photo blob: ${err}`));
            };
            img.src = url;
        });
    }

    public static async loadAssets(
        manifest: AssetManifest,
        options?: { createImage?: (blob: Blob) => Promise<HTMLImageElement> }
    ): Promise<PreparedAssets> {
        const stickersMap = new Map<string, HTMLImageElement>();
        const photosMap = new Map<string, HTMLImageElement>();
        const loadedFonts = new Set<string>();

        let background: HTMLImageElement | undefined;
        let frame: HTMLImageElement | undefined;

        if (manifest.backgroundUrl) {
            try {
                background = await this.loadImage(manifest.backgroundUrl);
            } catch (err) {
                console.warn("[RenderAssetLoaderService] Background load failed:", err);
            }
        }

        if (manifest.frameUrl) {
            try {
                frame = await this.loadImage(manifest.frameUrl);
            } catch (err) {
                console.warn("[RenderAssetLoaderService] Frame load failed:", err);
            }
        }

        // Preload photos
        if (manifest.capturedPhotoBlobs && manifest.capturedPhotoBlobs.length > 0) {
            for (let idx = 0; idx < manifest.capturedPhotoBlobs.length; idx++) {
                const blob = manifest.capturedPhotoBlobs[idx];
                if (options?.createImage) {
                    try {
                        const img = await options.createImage(blob);
                        photosMap.set(`photo-${idx}`, img);
                    } catch (err) {
                        const errObj: PartialPhotoLoadError = err instanceof Error
                            ? err
                            : new Error(String(err));
                        errObj.partialPhotos = photosMap;
                        throw errObj;
                    }
                } else {
                    try {
                        const img = await this.loadPhoto(blob);
                        photosMap.set(`photo-${idx}`, img);
                    } catch (err) {
                        const errObj: PartialPhotoLoadError = err instanceof Error
                            ? err
                            : new Error(String(err));
                        errObj.partialPhotos = photosMap;
                        throw errObj;
                    }
                }
            }
        }

        // Preload stickers
        if (manifest.stickerUrls && manifest.stickerUrls.length > 0) {
            await Promise.all(
                manifest.stickerUrls.map(async (url: string) => {
                    try {
                        const img = await this.loadImage(url);
                        stickersMap.set(url, img);
                    } catch (err) {
                        console.warn(`[RenderAssetLoaderService] Sticker ${url} load failed:`, err);
                    }
                })
            );
        }

        // Verify fonts
        if (typeof document !== "undefined" && "fonts" in document) {
            try {
                await document.fonts.ready;
                for (const desc of manifest.fontDescriptors || []) {
                    try {
                        await document.fonts.load(desc);
                        if (document.fonts.check(desc)) {
                            loadedFonts.add(desc);
                        }
                    } catch {
                        // Ignore individual font fail
                    }
                }
            } catch {
                // Ignore fonts API errors
            }
        }

        return Object.freeze({
            background,
            frame,
            stickers: stickersMap,
            capturedPhotos: photosMap,
            fonts: loadedFonts,
        });
    }
}
