export interface SharePhotoRecord {
    photoId: string;
    dataUrl: string;
    mimeType: string;
    savedAt: string;
}

export interface SharePhotoStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

const SHARE_PHOTO_PREFIX =
    "photoboothai:share-photo:v1:";

function getSharePhotoKey(photoId: string): string {
    return `${SHARE_PHOTO_PREFIX}${encodeURIComponent(photoId)}`;
}

function isSharePhotoRecord(
    value: unknown,
): value is SharePhotoRecord {
    if (
        typeof value !== "object" ||
        value === null
    ) {
        return false;
    }

    const record = value as Partial<SharePhotoRecord>;

    return (
        typeof record.photoId === "string" &&
        typeof record.dataUrl === "string" &&
        record.dataUrl.startsWith("data:image/") &&
        typeof record.mimeType === "string" &&
        typeof record.savedAt === "string"
    );
}

export function saveSharePhoto(
    storage: SharePhotoStorage,
    record: SharePhotoRecord,
): void {
    storage.setItem(
        getSharePhotoKey(record.photoId),
        JSON.stringify(record),
    );
}

export function getSharePhoto(
    storage: SharePhotoStorage,
    photoId: string,
): SharePhotoRecord | null {
    const raw = storage.getItem(
        getSharePhotoKey(photoId),
    );

    if (!raw) {
        return null;
    }

    try {
        const parsed: unknown = JSON.parse(raw);

        if (!isSharePhotoRecord(parsed)) {
            return null;
        }

        return parsed;
    } catch {
        return null;
    }
}

export function deleteSharePhoto(
    storage: SharePhotoStorage,
    photoId: string,
): void {
    storage.removeItem(getSharePhotoKey(photoId));
}
