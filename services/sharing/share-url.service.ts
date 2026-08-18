export interface ShareUrlInput {
    photoId: string;
    origin?: string;
}

export interface ShareUrlResult {
    photoId: string;
    path: string;
    url: string;
}

function assertSafePhotoId(photoId: string): void {
    if (!photoId.trim()) {
        throw new Error("Photo ID is required for sharing.");
    }

    if (
        photoId.includes("/") ||
        photoId.includes("\\") ||
        photoId.includes("..")
    ) {
        throw new Error("Photo ID contains unsafe path characters.");
    }
}

export function createSharePath(photoId: string): string {
    assertSafePhotoId(photoId);

    return `/share/${encodeURIComponent(photoId)}`;
}

export function createShareUrl({
    photoId,
    origin,
}: ShareUrlInput): ShareUrlResult {
    const path = createSharePath(photoId);

    if (!origin) {
        return {
            photoId,
            path,
            url: path,
        };
    }

    const parsedOrigin = new URL(origin);

    if (
        parsedOrigin.protocol !== "http:" &&
        parsedOrigin.protocol !== "https:"
    ) {
        throw new Error(
            "Share URL origin must be http or https.",
        );
    }

    return {
        photoId,
        path,
        url: new URL(path, parsedOrigin).toString(),
    };
}
