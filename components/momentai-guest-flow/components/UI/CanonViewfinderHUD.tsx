import React from 'react';

interface CanonViewfinderHUDProps {
  showGrid?: boolean;
  isCapturing?: boolean;
  settings?: unknown;
}

export const CanonViewfinderHUD: React.FC<CanonViewfinderHUDProps> = ({
  showGrid = true,
  isCapturing = false,
}) => {
  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6 select-none font-mono text-xs text-[#FDFCFB] font-medium z-10">
      {/* Top Bar - Clean Live Feed Indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 px-3 py-1 bg-[#1A1A1A]/70 backdrop-blur-md border border-[#FDFCFB]/15 text-[#FDFCFB] rounded-xs">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
          <span className="font-sans font-bold tracking-widest text-[10px] uppercase">CAMERA LIVE</span>
        </div>
      </div>

      {/* Grid Lines */}
      {showGrid && (
        <div className="absolute inset-x-0 top-12 bottom-12 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-15">
          <div className="border-r border-b border-[#FDFCFB]"></div>
          <div className="border-r border-b border-[#FDFCFB]"></div>
          <div className="border-b border-[#FDFCFB]"></div>
          <div className="border-r border-b border-[#FDFCFB]"></div>
          <div className="border-r border-b border-[#FDFCFB]"></div>
          <div className="border-b border-[#FDFCFB]"></div>
          <div className="border-r border-[#FDFCFB]"></div>
          <div className="border-r border-[#FDFCFB]"></div>
          <div></div>
        </div>
      )}

    </div>
  );
};


