import React, { useState } from 'react';
import { ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { motion } from 'motion/react';

interface SelectShotsScreenProps {
  onSelectShots: (count: number) => void;
  onBackToStart?: () => void;
}

export const SelectShotsScreen: React.FC<SelectShotsScreenProps> = ({
  onSelectShots,
  onBackToStart,
}) => {
  const [selectedShotCount, setSelectedShotCount] = useState<number | null>(null);

  const shotOptions = [
    {
      shotCount: 1,
      label: '1 SHOT',
      preview: (
        <div className="w-28 aspect-[2/3] bg-[#FDFCFB] p-2.5 flex flex-col justify-between border border-[#1A1A1A]/30 shadow-sm rounded-xs transform hover:scale-105 transition-transform duration-200">
          <div className="w-full h-[82%] bg-[#1A1A1A]/5 border border-dashed border-[#1A1A1A]/30 flex items-center justify-center font-mono text-xs font-bold text-[#1A1A1A]/50 rounded-xs">
            1
          </div>
          <div className="text-[8px] font-serif italic text-center text-[#1A1A1A] font-bold tracking-wider pt-1 border-t border-[#1A1A1A]/10">
            PHỐ CỔ HỘI AN
          </div>
        </div>
      ),
    },
    {
      shotCount: 2,
      label: '2 SHOTS',
      preview: (
        <div className="w-28 aspect-[2/3] bg-[#FDFCFB] p-2.5 flex flex-col justify-between gap-1.5 border border-[#1A1A1A]/30 shadow-sm rounded-xs transform hover:scale-105 transition-transform duration-200">
          <div className="w-full h-[41%] bg-[#1A1A1A]/5 border border-dashed border-[#1A1A1A]/30 flex items-center justify-center font-mono text-xs font-bold text-[#1A1A1A]/50 rounded-xs">
            1
          </div>
          <div className="w-full h-[41%] bg-[#1A1A1A]/5 border border-dashed border-[#1A1A1A]/30 flex items-center justify-center font-mono text-xs font-bold text-[#1A1A1A]/50 rounded-xs">
            2
          </div>
          <div className="text-[8px] font-serif italic text-center text-[#1A1A1A] font-bold tracking-wider pt-0.5 border-t border-[#1A1A1A]/10">
            PHỐ CỔ HỘI AN
          </div>
        </div>
      ),
    },
    {
      shotCount: 4,
      label: '4 SHOTS',
      preview: (
        <div className="w-20 aspect-[1/2.2] bg-[#FDFCFB] p-1.5 flex flex-col justify-between gap-1 border border-[#1A1A1A]/30 shadow-sm rounded-xs transform hover:scale-105 transition-transform duration-200">
          <div className="w-full h-[20%] bg-[#1A1A1A]/5 border border-dashed border-[#1A1A1A]/30 flex items-center justify-center font-mono text-[10px] font-bold text-[#1A1A1A]/50 rounded-xs">
            1
          </div>
          <div className="w-full h-[20%] bg-[#1A1A1A]/5 border border-dashed border-[#1A1A1A]/30 flex items-center justify-center font-mono text-[10px] font-bold text-[#1A1A1A]/50 rounded-xs">
            2
          </div>
          <div className="w-full h-[20%] bg-[#1A1A1A]/5 border border-dashed border-[#1A1A1A]/30 flex items-center justify-center font-mono text-[10px] font-bold text-[#1A1A1A]/50 rounded-xs">
            3
          </div>
          <div className="w-full h-[20%] bg-[#1A1A1A]/5 border border-dashed border-[#1A1A1A]/30 flex items-center justify-center font-mono text-[10px] font-bold text-[#1A1A1A]/50 rounded-xs">
            4
          </div>
          <div className="text-[7px] font-serif italic text-center text-[#1A1A1A] font-bold tracking-wider pt-0.5 border-t border-[#1A1A1A]/10">
            HỘI AN
          </div>
        </div>
      ),
    },
    {
      shotCount: 6,
      label: '6 SHOTS',
      preview: (
        <div className="w-28 aspect-[2/3] bg-[#FDFCFB] p-2 flex flex-col justify-between gap-1 border border-[#1A1A1A]/30 shadow-sm rounded-xs transform hover:scale-105 transition-transform duration-200">
          <div className="grid grid-cols-2 gap-1 w-full h-[85%]">
            {[1, 2, 3, 4, 5, 6].map((num) => (
              <div
                key={num}
                className="w-full h-full bg-[#1A1A1A]/5 border border-dashed border-[#1A1A1A]/30 flex items-center justify-center font-mono text-[10px] font-bold text-[#1A1A1A]/50 rounded-xs"
              >
                {num}
              </div>
            ))}
          </div>
          <div className="text-[8px] font-serif italic text-center text-[#1A1A1A] font-bold tracking-wider pt-0.5 border-t border-[#1A1A1A]/10">
            PHỐ CỔ HỘI AN
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="w-full h-screen flex flex-col justify-between p-6 sm:p-10 bg-[#FDFCFB] text-[#1A1A1A] select-none overflow-y-auto">
      {/* Top Header */}
      <div className="w-full max-w-6xl mx-auto flex flex-col items-center text-center">
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-3xl sm:text-5xl font-serif tracking-tight text-[#1A1A1A] mb-2"
        >
          CHỌN KIỂU ẢNH
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-xs sm:text-sm opacity-70 max-w-md font-sans"
        >
          Chọn số khoảnh khắc bạn muốn ghi lại trong phiên chụp này.
        </motion.p>
      </div>

      {/* Shot Format Grid */}
      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 my-auto py-4">
        {shotOptions.map((opt, idx) => {
          const isSelected = selectedShotCount === opt.shotCount;
          return (
            <motion.button
              key={opt.shotCount}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * idx }}
              onClick={() => setSelectedShotCount(opt.shotCount)}
              className={`relative p-8 sm:p-10 min-h-[300px] border-2 transition-all duration-200 flex flex-col items-center justify-between text-center cursor-pointer bg-[#F4F2EE] text-[#1A1A1A] rounded-sm ${
                isSelected
                  ? 'border-[#1A1A1A] ring-2 ring-[#1A1A1A] shadow-md bg-[#FAF8F5]'
                  : 'border-[#1A1A1A]/15 hover:border-[#1A1A1A]/60'
              }`}
            >
              {/* Selection Badge */}
              {isSelected && (
                <div className="absolute top-3 right-3 flex items-center gap-1 bg-[#1A1A1A] text-[#FDFCFB] text-[10px] font-bold px-2.5 py-1 tracking-wider uppercase rounded-xs">
                  <Check className="w-3.5 h-3.5 text-[#FDFCFB]" />
                  <span>ĐÃ CHỌN</span>
                </div>
              )}

              {/* Layout Illustration Centered */}
              <div className="my-auto flex items-center justify-center h-full py-2">
                {opt.preview}
              </div>

              <span className="text-2xl font-serif font-bold tracking-tight mt-4">
                {opt.label}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* Bottom Action Bar */}
      <div className="w-full max-w-5xl mx-auto border-t border-[#1A1A1A]/10 pt-4 flex justify-between items-center">
        <button
          onClick={onBackToStart}
          className="px-5 py-2.5 border border-[#1A1A1A]/20 hover:border-[#1A1A1A] text-[11px] font-bold tracking-[0.2em] uppercase flex items-center gap-2 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>QUAY LẠI</span>
        </button>

        <button
          disabled={!selectedShotCount}
          onClick={() => {
            if (selectedShotCount) onSelectShots(selectedShotCount);
          }}
          className={`px-8 py-3 text-[11px] font-bold tracking-[0.25em] uppercase flex items-center gap-3 transition-all cursor-pointer ${
            selectedShotCount
              ? 'bg-[#1A1A1A] text-[#FDFCFB] hover:bg-[#333333] shadow-md'
              : 'bg-[#E5E3DD] text-[#8C8880] cursor-not-allowed border border-[#1A1A1A]/10'
          }`}
        >
          <span>TIẾP TỤC</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};


