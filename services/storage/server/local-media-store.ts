import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

export interface LocalMediaPhotoRecord {
    photoId: string;
    sessionId: string;
    kind: "original" | "derivative" | "frame";
    storageKey: string;
    mediaUrl: string;
    mimeType: string;
    width?: number;
    height?: number;
    byteSize: number;
    capturedAt: string;
    expiresAt: string;
    createdAt: string;
    updatedAt: string;
    deletedAt?: string;
}

interface PhotoRow {
    photo_id: string;
    session_id: string;
    kind: LocalMediaPhotoRecord["kind"];
    storage_key: string;
    media_url: string;
    mime_type: string;
    width: number | null;
    height: number | null;
    byte_size: number;
    captured_at: string;
    expires_at: string;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
}

const DATA_DIR_ENV = "CAMERAOS_DATA_DIR";
const DEFAULT_DATA_DIR = ".cameraos-data";
const SQLITE_FILE = "media.sqlite";
const SESSION_TTL_MS = 10 * 60 * 1000;
const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function getDataRoot(): string {
    return path.resolve(process.cwd(), process.env[DATA_DIR_ENV] || DEFAULT_DATA_DIR);
}

function assertSafeSegment(value: string, label: string): string {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(value)) {
        throw new Error(`${label} contains unsafe characters.`);
    }

    return value;
}

function resolveInsideDataRoot(...segments: string[]): string {
    const root = getDataRoot();
    const resolved = path.resolve(root, ...segments);

    if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
        throw new Error("Resolved media path escapes CameraOS data directory.");
    }

    return resolved;
}

function getSqlitePath(): string {
    return resolveInsideDataRoot(SQLITE_FILE);
}

let cachedDb: Database | null = null;

export function resetLocalMediaStoreForTests(): void {
    cachedDb = null;
}

