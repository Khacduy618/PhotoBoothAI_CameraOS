import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';
import type { BinaryImage, OutputType, StorageAdapter, StorageHealth, StoredFile } from '@momentai/storage-contract';
import type { Result } from '@momentai/shared-types';

interface LocalFilesystemSQLiteStorageAdapterOptions {
  rootDir?: string;
  now?: () => string;
}

const DEFAULT_ROOT_DIR = path.join(process.cwd(), 'artifacts', 'windowmini-storage');
const SQLITE_FILE = 'cameraos-storage.sqlite';

export class LocalFilesystemSQLiteStorageAdapter implements StorageAdapter {
  private db: InstanceType<typeof Database> | null = null;
  private readonly rootDir: string;
  private readonly now: () => string;

  constructor(options: LocalFilesystemSQLiteStorageAdapterOptions = {}) {
    this.rootDir = path.resolve(options.rootDir || process.env.MOMENTAI_STORAGE_DIR || DEFAULT_ROOT_DIR);
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async initialize(): Promise<Result<void>> {
    try {
      fs.mkdirSync(this.rootDir, { recursive: true });
      fs.mkdirSync(path.join(this.rootDir, 'sessions'), { recursive: true });
      this.db = new Database(path.join(this.rootDir, SQLITE_FILE));
      this.db.pragma('journal_mode = WAL');
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
          session_id TEXT PRIMARY KEY,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          payload_json TEXT
        );
        CREATE TABLE IF NOT EXISTS stored_files (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          relative_path TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          width INTEGER,
          height INTEGER,
          bytes INTEGER NOT NULL,
          output_type TEXT,
          created_at TEXT NOT NULL
        );
      `);
      return { ok: true, value: undefined };
    } catch (cause) {
      return storageError(cause, 'STORAGE_INIT_FAILED', 'Unable to initialize local filesystem SQLite storage.');
    }
  }

  async getHealth(): Promise<StorageHealth> {
    try {
      fs.mkdirSync(this.rootDir, { recursive: true });
      fs.accessSync(this.rootDir, fs.constants.R_OK | fs.constants.W_OK);
      return { status: 'ready', rootLabel: 'LocalFilesystemSQLiteStorage' };
    } catch (cause) {
      return { status: 'error', rootLabel: 'LocalFilesystemSQLiteStorage', message: cause instanceof Error ? cause.message : 'Storage unavailable.' };
    }
  }

  async createSession(sessionId: string): Promise<Result<void>> {
    try {
      const safeSessionId = assertSafeId(sessionId, 'session id');
      this.ensureInitialized();
      fs.mkdirSync(path.join(this.rootDir, 'sessions', safeSessionId, 'originals'), { recursive: true });
      fs.mkdirSync(path.join(this.rootDir, 'sessions', safeSessionId, 'outputs'), { recursive: true });
      const now = this.now();
      this.db!.prepare(`
        INSERT INTO sessions (session_id, created_at, updated_at, payload_json)
        VALUES (?, ?, ?, NULL)
        ON CONFLICT(session_id) DO UPDATE SET updated_at = excluded.updated_at
      `).run(safeSessionId, now, now);
      return { ok: true, value: undefined };
    } catch (cause) {
      return storageError(cause, 'STORAGE_SESSION_CREATE_FAILED', 'Unable to create local storage session.');
    }
  }

  async saveOriginal(sessionId: string, shotIndex: number, photo: BinaryImage): Promise<Result<StoredFile>> {
    try {
      const safeSessionId = assertSafeId(sessionId, 'session id');
      const safeShotIndex = assertShotIndex(shotIndex);
      this.ensureInitialized();
      await this.createSession(safeSessionId);
      const extension = extensionForMime(photo.mimeType);
      const relativePath = path.posix.join('sessions', safeSessionId, 'originals', `shot_${String(safeShotIndex).padStart(2, '0')}${extension}`);
      return { ok: true, value: this.writeImageRecord(safeSessionId, `original_${safeSessionId}_${safeShotIndex}`, relativePath, photo, undefined, false) };
    } catch (cause) {
      return storageError(cause, 'STORAGE_ORIGINAL_SAVE_FAILED', 'Unable to save original image.');
    }
  }

  async saveOutput(sessionId: string, type: OutputType, file: BinaryImage): Promise<Result<StoredFile>> {
    try {
      const safeSessionId = assertSafeId(sessionId, 'session id');
      const safeType = assertOutputType(type);
      this.ensureInitialized();
      await this.createSession(safeSessionId);
      const extension = extensionForMime(file.mimeType);
      const relativePath = path.posix.join('sessions', safeSessionId, 'outputs', `${safeType}${extension}`);
      const stored = this.writeImageRecord(safeSessionId, `output_${safeSessionId}_${safeType}`, relativePath, file, safeType);
      return { ok: true, value: stored };
    } catch (cause) {
      return storageError(cause, 'STORAGE_OUTPUT_SAVE_FAILED', 'Unable to save output image.');
    }
  }

  async writeSession<TSession>(session: TSession): Promise<Result<void>> {
    try {
      this.ensureInitialized();
      const candidate = session as { sessionId?: unknown; id?: unknown };
      const sessionId = assertSafeId(String(candidate.sessionId || candidate.id || ''), 'session id');
      const now = this.now();
      this.db!.prepare(`
        INSERT INTO sessions (session_id, created_at, updated_at, payload_json)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(session_id) DO UPDATE SET updated_at = excluded.updated_at, payload_json = excluded.payload_json
      `).run(sessionId, now, now, JSON.stringify(session));
      return { ok: true, value: undefined };
    } catch (cause) {
      return storageError(cause, 'STORAGE_SESSION_WRITE_FAILED', 'Unable to write local storage session metadata.');
    }
  }

  private writeImageRecord(sessionId: string, id: string, relativePath: string, image: BinaryImage, outputType?: OutputType, allowOverwrite = true): StoredFile {
    const absolutePath = path.join(this.rootDir, relativePath);
    if (!allowOverwrite && (fs.existsSync(absolutePath) || this.db!.prepare('SELECT id FROM stored_files WHERE id = ?').get(id))) {
      throw new Error('Original already exists and will not be overwritten.');
    }
    const bytes = Buffer.from(image.bytes);
    if (bytes.byteLength <= 0) throw new Error('Image bytes are empty.');
    atomicWriteFile(absolutePath, bytes);
    const createdAt = this.now();
    const stored: StoredFile = {
      id,
      sessionId,
      relativePath,
      mimeType: image.mimeType,
      width: image.width,
      height: image.height,
      bytes: image.bytes.byteLength,
      createdAt,
      outputType,
    };
    this.db!.prepare(`
      INSERT INTO stored_files (id, session_id, relative_path, mime_type, width, height, bytes, output_type, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET relative_path = excluded.relative_path, mime_type = excluded.mime_type, width = excluded.width, height = excluded.height, bytes = excluded.bytes, output_type = excluded.output_type, created_at = excluded.created_at
    `).run(stored.id, stored.sessionId, stored.relativePath, stored.mimeType, stored.width ?? null, stored.height ?? null, stored.bytes ?? 0, stored.outputType ?? null, stored.createdAt);
    return stored;
  }

  private ensureInitialized(): void {
    if (!this.db) throw new Error('Storage adapter is not initialized.');
  }
}

function atomicWriteFile(filePath: string, bytes: Buffer): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tempPath, bytes);
  fs.renameSync(tempPath, filePath);
}

function assertSafeId(value: string, label: string): string {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(value)) throw new Error(`Invalid ${label}.`);
  return value;
}

function assertShotIndex(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 12) throw new Error('Invalid shot index.');
  return value;
}

function assertOutputType(value: OutputType): OutputType {
  if (!['master', 'share', 'print', 'preview', 'customization'].includes(value)) throw new Error('Invalid output type.');
  return value;
}

function assertImageMime(mimeType: string): string {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) throw new Error('Invalid image mime type.');
  return mimeType;
}

function extensionForMime(mimeType: string): string {
  const safeMimeType = assertImageMime(mimeType);
  if (safeMimeType === 'image/png') return '.png';
  if (safeMimeType === 'image/webp') return '.webp';
  return '.jpg';
}

function storageError(cause: unknown, code: string, technicalMessage: string): Result<never> {
  return {
    ok: false,
    error: {
      code,
      domain: 'storage',
      severity: 'warning',
      technicalMessage: cause instanceof Error ? `${technicalMessage} ${cause.message}` : technicalMessage,
      guestMessage: 'Bộ nhớ ảnh cục bộ đang cần hỗ trợ.',
      recoverable: true,
    },
  };
}
