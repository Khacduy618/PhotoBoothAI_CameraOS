export interface LocalPhotoUploadInput {
    sessionId: string;
    photoId: string;
    blob: Blob;
    capturedAt: string;
    width?: number;
    height?: number;
}

export interface LocalPhotoUploadRecord {
    photoId: string;
    sessionId: string;
    storageKey: string;
    mediaUrl: string;
    mimeType: string;
    width?: number;
    height?: number;
    expiresAt: string;
}

export type LocalPhotoUploadResult =
    | { ok: true; value: LocalPhotoUploadRecord }
    | { ok: false; error: string };

export async function listLocalSessionPhotos(
    sessionId: string,
): Promise<
    | { ok: true; value: LocalPhotoUploadRecord[] }
    | { ok: false; error: string }
> {
    try {
        const response = await fetch(`/api/local-media/sessions/${encodeURIComponent(sessionId)}/photos`);
        const payload: unknown = await response.json();

        if (!response.ok) {
            return {
                ok: false,
                error:
                    typeof payload === "object" &&
                    payload !== null &&
                    "error" in payload &&
                    typeof payload.error === "string"
                        ? payload.error
                        : "Không thể tải ảnh trong session.",
            };
        }

        if (
            typeof payload === "object" &&
            payload !== null &&
            "photos" in payload &&
            Array.isArray(payload.photos)
        ) {
            return { ok: true, value: payload.photos as LocalPhotoUploadRecord[] };
        }

        return { ok: false, error: "Session media response không hợp lệ." };
    } catch (cause) {
        return {
            ok: false,
            error: cause instanceof Error ? cause.message : "Không thể tải ảnh trong session.",
        };
    }
}

export async function uploadLocalOriginalPhoto({
    sessionId,
    photoId,
    blob,
    capturedAt,
    width,
    height,
}: LocalPhotoUploadInput): Promise<LocalPhotoUploadResult> {
    const formData = new FormData();
    formData.set("sessionId", sessionId);
    formData.set("photoId", photoId);
    formData.set("capturedAt", capturedAt);
    if (typeof width === "number") formData.set("width", String(width));
    if (typeof height === "number") formData.set("height", String(height));
    formData.set("file", blob, `${photoId}.${blob.type === "image/png" ? "png" : "jpg"}`);

    try {
        const response = await fetch("/api/local-media/photos", {
            method: "POST",
            body: formData,
        });
        const payload: unknown = await response.json();

        if (!response.ok) {
            return {
                ok: false,
                error:
                    typeof payload === "object" &&
                    payload !== null &&
                    "error" in payload &&
                    typeof payload.error === "string"
                        ? payload.error
                        : "Không thể lưu ảnh vào local media store.",
            };
        }

        if (
            typeof payload === "object" &&
            payload !== null &&
            "photo" in payload &&
            typeof payload.photo === "object" &&
            payload.photo !== null
        ) {
            return { ok: true, value: payload.photo as LocalPhotoUploadRecord };
        }

        return { ok: false, error: "Local media response không hợp lệ." };
    } catch (cause) {
        return {
            ok: false,
            error: cause instanceof Error ? cause.message : "Không thể lưu ảnh vào local media store.",
        };
    }
}
