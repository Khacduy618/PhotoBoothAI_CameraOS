import type { PersistedMediaRef, Result } from '@momentai/shared-types';

export type OutputType = 'master' | 'share' | 'print' | 'preview' | 'customization';

export interface BinaryImage {
  bytes: Uint8Array;
  mimeType: string;
  width?: number;
  height?: number;
}

export interface StoredFile extends PersistedMediaRef {
  outputType?: OutputType;
}

export interface StorageHealth {
  status: 'ready' | 'low-space' | 'error';
  rootLabel: string;
  freeBytes?: number;
  message?: string;
}

export interface MediaRetentionConfig {
  enabled: boolean;
  retentionMinutes: number;
  cleanupIntervalSeconds: number;
  mode: 'audit_minimal' | 'privacy_strict';
  deferWhilePrintActive: boolean;
  printCleanupGraceMinutes: number;
  devTtlMs?: number;
}

export type MediaCleanupStatus =
  | 'pending'
  | 'eligible'
  | 'deleting'
  | 'deleted'
  | 'failed'
  | 'skipped_active'
  | 'deferred_print_active'
  | 'deferred_upload_active';

export type SessionCleanupStatus =
  | 'ACTIVE'
  | 'COMPLETED'
  | 'ABORTED'
  | 'EXPIRED'
  | 'active'
  | 'completed'
  | 'aborted'
  | 'expired'
  | 'abandoned'
  | 'failed';

export type SessionUploadState =
  | 'NONE'
  | 'PENDING'
  | 'UPLOADING'
  | 'RETRYING'
  | 'COMPLETED'
  | 'FAILED'
  | 'none'
  | 'pending'
  | 'uploading'
  | 'retrying'
  | 'completed'
  | 'failed';

export type SessionPrintStatus =
  | 'NONE'
  | 'QUEUED'
  | 'VALIDATING'
  | 'PRINTING'
  | 'RETRYING'
  | 'COMPLETED'
  | 'SUCCESS'
  | 'FAILED'
  | 'FAILED_FINAL'
  | 'CANCELLED'
  | 'none'
  | 'queued'
  | 'validating'
  | 'printing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface MediaCleanupSessionSnapshot {
  sessionId: string;
  status: SessionCleanupStatus;
  createdAt?: string;
  lastActivityAt?: string;
  completedAt?: string;
  uploadState?: SessionUploadState;
  printStatus?: SessionPrintStatus;
  mediaRetentionUntil?: string;
  mediaDeletedAt?: string;
  sessionPath?: string;
}

export interface MediaCleanupJob {
  jobId: string;
  sessionId: string;
  retentionUntil: string;
  status: MediaCleanupStatus;
  attempts: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MediaCleanupSummary {
  config: MediaRetentionConfig;
  pending: number;
  eligible: number;
  deleted: number;
  failed: number;
  skippedActive: number;
  deferredPrint: number;
  deferredUpload: number;
  bytesFreed?: number;
  lastRunAt?: string;
}

export interface MediaCleanupResult {
  job: MediaCleanupJob;
  sessionId: string;
  deletedFiles: string[];
  bytesFreed: number;
  redactedRows: number;
  success: boolean;
  error?: string;
}

export interface StorageAdapter {
  initialize(): Promise<Result<void>>;
  getHealth(): Promise<StorageHealth>;
  createSession(sessionId: string): Promise<Result<void>>;
  saveOriginal(sessionId: string, shotIndex: number, photo: BinaryImage): Promise<Result<StoredFile>>;
  saveOutput(sessionId: string, type: OutputType, file: BinaryImage): Promise<Result<StoredFile>>;
  writeSession<TSession>(session: TSession): Promise<Result<void>>;
}
