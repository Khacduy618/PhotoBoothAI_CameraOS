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
 * Injects sRGB EXIF (ColorSpace=1, 600 DPI) into a JPEG byte buffer.
 *
 * Strategy:
 *  1. If an APP0 (JFIF) segment exists right after SOI:
 *     - Patch APP0 density unit to 1 (inch) and Xdensity/Ydensity to 600.
 *     - Insert APP1 EXIF **after** the APP0 segment (required by JFIF spec).
 *  2. If no APP0, insert APP1 right after SOI (FF D8).
 *
 * This ensures Windows Explorer, ICC-aware print drivers and Canon CP1000
 * all see: "Color representation: sRGB" and "600 dpi" — matching Canon 6D shots.
 */
function injectSrgbExifIntoJpeg(bytes: Buffer): Buffer {
  if (bytes.length < 4 || bytes[0] !== 0xFF || bytes[1] !== 0xD8) return bytes;

  // ── Build APP1 EXIF segment ──────────────────────────────────────────────
  // TIFF little-endian layout:
  //  Offset  0: TIFF header (II, 42, IFD0 at 8)
  //  Offset  8: IFD0 — 4 entries (XRes, YRes, ResUnit, ExifIFD pointer)
  //  Offset 58: next-IFD = 0
  //  Offset 62: XResolution rational 600/1
  //  Offset 70: YResolution rational 600/1
  //  Offset 78: ExifIFD — 1 entry (ColorSpace = 1)
  //  Offset 92: next-ExifIFD = 0
  const tiff = Buffer.alloc(96, 0);
  let o = 0;
  tiff.writeUInt16LE(0x4949, o); o += 2; // 'II' LE
  tiff.writeUInt16LE(42,     o); o += 2; // TIFF magic
  tiff.writeUInt32LE(8,      o); o += 4; // IFD0 at 8

  // IFD0: 4 entries
  tiff.writeUInt16LE(4, o); o += 2;

  // 0x011A XResolution → RATIONAL at offset 62
  tiff.writeUInt16LE(0x011A, o); o += 2;
  tiff.writeUInt16LE(5,      o); o += 2;
  tiff.writeUInt32LE(1,      o); o += 4;
  tiff.writeUInt32LE(62,     o); o += 4;

  // 0x011B YResolution → RATIONAL at offset 70
  tiff.writeUInt16LE(0x011B, o); o += 2;
  tiff.writeUInt16LE(5,      o); o += 2;
  tiff.writeUInt32LE(1,      o); o += 4;
  tiff.writeUInt32LE(70,     o); o += 4;

  // 0x0128 ResolutionUnit = 2 (inch)
  tiff.writeUInt16LE(0x0128, o); o += 2;
  tiff.writeUInt16LE(3,      o); o += 2;
  tiff.writeUInt32LE(1,      o); o += 4;
  tiff.writeUInt32LE(2,      o); o += 4;

  // 0x8769 ExifIFD pointer → offset 78
  tiff.writeUInt16LE(0x8769, o); o += 2;
  tiff.writeUInt16LE(4,      o); o += 2;
  tiff.writeUInt32LE(1,      o); o += 4;
  tiff.writeUInt32LE(78,     o); o += 4;

  tiff.writeUInt32LE(0, o); o += 4; // next IFD0 = 0  (o=58)

  // Values at 62, 70
  tiff.writeUInt32LE(600, 62); tiff.writeUInt32LE(1, 66); // XRes = 600/1
  tiff.writeUInt32LE(600, 70); tiff.writeUInt32LE(1, 74); // YRes = 600/1

  // ExifIFD at offset 78: 1 entry
  tiff.writeUInt16LE(1, 78);

  // 0xA001 ColorSpace = 1 (sRGB)
  tiff.writeUInt16LE(0xA001, 80);
  tiff.writeUInt16LE(3,      82); // SHORT
  tiff.writeUInt32LE(1,      84); // count
  tiff.writeUInt32LE(1,      88); // value: 1 = sRGB

  tiff.writeUInt32LE(0, 92); // next ExifIFD = 0

  const exifMagic = Buffer.from([0x45, 0x78, 0x69, 0x66, 0x00, 0x00]); // 'Exif\0\0'
  const exifPayload = Buffer.concat([exifMagic, tiff]);
  const app1Len = exifPayload.length + 2;
  const app1 = Buffer.concat([
    Buffer.from([0xFF, 0xE1, (app1Len >> 8) & 0xFF, app1Len & 0xFF]),
    exifPayload,
  ]);

  // ── Locate APP0 segment ──────────────────────────────────────────────────
  let insertPos = 2; // default: right after SOI

  if (
    bytes[2] === 0xFF &&
    bytes[3] === 0xE0 &&
    bytes.length >= 6
  ) {
    // APP0/JFIF present — read its length (big-endian, includes the 2 length bytes)
    const app0Len = bytes.readUInt16BE(4);

    // Patch APP0 density in-place:
    //  byte  8 = density_unit  → 1 (dots per inch)
    //  bytes 9-10 = Xdensity   → 600  (big-endian UINT16)
    //  bytes 11-12 = Ydensity  → 600
    if (bytes.length >= 14) {
      bytes[8]  = 1;                         // density unit = inch
      bytes.writeUInt16BE(600, 9);           // Xdensity = 600
      bytes.writeUInt16BE(600, 11);          // Ydensity = 600
    }

    // Insert APP1 after APP0
    insertPos = 2 + 2 + app0Len; // SOI(2) + marker(2) + app0Length
    if (insertPos > bytes.length) insertPos = bytes.length;
  }

  return Buffer.concat([
    bytes.subarray(0, insertPos),
    app1,
    bytes.subarray(insertPos),
  ]);
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
