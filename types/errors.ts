export type ErrorCategory =
    | "camera"
    | "permission"
    | "recognition"
    | "capture"
    | "processing"
    | "storage"
    | "printer"
    | "network"
    | "configuration"
    | "unknown";

export interface AppError {
    code: string;
    category: ErrorCategory;
    recoverable: boolean;
    message: string;
    suggestedAction: string;
    diagnosticCause?: string;
    occurredAt: string;
    sessionId?: string;
    captureId?: string;
}

export type StorageErrorCode =
    | "storage_unavailable"
    | "quota_exceeded"
    | "write_failed"
    | "read_failed"
    | "delete_failed"
    | "not_found"
    | "corrupt_data";

export interface StorageError extends AppError {
    category: "storage";
    code: StorageErrorCode;
}
