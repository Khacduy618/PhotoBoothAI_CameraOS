import type { StorageError } from "@/types/errors";
import type {
    BoothPhoto,
    OriginalPhotoAsset,
    PhotoDerivativeKind,
    PhotoMetadata,
    ProcessedPhotoDerivative,
} from "@/types/photo";

export type PhotoStorageResult<T> =
    | { ok: true; value: T }
    | { ok: false; error: StorageError };

export interface PhotoBlobStorage {
    put(photo: BoothPhoto): Promise<void>;
    get(photoId: string): Promise<BoothPhoto | null>;
    delete(photoId: string): Promise<void>;
    list(): Promise<readonly BoothPhoto[]>;
}

export interface SaveOriginalPhotoInput {
    id: string;
    sessionId: string;
    originalBlob: Blob;
    capturedAt: string;
    source: PhotoMetadata["source"];
    width?: number;
    height?: number;
}

export interface SavePhotoDerivativeInput {
    photoId: string;
    derivativeKind: PhotoDerivativeKind;
    blob: Blob;
    createdAt: string;
    processingErrorCode?: string;
}

function createStorageError(
    code: StorageError["code"],
    message: string,
    suggestedAction: string,
    cause?: unknown,
): StorageError {
    return {
        code,
        category: "storage",
        recoverable: code !== "corrupt_data",
        message,
        suggestedAction,
        diagnosticCause:
            cause instanceof Error
                ? cause.message
                : typeof cause === "string"
                    ? cause
                    : undefined,
        occurredAt: new Date().toISOString(),
    };
}

function mapWriteError(cause: unknown): StorageError {
    const errorName =
        cause instanceof Error ? cause.name : "";

    return createStorageError(
        errorName === "QuotaExceededError"
            ? "quota_exceeded"
            : "write_failed",
        "Không thể lưu ảnh gốc.",
        "Giải phóng dung lượng hoặc thử lại sau.",
        cause,
    );
}

export class PhotoStorageService {
    constructor(
        private readonly storage: PhotoBlobStorage,
    ) {}

    async saveOriginalPhoto(
        input: SaveOriginalPhotoInput,
    ): Promise<PhotoStorageResult<BoothPhoto>> {
        const metadata: PhotoMetadata = {
            id: input.id,
            sessionId: input.sessionId,
            capturedAt: input.capturedAt,
            mimeType:
                input.originalBlob.type ||
                "application/octet-stream",
            byteSize: input.originalBlob.size,
            width: input.width,
            height: input.height,
            source: input.source,
        };

        const original: OriginalPhotoAsset = {
            kind: "original",
            blob: input.originalBlob,
            metadata,
        };

        const photo: BoothPhoto = {
            id: input.id,
            sessionId: input.sessionId,
            original,
            derivatives: [],
            metadata,
        };

        try {
            await this.storage.put(photo);
            return { ok: true, value: photo };
        } catch (cause) {
            return {
                ok: false,
                error: mapWriteError(cause),
            };
        }
    }

    async addDerivative(
        input: SavePhotoDerivativeInput,
    ): Promise<PhotoStorageResult<BoothPhoto>> {
        const existing = await this.getPhoto(
            input.photoId,
        );

        if (!existing.ok) {
            return existing;
        }

        if (!existing.value) {
            return {
                ok: false,
                error: createStorageError(
                    "not_found",
                    "Không tìm thấy ảnh gốc để lưu bản xử lý.",
                    "Chụp lại hoặc kiểm tra session hiện tại.",
                ),
            };
        }

        const derivative: ProcessedPhotoDerivative = {
            kind: "processed",
            derivativeKind: input.derivativeKind,
            blob: input.blob,
            createdAt: input.createdAt,
            sourcePhotoId: existing.value.id,
            processingErrorCode:
                input.processingErrorCode,
        };

        const updatedPhoto: BoothPhoto = {
            ...existing.value,
            derivatives: [
                ...existing.value.derivatives,
                derivative,
            ],
        };

        try {
            await this.storage.put(updatedPhoto);
            return { ok: true, value: updatedPhoto };
        } catch (cause) {
            return {
                ok: false,
                error: mapWriteError(cause),
            };
        }
    }

    async getPhoto(
        photoId: string,
    ): Promise<PhotoStorageResult<BoothPhoto | null>> {
        try {
            return {
                ok: true,
                value: await this.storage.get(photoId),
            };
        } catch (cause) {
            return {
                ok: false,
                error: createStorageError(
                    "read_failed",
                    "Không thể đọc ảnh đã lưu.",
                    "Thử tải lại ứng dụng hoặc kiểm tra quyền lưu trữ.",
                    cause,
                ),
            };
        }
    }

    async listPhotosBySession(
        sessionId: string,
    ): Promise<PhotoStorageResult<readonly BoothPhoto[]>> {
        try {
            const photos = await this.storage.list();

            return {
                ok: true,
                value: photos.filter(
                    (photo) =>
                        photo.sessionId === sessionId,
                ),
            };
        } catch (cause) {
            return {
                ok: false,
                error: createStorageError(
                    "read_failed",
                    "Không thể đọc danh sách ảnh.",
                    "Thử tải lại ứng dụng hoặc kiểm tra quyền lưu trữ.",
                    cause,
                ),
            };
        }
    }

    async deletePhoto(
        photoId: string,
    ): Promise<PhotoStorageResult<boolean>> {
        const existing = await this.getPhoto(photoId);

        if (!existing.ok) {
            return existing;
        }

        if (!existing.value) {
            return { ok: true, value: false };
        }

        try {
            await this.storage.delete(photoId);
            return { ok: true, value: true };
        } catch (cause) {
            return {
                ok: false,
                error: createStorageError(
                    "delete_failed",
                    "Không thể xoá ảnh đã lưu.",
                    "Thử lại hoặc kiểm tra quyền lưu trữ.",
                    cause,
                ),
            };
        }
    }

    createObjectUrl(
        blob: Blob,
        createUrl: (blob: Blob) => string =
            URL.createObjectURL,
    ): PhotoStorageResult<string> {
        try {
            return {
                ok: true,
                value: createUrl(blob),
            };
        } catch (cause) {
            return {
                ok: false,
                error: createStorageError(
                    "read_failed",
                    "Không thể tạo đường dẫn xem ảnh.",
                    "Thử tải lại ảnh hoặc chụp lại.",
                    cause,
                ),
            };
        }
    }

    revokeObjectUrl(
        objectUrl: string,
        revokeUrl: (url: string) => void =
            URL.revokeObjectURL,
    ): void {
        revokeUrl(objectUrl);
    }
}

export class MemoryPhotoBlobStorage
    implements PhotoBlobStorage
{
    private readonly photos = new Map<string, BoothPhoto>();

    async put(photo: BoothPhoto): Promise<void> {
        this.photos.set(photo.id, photo);
    }

    async get(
        photoId: string,
    ): Promise<BoothPhoto | null> {
        return this.photos.get(photoId) ?? null;
    }

    async delete(photoId: string): Promise<void> {
        this.photos.delete(photoId);
    }

    async list(): Promise<readonly BoothPhoto[]> {
        return [...this.photos.values()];
    }
}
