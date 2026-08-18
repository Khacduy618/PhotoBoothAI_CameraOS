import type { BinaryImage, OutputType, StorageAdapter, StorageHealth, StoredFile } from '@momentai/storage-contract';
import type { Result } from '@momentai/shared-types';

export class FakeStorageAdapter implements StorageAdapter {
  private sessions = new Set<string>();

  async initialize(): Promise<Result<void>> {
    return { ok: true, value: undefined };
  }

  async getHealth(): Promise<StorageHealth> {
    return { status: 'ready', rootLabel: 'FakeStorage' };
  }

  async createSession(sessionId: string): Promise<Result<void>> {
    this.sessions.add(sessionId);
    return { ok: true, value: undefined };
  }

  async saveOriginal(sessionId: string, shotIndex: number, photo: BinaryImage): Promise<Result<StoredFile>> {
    this.sessions.add(sessionId);
    return { ok: true, value: this.file(sessionId, `original_${shotIndex}`, `originals/${shotIndex}.jpg`, photo) };
  }

  async saveOutput(sessionId: string, type: OutputType, file: BinaryImage): Promise<Result<StoredFile>> {
    this.sessions.add(sessionId);
    return { ok: true, value: { ...this.file(sessionId, `output_${type}`, `output/final-${type}.jpg`, file), outputType: type } };
  }

  async writeSession(): Promise<Result<void>> {
    return { ok: true, value: undefined };
  }

  private file(sessionId: string, id: string, relativePath: string, image: BinaryImage): StoredFile {
    return {
      id,
      sessionId,
      relativePath: `sessions/fake/${sessionId}/${relativePath}`,
      mimeType: image.mimeType,
      width: image.width,
      height: image.height,
      bytes: image.bytes.byteLength,
      createdAt: new Date().toISOString(),
    };
  }
}
