import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

import type { FrameDefinition } from "@/services/frame-import/frame-import.types";

export interface AdminEventRecord {
    eventId: string;
    name: string;
    status: "active" | "archived";
    createdAt: string;
    updatedAt: string;
}

export type AdminFrameRecord = FrameDefinition & {
    eventId: string;
};

interface EventRow {
    event_id: string;
    name: string;
    status: "active" | "archived";
    created_at: string;
    updated_at: string;
}

interface FrameRow {
    frame_id: string;
    event_id: string;
    definition_json: string;
    status: "published" | "private";
    created_at: string;
    updated_at: string;
}

const DATA_DIR_ENV = "CAMERAOS_DATA_DIR";
const DEFAULT_DATA_DIR = ".cameraos-data";
const SQLITE_FILE = "admin.sqlite";
const DEFAULT_EVENT_ID = "event_hoi_an_heritage";
const DEFAULT_EVENT_NAME = "Phố Cổ Hội An";

let cachedDb: Database | null = null;

function getDataRoot(): string {
    return path.resolve(process.cwd(), process.env[DATA_DIR_ENV] || DEFAULT_DATA_DIR);
}

function getSqlitePath(): string {
    return path.resolve(getDataRoot(), SQLITE_FILE);
}

function safeIdFromName(name: string): string {
    const normalized = name
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 72);
    return normalized || "event";
}

function assertSafeId(value: string, label: string): string {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(value)) {
        throw new Error(`${label} contains unsafe characters.`);
    }
    return value;
}

function getDb(): Database {
    if (cachedDb) return cachedDb;

    const sqlitePath = getSqlitePath();
    fs.mkdirSync(path.dirname(sqlitePath), { recursive: true });
    const db = new Database(sqlitePath);
    db.pragma("journal_mode = WAL");
    db.exec(`
        CREATE TABLE IF NOT EXISTS events (
            event_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'active',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS frame_definitions (
            frame_id TEXT PRIMARY KEY,
            event_id TEXT NOT NULL,
            definition_json TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'published',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY(event_id) REFERENCES events(event_id)
        );

        CREATE INDEX IF NOT EXISTS idx_frame_definitions_event_status
            ON frame_definitions(event_id, status, updated_at);
    `);

    cachedDb = db;
    ensureDefaultEvent();
    return db;
}

function ensureDefaultEvent(): void {
    const db = cachedDb;
    if (!db) return;
    const now = new Date().toISOString();
    db.prepare(`
        INSERT INTO events (event_id, name, status, created_at, updated_at)
        VALUES (?, ?, 'active', ?, ?)
        ON CONFLICT(event_id) DO NOTHING
    `).run(DEFAULT_EVENT_ID, DEFAULT_EVENT_NAME, now, now);
}

