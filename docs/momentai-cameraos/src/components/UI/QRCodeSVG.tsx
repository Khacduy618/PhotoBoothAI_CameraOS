import React from 'react';

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
  // Simple deterministic pattern generator for presentation QR code styling
  const hash = value.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const cells = 21; // 21x21 grid
  const cellSize = size / cells;

  const isFinderPattern = (r: number, c: number) => {
    // Top-left
    if (r < 7 && c < 7) return true;
    // Top-right
    if (r < 7 && c >= cells - 7) return true;
    // Bottom-left
    if (r >= cells - 7 && c < 7) return true;
    return false;
  };

  const isFinderOuter = (r: number, c: number) => {
    // Top-left
    if ((r === 0 || r === 6 || c === 0 || c === 6) && r <= 6 && c <= 6) return true;
    if (r >= 2 && r <= 4 && c >= 2 && c <= 4) return true;

    // Top-right
    if ((r === 0 || r === 6 || c === cells - 7 || c === cells - 1) && r <= 6 && c >= cells - 7) return true;
    if (r >= 2 && r <= 4 && c >= cells - 5 && c <= cells - 3) return true;

    // Bottom-left
    if ((r === cells - 7 || r === cells - 1 || c === 0 || c === 6) && r >= cells - 7 && c <= 6) return true;
    if (r >= cells - 5 && r <= cells - 3 && c >= 2 && c <= 4) return true;

    return false;
  };

  const rects: React.ReactNode[] = [];

  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      if (isFinderPattern(r, c)) {
        if (isFinderOuter(r, c)) {
          rects.push(
            <rect
              key={`${r}-${c}`}
              x={c * cellSize}
              y={r * cellSize}
              width={cellSize}
              height={cellSize}
              fill={fgColor}
            />
          );
        }
      } else {
        // Pseudo-random cell based on value
        const pseudo = (r * 17 + c * 31 + hash) % 3 !== 0;
        if (pseudo) {
          rects.push(
            <rect
              key={`${r}-${c}`}
              x={c * cellSize + 0.5}
              y={r * cellSize + 0.5}
              width={cellSize - 1}
              height={cellSize - 1}
              rx={cellSize * 0.2}
              fill={fgColor}
            />
          );
        }
      }
    }
  }

  return (
    <div className="relative inline-block p-4 rounded-2xl bg-white shadow-xl border border-slate-100">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <rect width={size} height={size} fill={bgColor} rx={12} />
        {rects}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-10 h-10 rounded-full bg-slate-900 border-2 border-white flex items-center justify-center shadow-md">
          <span className="text-[10px] font-bold text-amber-400 tracking-tighter">6D</span>
        </div>
      </div>
    </div>
  );
};
