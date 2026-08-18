import { describe, expect, it } from 'vitest';

import { FakeCameraAdapter } from './fake-camera-adapter';
import { FakePrinterAdapter } from './fake-printer-adapter';
import { FakeStorageAdapter } from './fake-storage-adapter';

describe('WindowMini fake adapters', () => {
  it('captures a fake persisted original through the camera contract', async () => {
    const camera = new FakeCameraAdapter();
    await camera.initialize();
    const result = await camera.capture({ sessionId: 'session_1', shotIndex: 1, formatId: 'format_1shot' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.original.sessionId).toBe('session_1');
      expect(result.value.original.relativePath).toContain('originals/01.jpg');
    }
  });

  it('returns a completed fake printer result', async () => {
    const printer = new FakePrinterAdapter();
    const result = await printer.print({
      id: 'print_1',
      sessionId: 'session_1',
      printerId: 'fake_cp1000',
      imagePath: 'output/final-print.jpg',
      paperId: '4x6',
      copies: 2,
      orientation: 'portrait',
      borderless: true,
      status: 'queued',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.status).toBe('completed');
  });

  it('saves fake output media through the storage contract', async () => {
    const storage = new FakeStorageAdapter();
    const result = await storage.saveOutput('session_1', 'print', { bytes: new Uint8Array([1, 2, 3]), mimeType: 'image/jpeg' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.outputType).toBe('print');
      expect(result.value.bytes).toBe(3);
    }
  });
});
