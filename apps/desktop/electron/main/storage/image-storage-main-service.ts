import type { BinaryImage, OutputType, StorageHealth, StoredFile } from '@momentai/storage-contract';
import type { Result } from '@momentai/shared-types';
import { LocalFilesystemSQLiteStorageAdapter } from './local-filesystem-sqlite-storage-adapter';

export class WindowMiniImageStorageMainService {
  private readonly adapter = new LocalFilesystemSQLiteStorageAdapter();

  async initialize(): Promise<Result<void>> {
    return this.adapter.initialize();
  }

  async getHealth(): Promise<StorageHealth> {
    return this.adapter.getHealth();
  }

  async createSession(sessionId: string): Promise<Result<void>> {
    return this.adapter.createSession(sessionId);
  }

  async saveOriginal(sessionId: string, shotIndex: number, photo: BinaryImage): Promise<Result<StoredFile>> {
    return this.adapter.saveOriginal(sessionId, shotIndex, photo);
  }

  async saveOutput(sessionId: string, type: OutputType, file: BinaryImage): Promise<Result<StoredFile>> {
    return this.adapter.saveOutput(sessionId, type, file);
  }
}

export const windowMiniImageStorageMainService = new WindowMiniImageStorageMainService();
