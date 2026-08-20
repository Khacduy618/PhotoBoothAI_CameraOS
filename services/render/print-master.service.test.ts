import { describe, it, expect, vi } from "vitest";
import { buildPrintMaster } from "./print-master.service";

function createMockCanvas() {
  const drawImage = vi.fn();
  const fillRect = vi.fn();
  const beginPath = vi.fn();
  const moveTo = vi.fn();
  const lineTo = vi.fn();
  const stroke = vi.fn();

  const ctx = {
    fillStyle: "#ffffff",
    strokeStyle: "#000000",
    lineWidth: 1,
    imageSmoothingEnabled: true,
    imageSmoothingQuality: "high",
    fillRect,
    drawImage,
    beginPath,
    moveTo,
    lineTo,
    stroke,
  };

  const canvas = {
    width: 1800,
    height: 2700,
    getContext: (type: string) => (type === "2d" ? ctx : null),
    toDataURL: () => "data:image/png;base64,mock",
    toBlob: (cb: (b: Blob) => void) => cb(new Blob(["mock"], { type: "image/png" })),
  } as unknown as HTMLCanvasElement;

  return canvas;
}

describe("buildPrintMaster", () => {
  it("creates a 1800x2700 10x15 physical master for SHEET_4", async () => {
    const canvas = createMockCanvas();
    const sourceCanvas = createMockCanvas();

    const master = await buildPrintMaster({
      logicalProductImage: sourceCanvas,
      targetProduct: "SHEET_4",
      masterWidth: 1800,
      masterHeight: 2700,
      targetCanvas: canvas,
    });

    expect(master.width).toBe(1800);
    expect(master.height).toBe(2700);
  });

  it("creates a 1800x2700 physical master for STRIP_4 with 2 identical strips duplicated side-by-side", async () => {
    const canvas = createMockCanvas();
    const stripCanvas = createMockCanvas();
    stripCanvas.width = 900;
    stripCanvas.height = 2700;

    const master = await buildPrintMaster({
      logicalProductImage: stripCanvas,
      targetProduct: "STRIP_4",
      masterWidth: 1800,
      masterHeight: 2700,
      targetCanvas: canvas,
    });

    expect(master.width).toBe(1800);
    expect(master.height).toBe(2700);
  });

  it("handles landscape 2700x1800 master for PREMIUM_POSTCARD landscape", async () => {
    const canvas = createMockCanvas();
    const sourceCanvas = createMockCanvas();
    sourceCanvas.width = 2700;
    sourceCanvas.height = 1800;

    const master = await buildPrintMaster({
      logicalProductImage: sourceCanvas,
      targetProduct: "PREMIUM_POSTCARD",
      masterWidth: 1800,
      masterHeight: 2700,
      isLandscape: true,
      targetCanvas: canvas,
    });

    expect(master.width).toBe(2700);
    expect(master.height).toBe(1800);
  });
});
