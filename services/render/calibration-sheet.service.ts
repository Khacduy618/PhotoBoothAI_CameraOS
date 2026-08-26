/**
 * calibration-sheet.service.ts
 *
 * Dev-only print calibration generator for Canon SELPHY CP1000.
 * Produces 1181 × 1748 px physical calibration master with millimeter grid,
 * center lines, two-up strip split guides, safe-area marks, and corner annotations.
 */

import {
  CANON_CP1000_PROFILE,
  type PrinterProfile,
} from '@momentai/printer-contract';

export interface CalibrationSheetOptions {
  profile?: PrinterProfile;
  targetCanvas?: HTMLCanvasElement;
}

export interface CalibrationSheetResult {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  toDataURL(format?: string, quality?: number): string;
  toBlob(format?: string, quality?: number): Promise<Blob>;
}

export function generateCalibrationSheet(
  options: CalibrationSheetOptions = {},
): CalibrationSheetResult {
  const { profile = CANON_CP1000_PROFILE, targetCanvas } = options;

  const width = profile.portrait.widthPx; // 1181
  const height = profile.portrait.heightPx; // 1748
  const dpi = profile.dpi; // 300
  const pxPerMm = dpi / 25.4; // ~11.811 px/mm

  const canvas = targetCanvas || document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error(
      '[generateCalibrationSheet] Failed to acquire 2D canvas context',
    );
  }

  // 1. Background white
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // 2. 5mm and 10mm grid
  const mmWidth = profile.widthMm; // 100
  const mmHeight = profile.heightMm; // 148

  // 5mm light grid
  ctx.lineWidth = 0.5;
  ctx.strokeStyle = '#e2e8f0';
  for (let mm = 5; mm < mmWidth; mm += 5) {
    const x = Math.round(mm * pxPerMm);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let mm = 5; mm < mmHeight; mm += 5) {
    const y = Math.round(mm * pxPerMm);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // 10mm darker grid
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#cbd5e1';
  for (let mm = 10; mm < mmWidth; mm += 10) {
    const x = Math.round(mm * pxPerMm);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let mm = 10; mm < mmHeight; mm += 10) {
    const y = Math.round(mm * pxPerMm);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // 3. Safe area guides (3mm and 5mm from outer edge)
  const safe3mm = Math.round(3 * pxPerMm);
  const safe5mm = Math.round(5 * pxPerMm);

  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 6]);
  ctx.strokeRect(safe3mm, safe3mm, width - safe3mm * 2, height - safe3mm * 2);

  ctx.strokeStyle = '#10b981';
  ctx.strokeRect(safe5mm, safe5mm, width - safe5mm * 2, height - safe5mm * 2);
  ctx.setLineDash([]);

  // 4. Exact Strip Split Line at x = 590 (Left 590px, Right 591px)
  const splitX = 590;
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#ef4444';
  ctx.beginPath();
  ctx.moveTo(splitX, 0);
  ctx.lineTo(splitX, height);
  ctx.stroke();

  // 5. Horizontal Center Line at y = 874
  const centerY = Math.round(height / 2);
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#3b82f6';
  ctx.beginPath();
  ctx.moveTo(0, centerY);
  ctx.lineTo(width, centerY);
  ctx.stroke();

  // 6. Outer Border (Perimeter 2px)
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#0f172a';
  ctx.strokeRect(1, 1, width - 2, height - 2);

  // 7. Corner markers and labels
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('TL (0,0)', 10, 10);

  ctx.textAlign = 'right';
  ctx.fillText(`TR (${width},0)`, width - 10, 10);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`BL (0,${height})`, 10, height - 10);

  ctx.textAlign = 'right';
  ctx.fillText(`BR (${width},${height})`, width - 10, height - 10);

  // 8. Center Metadata Labels
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Left Strip Header
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('LEFT STRIP (590 × 1748 px)', splitX / 2, 120);

  // Right Strip Header
  ctx.fillText('RIGHT STRIP (591 × 1748 px)', splitX + (width - splitX) / 2, 120);

  // Central Calibration Block
  const blockW = 480;
  const blockH = 260;
  const blockX = (width - blockW) / 2;
  const blockY = centerY - blockH / 2;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.fillRect(blockX, blockY, blockW, blockH);
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#0f172a';
  ctx.strokeRect(blockX, blockY, blockW, blockH);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('CANON SELPHY CP1000', width / 2, centerY - 80);

  ctx.font = '18px monospace';
  ctx.fillText('CALIBRATION & OVERSCAN TEST', width / 2, centerY - 45);
  ctx.fillText(`Media: ${profile.widthMm} × ${profile.heightMm} mm (Postcard)`, width / 2, centerY - 15);
  ctx.fillText(`Resolution: ${profile.dpi} × ${profile.dpi} DPI`, width / 2, centerY + 15);
  ctx.fillText(`Raster: ${width} × ${height} px`, width / 2, centerY + 45);
  ctx.fillText('Split: Left 590px | Right 591px', width / 2, centerY + 75);

  return {
    canvas,
    width,
    height,
    toDataURL(format = 'image/jpeg', quality = 0.95) {
      return canvas.toDataURL(format, quality);
    },
    toBlob(format = 'image/jpeg', quality = 0.95) {
      return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else
              reject(
                new Error(
                  '[generateCalibrationSheet] Failed to create canvas blob',
                ),
              );
          },
          format,
          quality,
        );
      });
    },
  };
}
