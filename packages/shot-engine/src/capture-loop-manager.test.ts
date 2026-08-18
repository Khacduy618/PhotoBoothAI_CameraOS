import { describe, expect, it } from "vitest";

import { CaptureLoopManager, getCaptureFormat, type CaptureLoopCamera, type CaptureLoopStorage } from "./index";

function createCamera(): CaptureLoopCamera & { calls: number[] } {
  const camera = {
    calls: [] as number[],
    async capture(context: { sessionId: string; shotIndex: number }) {
      camera.calls.push(context.shotIndex);
      return {
        ok: true as const,
        value: {
          bytes: new Uint8Array([context.shotIndex]),
          mimeType: "image/jpeg",
          width: 1800,
          height: 2700,
        },
      };
    },
  };
  return camera;
}

function createStorage(failAtShot?: number): CaptureLoopStorage & { calls: number[] } {
  const storage = {
    calls: [] as number[],
    async saveOriginal(sessionId: string, shotIndex: number, photo: { bytes: Uint8Array; mimeType: string }) {
      storage.calls.push(shotIndex);
      if (shotIndex === failAtShot) return { ok: false as const, error: new Error("Storage write failed.") };
      return {
        ok: true as const,
        value: {
          id: `original_${sessionId}_${shotIndex}`,
          relativePath: `sessions/${sessionId}/originals/${shotIndex}.jpg`,
          createdAt: "2026-08-16T00:00:00.000Z",
          mimeType: photo.mimeType,
        },
      };
    },
  };
  return storage;
}

describe("CaptureLoopManager", () => {
  it.each([
    ["format_1shot", 1],
    ["format_2shot", 2],
    ["format_4shot", 4],
    ["format_6shot", 6],
  ] as const)("captures and stores exactly %s shot count", async (formatId, shotCount) => {
    const camera = createCamera();
    const storage = createStorage();
    const manager = new CaptureLoopManager(camera, storage);

    const result = await manager.captureAll({ sessionId: "sess_counts", format: getCaptureFormat(formatId) });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toHaveLength(shotCount);
    expect(camera.calls).toEqual(Array.from({ length: shotCount }, (_, index) => index + 1));
    expect(storage.calls).toEqual(Array.from({ length: shotCount }, (_, index) => index + 1));
  });

  it("prevents duplicate concurrent capture loops", async () => {
    let releaseCapture: (() => void) | undefined;
    const camera: CaptureLoopCamera = {
      async capture() {
        await new Promise<void>((resolve) => {
          releaseCapture = resolve;
        });
        return { ok: true, value: { bytes: new Uint8Array([1]), mimeType: "image/jpeg" } };
      },
    };
    const storage = createStorage();
    const manager = new CaptureLoopManager(camera, storage);

    const first = manager.captureAll({ sessionId: "sess_duplicate", format: getCaptureFormat("format_1shot") });
    const second = await manager.captureAll({ sessionId: "sess_duplicate", format: getCaptureFormat("format_1shot") });
    releaseCapture?.();
    const firstResult = await first;

    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error.message).toMatch(/already running/i);
    expect(firstResult.ok).toBe(true);
  });

  it("preserves partial captures and does not count failed storage writes as completed shots", async () => {
    const camera = createCamera();
    const storage = createStorage(3);
    const manager = new CaptureLoopManager(camera, storage);

    const result = await manager.captureAll({ sessionId: "sess_storage_fail", format: getCaptureFormat("format_4shot") });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.partialPhotos).toHaveLength(2);
      expect(result.partialPhotos.map((photo) => photo.shotIndex)).toEqual([1, 2]);
    }
    expect(camera.calls).toEqual([1, 2, 3]);
    expect(storage.calls).toEqual([1, 2, 3]);
    expect(manager.isRunning()).toBe(false);
  });
});