function getDb(): Database {
    if (cachedDb) {
        return cachedDb;
    }

    const sqlitePath = getSqlitePath();
    fs.mkdirSync(path.dirname(sqlitePath), { recursive: true });
    const db = new Database(sqlitePath);
    db.pragma("journal_mode = WAL");
    db.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
            session_id TEXT PRIMARY KEY,
            status TEXT NOT NULL DEFAULT 'active',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            expires_at TEXT,
            cleanup_state TEXT NOT NULL DEFAULT 'not_due'
        );

        CREATE TABLE IF NOT EXISTS photos (
            photo_id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            kind TEXT NOT NULL,
            storage_key TEXT NOT NULL,
            media_url TEXT NOT NULL,
            mime_type TEXT NOT NULL,
            width INTEGER,
            height INTEGER,
            byte_size INTEGER NOT NULL,
            captured_at TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            deleted_at TEXT,
            FOREIGN KEY(session_id) REFERENCES sessions(session_id)
        );

        CREATE INDEX IF NOT EXISTS idx_photos_session_active
            ON photos(session_id, deleted_at, expires_at);
    `);
    cachedDb = db;
    return db;
}

function mapPhotoRow(row: PhotoRow): LocalMediaPhotoRecord {
    return {
        photoId: row.photo_id,
        sessionId: row.session_id,
        kind: row.kind,
        storageKey: row.storage_key,
        mediaUrl: row.media_url,
        mimeType: row.mime_type,
        width: row.width ?? undefined,
        height: row.height ?? undefined,
        byteSize: row.byte_size,
        capturedAt: row.captured_at,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        deletedAt: row.deleted_at ?? undefined,
    };
}

export function getLocalMediaUrl(photoId: string): string {
    return `/api/local-media/photos/${encodeURIComponent(photoId)}`;
}

export async function saveLocalOriginalPhoto({
    sessionId,
    photoId,
    blob,
    capturedAt,
    width,
    height,
}: {
    sessionId: string;
    photoId: string;
    blob: Blob;
    capturedAt?: string;
    width?: number;
    height?: number;
}): Promise<LocalMediaPhotoRecord> {
    const safeSessionId = assertSafeSegment(sessionId, "sessionId");
    const safePhotoId = assertSafeSegment(photoId, "photoId");
    const nowDate = new Date();
    const now = nowDate.toISOString();
    const effectiveCapturedAt = capturedAt || now;
    const expiresAt = new Date(nowDate.getTime() + SESSION_TTL_MS).toISOString();
    const mimeType = blob.type;
    if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
        throw new Error("Unsupported local media MIME type.");
    }
    const extension = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
    const storageKey = `sessions/${safeSessionId}/originals/${safePhotoId}.${extension}`;
    const filePath = resolveInsideDataRoot(...storageKey.split("/"));

    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, Buffer.from(await blob.arrayBuffer()));

    const mediaUrl = getLocalMediaUrl(safePhotoId);
    const db = getDb();
    const existing = db.prepare("SELECT created_at FROM photos WHERE photo_id = ?").get(safePhotoId) as { created_at?: string } | undefined;
    const createdAt = existing?.created_at ?? now;

    db.prepare(`
        INSERT INTO sessions (session_id, status, created_at, updated_at, expires_at, cleanup_state)
        VALUES (?, 'active', ?, ?, ?, 'not_due')
        ON CONFLICT(session_id) DO UPDATE SET
            updated_at = excluded.updated_at,
            expires_at = excluded.expires_at,
            cleanup_state = 'not_due'
    `).run(safeSessionId, createdAt, now, expiresAt);

    db.prepare(`
        INSERT INTO photos (
            photo_id, session_id, kind, storage_key, media_url, mime_type,
            width, height, byte_size, captured_at, expires_at, created_at, updated_at, deleted_at
        ) VALUES (?, ?, 'original', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
        ON CONFLICT(photo_id) DO UPDATE SET
            session_id = excluded.session_id,
            storage_key = excluded.storage_key,
            media_url = excluded.media_url,
            mime_type = excluded.mime_type,
            width = excluded.width,
            height = excluded.height,
            byte_size = excluded.byte_size,
            captured_at = excluded.captured_at,
            expires_at = excluded.expires_at,
            updated_at = excluded.updated_at,
            deleted_at = NULL
    `).run(
        safePhotoId,
        safeSessionId,
        storageKey,
        mediaUrl,
        mimeType,
        width ?? null,
        height ?? null,
        blob.size,
        effectiveCapturedAt,
        expiresAt,
        createdAt,
        now,
    );

    return {
        photoId: safePhotoId,
        sessionId: safeSessionId,
        kind: "original",
        storageKey,
        mediaUrl,
        mimeType,
        width,
        height,
        byteSize: blob.size,
        capturedAt: effectiveCapturedAt,
        expiresAt,
        createdAt,
        updatedAt: now,
    };
}

export async function getLocalPhotoRecord(photoId: string): Promise<LocalMediaPhotoRecord | null> {
    const safePhotoId = assertSafeSegment(photoId, "photoId");
    const row = getDb()
        .prepare("SELECT * FROM photos WHERE photo_id = ? AND deleted_at IS NULL")
        .get(safePhotoId) as PhotoRow | undefined;

    return row ? mapPhotoRow(row) : null;
}

export async function readLocalPhotoFile(photoId: string): Promise<{ record: LocalMediaPhotoRecord; bytes: Buffer } | null> {
    const record = await getLocalPhotoRecord(photoId);

    if (!record) {
        return null;
    }

    const now = Date.now();
    if (Date.parse(record.expiresAt) <= now) {
        return null;
    }

    const filePath = resolveInsideDataRoot(...record.storageKey.split("/"));
    const bytes = await readFile(filePath);

    return { record, bytes };
}

export async function listLocalPhotosBySession(sessionId: string): Promise<LocalMediaPhotoRecord[]> {
    const safeSessionId = assertSafeSegment(sessionId, "sessionId");
    const rows = getDb()
        .prepare(`
            SELECT * FROM photos
            WHERE session_id = ?
              AND deleted_at IS NULL
              AND expires_at > ?
            ORDER BY captured_at DESC, created_at DESC
        `)
        .all(safeSessionId, new Date().toISOString()) as PhotoRow[];

    return rows.map(mapPhotoRow);
}

export async function cleanupExpiredLocalMedia(now: Date = new Date()): Promise<number> {
    const nowIso = now.toISOString();
    const expiredRows = getDb()
        .prepare("SELECT * FROM photos WHERE deleted_at IS NULL AND expires_at <= ?")
        .all(nowIso) as PhotoRow[];
    let deletedCount = 0;

    for (const row of expiredRows) {
        try {
            await rm(resolveInsideDataRoot(...row.storage_key.split("/")), { force: true });
            getDb()
                .prepare("UPDATE photos SET deleted_at = ?, updated_at = ? WHERE photo_id = ?")
                .run(nowIso, nowIso, row.photo_id);
            deletedCount += 1;
        } catch {
            getDb()
                .prepare("UPDATE sessions SET cleanup_state = 'failed', updated_at = ? WHERE session_id = ?")
                .run(nowIso, row.session_id);
        }
    }

    getDb()
        .prepare("UPDATE sessions SET status = 'expired', cleanup_state = 'complete', updated_at = ? WHERE expires_at <= ?")
        .run(nowIso, nowIso);

    return deletedCount;
}
