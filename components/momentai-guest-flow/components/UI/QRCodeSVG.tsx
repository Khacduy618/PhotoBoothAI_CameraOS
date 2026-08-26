import React, { useMemo } from 'react';
import QRCode from 'qrcode';

interface QRCodeSVGProps {
  value: string;
  size?: number;
  fgColor?: string;
  bgColor?: string;
}

export const QRCodeSVG: React.FC<QRCodeSVGProps> = ({
  value,
  size = 200,
  fgColor = '#0f172a',
  bgColor = '#ffffff',
}) => {
  const qrMatrix = useMemo(() => {
    try {
      if (!value) return null;
      const qr = QRCode.create(value, {
        errorCorrectionLevel: 'M',
      });
      const moduleCount = qr.modules.size;
      const data: boolean[][] = [];
      for (let r = 0; r < moduleCount; r++) {
        const row: boolean[] = [];
        for (let c = 0; c < moduleCount; c++) {
          row.push(Boolean(qr.modules.get(r, c)));
        }
        data.push(row);
      }
      return { moduleCount, data };
    } catch (err) {
      console.warn('QR code generation error:', err);
      return null;
    }
  }, [value]);

  if (!qrMatrix) {
    return (
      <div
        style={{ width: size, height: size }}
        className="flex items-center justify-center bg-stone-100 text-stone-400 text-xs font-mono rounded-xl"
      >
        QR GENERATING...
      </div>
    );
  }

  const { moduleCount, data } = qrMatrix;
  const margin = 2; // quiet zone in module units
  const totalModules = moduleCount + margin * 2;
  const cellSize = size / totalModules;

  const rects: React.ReactNode[] = [];
  for (let r = 0; r < moduleCount; r++) {
    for (let c = 0; c < moduleCount; c++) {
      if (data[r][c]) {
        rects.push(
          <rect
            key={`${r}-${c}`}
            x={(c + margin) * cellSize}
            y={(r + margin) * cellSize}
            width={cellSize + 0.05}
            height={cellSize + 0.05}
            fill={fgColor}
          />
        );
      }
    }
  }

  return (
    <div className="relative inline-block p-2 rounded-2xl bg-white shadow-xl border border-slate-100">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="rounded-xl overflow-hidden"
      >
        <rect width={size} height={size} fill={bgColor} />
        {rects}
      </svg>
    </div>
  );
};
