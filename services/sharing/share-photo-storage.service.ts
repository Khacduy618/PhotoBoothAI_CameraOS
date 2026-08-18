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

export const SHARE_PHOTO_TTL_MS = 2 * 60 * 1000; // 2 minutes

export function cleanupExpiredSharePhotos(
    storage: SharePhotoStorage & {
        length?: number;
        key?: (index: number) => string | null;
        keys?: () => string[];
    },
    maxAgeMs: number = SHARE_PHOTO_TTL_MS,
    now: () => number = Date.now,
): void {
    const keysToRemove: string[] = [];

    if (typeof storage.length === "number" && typeof storage.key === "function") {
        for (let i = 0; i < storage.length; i += 1) {
            const key = storage.key(i);
            if (key && key.startsWith(SHARE_PHOTO_PREFIX)) {
                keysToRemove.push(key);
            }
        }
    }

    const currentTime = now();

    keysToRemove.forEach((key) => {
        try {
            const raw = storage.getItem(key);
            if (!raw) return;
            const parsed: unknown = JSON.parse(raw);
            if (isSharePhotoRecord(parsed)) {
                const age = currentTime - new Date(parsed.savedAt).getTime();
                if (age >= maxAgeMs) {
                    storage.removeItem(key);
                }
            } else {
                storage.removeItem(key);
            }
        } catch {
            storage.removeItem(key);
        }
    });
}

export function scheduleSharePhotoCleanup(
    storage: SharePhotoStorage,
    photoId: string,
    delayMs: number = SHARE_PHOTO_TTL_MS,
): NodeJS.Timeout | number {
    return setTimeout(() => {
        deleteSharePhoto(storage, photoId);
    }, delayMs);
}
