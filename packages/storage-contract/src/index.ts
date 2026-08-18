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
}

export type MediaCleanupStatus = 'pending' | 'eligible' | 'deleting' | 'deleted' | 'failed' | 'skipped_active' | 'deferred_print_active';

export interface MediaCleanupSessionSnapshot {
  sessionId: string;
  status: 'active' | 'completed' | 'expired' | 'abandoned' | 'failed';
  completedAt?: string;
  printStatus?: 'none' | 'queued' | 'validating' | 'printing' | 'completed' | 'failed' | 'cancelled';
  mediaRetentionUntil?: string;
  mediaDeletedAt?: string;
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
  lastRunAt?: string;
}

export interface MediaCleanupResult {
  job: MediaCleanupJob;
  deletedFiles: string[];
  redactedRows: number;
}

export interface StorageAdapter {
  initialize(): Promise<Result<void>>;
  getHealth(): Promise<StorageHealth>;
  createSession(sessionId: string): Promise<Result<void>>;
  saveOriginal(sessionId: string, shotIndex: number, photo: BinaryImage): Promise<Result<StoredFile>>;
  saveOutput(sessionId: string, type: OutputType, file: BinaryImage): Promise<Result<StoredFile>>;
  writeSession<TSession>(session: TSession): Promise<Result<void>>;
}
