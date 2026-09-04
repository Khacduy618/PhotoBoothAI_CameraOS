import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { LocalFilesystemSQLiteStorageAdapter, resolveMomentAIStorageRoot } from './local-filesystem-sqlite-storage-adapter';

const require = createRequire(import.meta.url);
const { SessionMediaPaths, resolveMomentAIStorageRoot: resolveCjsStorageRoot } = require('./session-media-paths.cjs') as {
  SessionMediaPaths: new (storageRootDir?: string) => { getStorageRoot(): string };
  resolveMomentAIStorageRoot: (env?: NodeJS.ProcessEnv, platform?: NodeJS.Platform) => string;
};
const { DesktopMediaManager } = require('../media/desktop-media-manager.cjs') as {
  DesktopMediaManager: new (options?: { storageRootDir?: string; env?: NodeJS.ProcessEnv; platform?: NodeJS.Platform }) => { storageRootDir: string };
};

const tempRoots: string[] = [];
const adapters: LocalFilesystemSQLiteStorageAdapter[] = [];

function createTempRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'momentai-storage-'));
  tempRoots.push(root);
  return root;
}

function createAdapter(options: ConstructorParameters<typeof LocalFilesystemSQLiteStorageAdapter>[0] = {}) {
  const adapter = new LocalFilesystemSQLiteStorageAdapter(options);
  adapters.push(adapter);
  return adapter;
}

afterEach(() => {
  for (const adapter of adapters.splice(0)) {
    adapter.close();
  }
  for (const root of tempRoots.splice(0)) {
    try {
      fs.rmSync(root, { recursive: true, force: true });
    } catch {
      // Windows safe cleanup
    }
  }
});

describe('resolveMomentAIStorageRoot', () => {
  it('uses an explicit MOMENTAI_STORAGE_DIR override first', () => {
    const env = { MOMENTAI_STORAGE_DIR: 'C:/MomentAIOverride', LOCALAPPDATA: 'C:/Users/booth/AppData/Local' } as unknown as NodeJS.ProcessEnv;
    const root = resolveMomentAIStorageRoot(env, 'win32');

    expect(root).toBe(path.resolve('C:/MomentAIOverride'));
  });

  it('uses %LOCALAPPDATA% on Windows when no override is set', () => {
    const env = { LOCALAPPDATA: 'C:/Users/booth/AppData/Local' } as unknown as NodeJS.ProcessEnv;
    const root = resolveMomentAIStorageRoot(env, 'win32');

    expect(root).toBe(path.join('C:/Users/booth/AppData/Local', 'MomentAI', 'Photobooth'));
  });

  it('keeps non-Windows development storage under artifacts', () => {
    const root = resolveMomentAIStorageRoot({} as NodeJS.ProcessEnv, 'darwin');

    expect(root).toBe(path.join(process.cwd(), 'artifacts', 'windowmini-storage'));
  });
});

describe('CommonJS storage root consumers', () => {
  it('uses the same %LOCALAPPDATA% production root for SessionMediaPaths', () => {
    const env = { LOCALAPPDATA: 'C:/Users/booth/AppData/Local' } as unknown as NodeJS.ProcessEnv;
    const root = resolveCjsStorageRoot(env, 'win32');
    const paths = new SessionMediaPaths(root);

    expect(root).toBe(path.join('C:/Users/booth/AppData/Local', 'MomentAI', 'Photobooth'));
    expect(paths.getStorageRoot()).toBe(path.resolve(root));
  });

  it('routes DesktopMediaManager through the canonical storage resolver', () => {
    const env = { LOCALAPPDATA: 'C:/Users/booth/AppData/Local' } as unknown as NodeJS.ProcessEnv;
    const manager = new DesktopMediaManager({ env, platform: 'win32' });

    expect(manager.storageRootDir).toBe(path.resolve(path.join('C:/Users/booth/AppData/Local', 'MomentAI', 'Photobooth')));
  });
});

describe('LocalFilesystemSQLiteStorageAdapter', () => {
  it('creates session directories and persists original files atomically', async () => {
    const rootDir = createTempRoot();
    const adapter = createAdapter({ rootDir, now: () => '2026-08-16T00:00:00.000Z' });

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
    const adapter = createAdapter({ rootDir, now: () => '2026-08-16T00:00:00.000Z' });
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
    const adapter = createAdapter({ rootDir });
    await adapter.initialize();

    const first = await adapter.saveOriginal('session_4', 1, { bytes: new Uint8Array([7]), mimeType: 'image/jpeg' });
    const duplicate = await adapter.saveOriginal('session_4', 1, { bytes: new Uint8Array([8]), mimeType: 'image/jpeg' });

    expect(first.ok).toBe(true);
    expect(duplicate.ok).toBe(false);
    expect(fs.readFileSync(path.join(rootDir, 'sessions/session_4/photos/shot_01.jpg'))).toEqual(Buffer.from([7]));
  });

  it('rejects empty bytes and unsupported MIME types', async () => {
    const adapter = createAdapter({ rootDir: createTempRoot() });
    await adapter.initialize();

    const empty = await adapter.saveOriginal('session_5', 1, { bytes: new Uint8Array(), mimeType: 'image/jpeg' });
    const invalidMime = await adapter.saveOutput('session_5', 'share', { bytes: new Uint8Array([1]), mimeType: 'application/octet-stream' });

    expect(empty.ok).toBe(false);
    expect(invalidMime.ok).toBe(false);
  });

  it('rejects unsafe session ids and invalid shot indexes', async () => {
    const adapter = createAdapter({ rootDir: createTempRoot() });
    await adapter.initialize();

    const unsafeSession = await adapter.createSession('../escaped');
    const invalidShot = await adapter.saveOriginal('session_6', 99, { bytes: new Uint8Array([1]), mimeType: 'image/jpeg' });

    expect(unsafeSession.ok).toBe(false);
    expect(invalidShot.ok).toBe(false);
  });
});