function mapEventRow(row: EventRow): AdminEventRecord {
    return {
        eventId: row.event_id,
        name: row.name,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function getStoredFrameId(eventId: string, frameId: string): string {
    return `${eventId}__${frameId}`;
}

function mapFrameRow(row: FrameRow): AdminFrameRecord {
    const definition = JSON.parse(row.definition_json) as FrameDefinition;
    return {
        ...definition,
        id: definition.id,
        eventId: row.event_id,
        status: row.status,
        createdAt: definition.createdAt ?? row.created_at,
        updatedAt: definition.updatedAt ?? row.updated_at,
    };
}

export function resetAdminRegistryStoreForTests(): void {
    cachedDb = null;
}

export function listAdminEvents(): AdminEventRecord[] {
    const rows = getDb()
        .prepare("SELECT * FROM events ORDER BY updated_at DESC, created_at DESC")
        .all() as EventRow[];
    return rows.map(mapEventRow);
}

export function createAdminEvent(name: string): AdminEventRecord {
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 80) {
        throw new Error("Event name must be between 2 and 80 characters.");
    }

    const now = new Date().toISOString();
    const baseId = `event_${safeIdFromName(trimmed)}`;
    let eventId = baseId;
    let suffix = 2;
    const db = getDb();
    while (db.prepare("SELECT event_id FROM events WHERE event_id = ?").get(eventId)) {
        eventId = `${baseId}_${suffix}`;
        suffix += 1;
    }

    db.prepare(`
        INSERT INTO events (event_id, name, status, created_at, updated_at)
        VALUES (?, ?, 'active', ?, ?)
    `).run(eventId, trimmed, now, now);

    return { eventId, name: trimmed, status: "active", createdAt: now, updatedAt: now };
}

function validateFrameDefinition(definition: FrameDefinition): void {
    if (!definition.id || !definition.name || definition.kind !== "png-overlay") throw new Error("Frame definition is invalid.");
    if (definition.assetUrl && !definition.assetUrl.startsWith("data:image/png") && !definition.assetUrl.startsWith("/api/local-media/")) {
        throw new Error("Frame asset URL is not allowed.");
    }
    if (!Number.isFinite(definition.outputWidth) || definition.outputWidth <= 0) throw new Error("Frame width is invalid.");
    if (!Number.isFinite(definition.outputHeight) || definition.outputHeight <= 0) throw new Error("Frame height is invalid.");
    if (![1, 2, 4, 6, 8].includes(definition.shotCount)) throw new Error("Frame shot count is unsupported.");
    if (!Array.isArray(definition.slots) || definition.slots.length !== definition.shotCount) throw new Error("Frame slot count does not match shot count.");
    if (definition.status && definition.status !== "published" && definition.status !== "private") throw new Error("Frame status is invalid.");
    for (const slot of definition.slots) {
        if (!Number.isFinite(slot.x) || !Number.isFinite(slot.y) || !Number.isFinite(slot.width) || !Number.isFinite(slot.height)) throw new Error("Frame slot bounds are invalid.");
        if (slot.x < 0 || slot.y < 0 || slot.width <= 0 || slot.height <= 0 || slot.x + slot.width > 1.001 || slot.y + slot.height > 1.001) throw new Error("Frame slot bounds are outside canvas.");
    }
}

export function saveAdminFrame(definition: FrameDefinition, eventId: string): AdminFrameRecord {
    validateFrameDefinition(definition);
    const safeEventId = assertSafeId(eventId || DEFAULT_EVENT_ID, "eventId");
    const db = getDb();
    const event = db.prepare("SELECT event_id FROM events WHERE event_id = ?").get(safeEventId);
    if (!event) {
        throw new Error("Selected event does not exist.");
    }

    const now = new Date().toISOString();
    const frameId = assertSafeId(definition.id, "frameId");
    const storedFrameId = getStoredFrameId(safeEventId, frameId);
    const existing = db.prepare("SELECT created_at FROM frame_definitions WHERE frame_id = ?").get(storedFrameId) as { created_at?: string } | undefined;
    const createdAt = existing?.created_at ?? definition.createdAt ?? now;
    const itemToSave: FrameDefinition = {
        ...definition,
        id: frameId,
        status: definition.status || "published",
        createdAt,
        updatedAt: now,
    };

    db.prepare(`
        INSERT INTO frame_definitions (frame_id, event_id, definition_json, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(frame_id) DO UPDATE SET
            event_id = excluded.event_id,
            definition_json = excluded.definition_json,
            status = excluded.status,
            updated_at = excluded.updated_at
    `).run(storedFrameId, safeEventId, JSON.stringify(itemToSave), itemToSave.status, createdAt, now);

    return { ...itemToSave, eventId: safeEventId };
}

export function listAdminFrames(eventId?: string): AdminFrameRecord[] {
    const db = getDb();
    const rows = eventId
        ? db.prepare("SELECT * FROM frame_definitions WHERE event_id = ? ORDER BY updated_at DESC, created_at DESC").all(assertSafeId(eventId, "eventId")) as FrameRow[]
        : db.prepare("SELECT * FROM frame_definitions ORDER BY updated_at DESC, created_at DESC").all() as FrameRow[];
    return rows.map(mapFrameRow);
}

export function listPublishedFrames(eventId?: string): AdminFrameRecord[] {
    const db = getDb();
    const rows = eventId
        ? db.prepare("SELECT * FROM frame_definitions WHERE event_id = ? AND status != 'private' ORDER BY updated_at DESC, created_at DESC").all(assertSafeId(eventId, "eventId")) as FrameRow[]
        : db.prepare("SELECT * FROM frame_definitions WHERE status != 'private' ORDER BY updated_at DESC, created_at DESC").all() as FrameRow[];
    return rows.map(mapFrameRow);
}

export function listPublishedFramesByEvent(eventId: string): AdminFrameRecord[] {
    return listPublishedFrames(eventId || DEFAULT_EVENT_ID);
}

export function updateAdminFrameStatus(frameId: string, status: "published" | "private", eventId: string): void {
    const now = new Date().toISOString();
    const safeFrameId = assertSafeId(frameId, "frameId");
    getDb().prepare("UPDATE frame_definitions SET status = ?, updated_at = ? WHERE frame_id = ?")
        .run(status, now, getStoredFrameId(assertSafeId(eventId, "eventId"), safeFrameId));
}

export function deleteAdminFrame(frameId: string, eventId: string): void {
    const safeFrameId = assertSafeId(frameId, "frameId");
    getDb().prepare("DELETE FROM frame_definitions WHERE frame_id = ?").run(getStoredFrameId(assertSafeId(eventId, "eventId"), safeFrameId));
}

export function clearAdminFrames(eventId?: string): void {
    const db = getDb();
    if (eventId) {
        db.prepare("DELETE FROM frame_definitions WHERE event_id = ?").run(assertSafeId(eventId, "eventId"));
        return;
    }
    db.prepare("DELETE FROM frame_definitions").run();
}

export function getDefaultEventId(): string {
    return DEFAULT_EVENT_ID;
}
