import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { LocalFilesystemSQLiteStorageAdapter } from './local-filesystem-sqlite-storage-adapter';

const tempRoots: string[] = [];

function createTempRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'momentai-storage-'));
  tempRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe('LocalFilesystemSQLiteStorageAdapter', () => {
  it('creates session directories and persists original files atomically', async () => {
    const rootDir = createTempRoot();
    const adapter = new LocalFilesystemSQLiteStorageAdapter({ rootDir, now: () => '2026-08-16T00:00:00.000Z' });

    await expect(adapter.initialize()).resolves.toEqual({ ok: true, value: undefined });
    await expect(adapter.createSession('session_1')).resolves.toEqual({ ok: true, value: undefined });

    const result = await adapter.saveOriginal('session_1', 1, { bytes: new Uint8Array([1, 2, 3]), mimeType: 'image/jpeg', width: 100, height: 80 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.relativePath).toBe('sessions/session_1/photos/shot_01.jpg');
    expect(fs.existsSync(path.join(rootDir, result.value.relativePath))).toBe(true);
    expect(fs.readFileSync(path.join(rootDir, result.value.relativePath))).toEqual(Buffer.from([1, 2, 3]));
    expect(fs.existsSync(path.join(rootDir, 'cameraos-storage.sqlite'))).toBe(true);
  });

  it('persists separate master/share/print outputs without overwriting originals', async () => {
    const rootDir = createTempRoot();
    const adapter = new LocalFilesystemSQLiteStorageAdapter({ rootDir, now: () => '2026-08-16T00:00:00.000Z' });
    await adapter.initialize();
    await adapter.saveOriginal('session_2', 1, { bytes: new Uint8Array([9]), mimeType: 'image/jpeg' });

    const master = await adapter.saveOutput('session_2', 'master', { bytes: new Uint8Array([4]), mimeType: 'image/png' });
    const share = await adapter.saveOutput('session_2', 'share', { bytes: new Uint8Array([5]), mimeType: 'image/jpeg' });
    const print = await adapter.saveOutput('session_2', 'print', { bytes: new Uint8Array([6]), mimeType: 'image/jpeg' });

    expect(master.ok && master.value.relativePath).toBe('sessions/session_2/outputs/master.png');
    expect(share.ok && share.value.relativePath).toBe('sessions/session_2/outputs/share.jpg');
    expect(print.ok && print.value.relativePath).toBe('sessions/session_2/outputs/print.jpg');
    expect(fs.readFileSync(path.join(rootDir, 'sessions/session_2/photos/shot_01.jpg'))).toEqual(Buffer.from([9]));
  });

  it('rejects duplicate originals instead of overwriting the first capture', async () => {
    const rootDir = createTempRoot();
    const adapter = new LocalFilesystemSQLiteStorageAdapter({ rootDir });
    await adapter.initialize();

    const first = await adapter.saveOriginal('session_4', 1, { bytes: new Uint8Array([7]), mimeType: 'image/jpeg' });
    const duplicate = await adapter.saveOriginal('session_4', 1, { bytes: new Uint8Array([8]), mimeType: 'image/jpeg' });

    expect(first.ok).toBe(true);
    expect(duplicate.ok).toBe(false);
    expect(fs.readFileSync(path.join(rootDir, 'sessions/session_4/photos/shot_01.jpg'))).toEqual(Buffer.from([7]));
  });

  it('rejects empty bytes and unsupported MIME types', async () => {
    const adapter = new LocalFilesystemSQLiteStorageAdapter({ rootDir: createTempRoot() });
    await adapter.initialize();

    const empty = await adapter.saveOriginal('session_5', 1, { bytes: new Uint8Array(), mimeType: 'image/jpeg' });
    const invalidMime = await adapter.saveOutput('session_5', 'share', { bytes: new Uint8Array([1]), mimeType: 'application/octet-stream' });

    expect(empty.ok).toBe(false);
    expect(invalidMime.ok).toBe(false);
  });

  it('rejects unsafe session ids and invalid shot indexes', async () => {
    const adapter = new LocalFilesystemSQLiteStorageAdapter({ rootDir: createTempRoot() });
    await adapter.initialize();

    const unsafeSession = await adapter.createSession('../secret');
    const unsafeShot = await adapter.saveOriginal('session_3', 0, { bytes: new Uint8Array([1]), mimeType: 'image/jpeg' });

    expect(unsafeSession.ok).toBe(false);
    expect(unsafeShot.ok).toBe(false);
  });
});
