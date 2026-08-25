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
  private db: Database | null = null;
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
      fs.mkdirSync(path.join(this.rootDir, 'sessions', safeSessionId, 'photos'), { recursive: true });
      fs.mkdirSync(path.join(this.rootDir, 'sessions', safeSessionId, 'clips'), { recursive: true });
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
      const relativePath = path.posix.join('sessions', safeSessionId, 'photos', `shot_${String(safeShotIndex).padStart(2, '0')}${extension}`);
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

  async deleteSession(sessionId: string): Promise<Result<void>> {
    try {
      const safeSessionId = assertSafeId(sessionId, 'session id');
      this.ensureInitialized();
      this.db!.prepare('DELETE FROM stored_files WHERE session_id = ?').run(safeSessionId);
      this.db!.prepare('DELETE FROM sessions WHERE session_id = ?').run(safeSessionId);
      return { ok: true, value: undefined };
    } catch (cause) {
      return storageError(cause, 'STORAGE_SESSION_DELETE_FAILED', 'Unable to delete local storage session record.');
    }
  }

  async listSessions(): Promise<Result<{ sessionId: string; createdAt: string; updatedAt: string; payloadJson?: string | null }[]>> {
    try {
      this.ensureInitialized();
      const rows = this.db!.prepare('SELECT session_id, created_at, updated_at, payload_json FROM sessions').all() as {
        session_id: string;
        created_at: string;
        updated_at: string;
        payload_json?: string | null;
      }[];
      const items = rows.map((r) => ({
        sessionId: r.session_id,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        payloadJson: r.payload_json,
      }));
      return { ok: true, value: items };
    } catch (cause) {
      return storageError(cause, 'STORAGE_SESSION_LIST_FAILED', 'Unable to list sessions.');
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

  close(): void {
    if (this.db) {
      try {
        this.db.close();
      } catch {
        // ignore
      }
      this.db = null;
    }
  }

  private ensureInitialized(): void {
    if (!this.db) throw new Error('Storage adapter is not initialized.');
  }
}

/**
 * Injects a minimal EXIF APP1 segment with:
 *   - ColorSpace = 1 (sRGB)           [EXIF tag 0xA001]
 *   - XResolution / YResolution = 600 DPI [TIFF tags 0x011A / 0x011B]
 *   - ResolutionUnit = 2 (inch)        [TIFF tag 0x0128]
 *
 * This ensures Windows Explorer, ICC-aware print drivers, and Canon CP1000
 * all read "Color representation: sRGB" — matching the Canon 6D raw shots
 * which already embed sRGB in their EXIF.
 *
 * Structure:
 *   FF E1 [len16]      APP1 marker + big-endian length
 *   45 78 69 66 00 00  "Exif\0\0"
 *   [TIFF/IFD header]
 */
function injectSrgbExifIntoJpeg(bytes: Buffer): Buffer {
  // Only process JPEG (starts with FF D8)
  if (bytes.length < 4 || bytes[0] !== 0xFF || bytes[1] !== 0xD8) return bytes;

  // Build TIFF-based EXIF payload (little-endian)
  // TIFF header: 'II' = LE, magic 42, IFD0 offset = 8
  // IFD0: 4 entries (XResolution, YResolution, ResolutionUnit, ExifIFD pointer)
  // ExifIFD: 1 entry (ColorSpace = sRGB)
  //
  // Offsets from start of TIFF header:
  //   8  = IFD0
  //   8 + 2 + 4*12 + 4 = 62  = XRes rational value (600/1)
  //   70 = YRes rational value (600/1)
  //   78 = ExifIFD
  //   78 + 2 + 1*12 + 4 = 106 = next IFD = 0 (end)

  const tiff = Buffer.alloc(96);
  let off = 0;

  // TIFF header (LE)
  tiff.writeUInt16LE(0x4949, off); off += 2; // 'II' little-endian
  tiff.writeUInt16LE(42, off); off += 2;      // magic
  tiff.writeUInt32LE(8, off); off += 4;       // IFD0 at offset 8

  // IFD0: 4 entries
  tiff.writeUInt16LE(4, off); off += 2;

  // Tag 0x011A XResolution = RATIONAL offset 56
  tiff.writeUInt16LE(0x011A, off); off += 2;
  tiff.writeUInt16LE(5, off); off += 2;       // RATIONAL
  tiff.writeUInt32LE(1, off); off += 4;       // count
  tiff.writeUInt32LE(56, off); off += 4;      // offset to value

  // Tag 0x011B YResolution = RATIONAL offset 64
  tiff.writeUInt16LE(0x011B, off); off += 2;
  tiff.writeUInt16LE(5, off); off += 2;
  tiff.writeUInt32LE(1, off); off += 4;
  tiff.writeUInt32LE(64, off); off += 4;

  // Tag 0x0128 ResolutionUnit = 2 (inch)
  tiff.writeUInt16LE(0x0128, off); off += 2;
  tiff.writeUInt16LE(3, off); off += 2;       // SHORT
  tiff.writeUInt32LE(1, off); off += 4;
  tiff.writeUInt32LE(2, off); off += 4;       // value: 2 = inch

  // Tag 0x8769 ExifIFD pointer
  tiff.writeUInt16LE(0x8769, off); off += 2;
  tiff.writeUInt16LE(4, off); off += 2;       // LONG
  tiff.writeUInt32LE(1, off); off += 4;
  tiff.writeUInt32LE(72, off); off += 4;      // ExifIFD at offset 72

  // Next IFD = 0 (end of IFD0)
  tiff.writeUInt32LE(0, off); off += 4;       // off = 56

  // XResolution value: 600/1
  tiff.writeUInt32LE(600, off); off += 4;
  tiff.writeUInt32LE(1, off); off += 4;       // off = 64

  // YResolution value: 600/1
  tiff.writeUInt32LE(600, off); off += 4;
  tiff.writeUInt32LE(1, off); off += 4;       // off = 72

  // ExifIFD: 1 entry
  tiff.writeUInt16LE(1, off); off += 2;       // off = 74

  // Tag 0xA001 ColorSpace = 1 (sRGB)
  tiff.writeUInt16LE(0xA001, off); off += 2;
  tiff.writeUInt16LE(3, off); off += 2;       // SHORT
  tiff.writeUInt32LE(1, off); off += 4;
  tiff.writeUInt32LE(1, off); off += 4;       // value: 1 = sRGB

  // Next ExifIFD = 0
  tiff.writeUInt32LE(0, off); // off = 92

  // Prepend "Exif\0\0"
  const exifMagic = Buffer.from([0x45, 0x78, 0x69, 0x66, 0x00, 0x00]);
  const exifPayload = Buffer.concat([exifMagic, tiff]);

  // Build APP1 segment: FF E1 [big-endian length = payload + 2] [payload]
  const app1Length = exifPayload.length + 2; // +2 for length field itself
  const app1Header = Buffer.from([0xFF, 0xE1, (app1Length >> 8) & 0xFF, app1Length & 0xFF]);
  const app1Segment = Buffer.concat([app1Header, exifPayload]);

  // Insert after SOI (FF D8), replacing or inserting before existing APP0/APP1
  // Always insert right after SOI bytes
  const insertPos = 2;
  return Buffer.concat([bytes.subarray(0, insertPos), app1Segment, bytes.subarray(insertPos)]);
}

function atomicWriteFile(filePath: string, bytes: Buffer): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  const ext = path.extname(filePath).toLowerCase();
  const finalBytes = ext === '.jpg' || ext === '.jpeg' ? injectSrgbExifIntoJpeg(bytes) : bytes;
  fs.writeFileSync(tempPath, finalBytes);
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
