import React, { useState } from 'react';
import { ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { motion } from 'motion/react';
import { GuestBottomNavigation } from '../UI/GuestBottomNavigation';

interface SelectShotsScreenProps {
  onSelectShots: (count: number) => void;
  onBackToStart?: () => void;
  enabledShotCounts?: readonly number[];
}

export const SelectShotsScreen: React.FC<SelectShotsScreenProps> = ({
  onSelectShots,
  onBackToStart,
  enabledShotCounts = [1, 2, 4, 6],
}) => {
  const [selectedShotCount, setSelectedShotCount] = useState<number | null>(null);

  const shotOptions = [
    {
      shotCount: 1,
      label: '1 SHOT',
      preview: (
        <div className="w-40 sm:w-44 xl:w-48 aspect-[2/3] bg-[#FDFCFB] p-3 sm:p-4 flex flex-col justify-between border-2 border-[#1A1A1A]/20 shadow-md rounded-xs transform hover:scale-105 transition-transform duration-200">
          <div className="w-full h-[84%] bg-[#1A1A1A]/5 border-2 border-dashed border-[#1A1A1A]/30 flex items-center justify-center font-mono text-base font-bold text-[#1A1A1A]/60 rounded-xs">
            1
          </div>
          <div className="text-xs font-serif italic text-center text-[#1A1A1A] font-bold tracking-wider pt-1 border-t border-[#1A1A1A]/10">
            PHỐ CỔ HỘI AN
          </div>
        </div>
      ),
    },
    {
      shotCount: 2,
      label: '2 SHOTS',
      preview: (
        <div className="w-40 sm:w-44 xl:w-48 aspect-[2/3] bg-[#FDFCFB] p-3 sm:p-4 flex flex-col justify-between gap-2 border-2 border-[#1A1A1A]/20 shadow-md rounded-xs transform hover:scale-105 transition-transform duration-200">
          <div className="w-full h-[41%] bg-[#1A1A1A]/5 border-2 border-dashed border-[#1A1A1A]/30 flex items-center justify-center font-mono text-base font-bold text-[#1A1A1A]/60 rounded-xs">
            1
          </div>
          <div className="w-full h-[41%] bg-[#1A1A1A]/5 border-2 border-dashed border-[#1A1A1A]/30 flex items-center justify-center font-mono text-base font-bold text-[#1A1A1A]/60 rounded-xs">
            2
          </div>
          <div className="text-xs font-serif italic text-center text-[#1A1A1A] font-bold tracking-wider pt-0.5 border-t border-[#1A1A1A]/10">
            PHỐ CỔ HỘI AN
          </div>
        </div>
      ),
    },
    {
      shotCount: 4,
      label: '4 SHOTS',
      preview: (
        <div className="w-40 sm:w-44 xl:w-48 aspect-[2/3] bg-[#FDFCFB] p-3 sm:p-4 flex flex-col justify-between gap-1.5 border-2 border-[#1A1A1A]/20 shadow-md rounded-xs transform hover:scale-105 transition-transform duration-200">
          <div className="grid grid-cols-2 gap-1.5 w-full h-[84%]">
            {[1, 2, 3, 4].map((num) => (
              <div
                key={num}
                className="w-full h-full bg-[#1A1A1A]/5 border-2 border-dashed border-[#1A1A1A]/30 flex items-center justify-center font-mono text-xs font-bold text-[#1A1A1A]/60 rounded-xs"
              >
                {num}
              </div>
            ))}
          </div>
          <div className="text-xs font-serif italic text-center text-[#1A1A1A] font-bold tracking-wider pt-0.5 border-t border-[#1A1A1A]/10">
            PHỐ CỔ HỘI AN
          </div>
        </div>
      ),
    },
    {
      shotCount: 6,
      label: '6 SHOTS',
      preview: (
        <div className="w-40 sm:w-44 xl:w-48 aspect-[2/3] bg-[#FDFCFB] p-3 sm:p-4 flex flex-col justify-between gap-1.5 border-2 border-[#1A1A1A]/20 shadow-md rounded-xs transform hover:scale-105 transition-transform duration-200">
          <div className="grid grid-cols-2 gap-1.5 w-full h-[84%]">
            {[1, 2, 3, 4, 5, 6].map((num) => (
              <div
                key={num}
                className="w-full h-full bg-[#1A1A1A]/5 border-2 border-dashed border-[#1A1A1A]/30 flex items-center justify-center font-mono text-xs font-bold text-[#1A1A1A]/60 rounded-xs"
              >
                {num}
              </div>
            ))}
          </div>
          <div className="text-xs font-serif italic text-center text-[#1A1A1A] font-bold tracking-wider pt-0.5 border-t border-[#1A1A1A]/10">
            PHỐ CỔ HỘI AN
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="w-full h-screen flex flex-col justify-between px-4 py-3 sm:px-8 sm:py-5 bg-[#FDFCFB] text-[#1A1A1A] select-none overflow-hidden">
      {/* Top Header */}
      <div className="w-full max-w-[98%] mx-auto flex flex-col items-center text-center">
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-4xl sm:text-5xl lg:text-6xl font-serif tracking-tight text-[#1A1A1A] mb-1"
        >
          CHỌN KIỂU ẢNH
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-xs sm:text-sm opacity-75 max-w-lg font-sans"
        >
          Chọn số khoảnh khắc bạn muốn ghi lại trong phiên chụp này.
        </motion.p>
      </div>

      {/* Shot Format Grid */}
      <div className="w-full max-w-[98%] mx-auto flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-center my-auto py-2">
        {shotOptions.filter((opt) => enabledShotCounts.includes(opt.shotCount)).map((opt, idx) => {
          const isSelected = selectedShotCount === opt.shotCount;
          return (
            <motion.button
              key={opt.shotCount}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * idx }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelectedShotCount(opt.shotCount)}
              className={`relative p-6 sm:p-8 h-[58vh] xl:h-[64vh] border-2 transition-all duration-200 flex flex-col items-center justify-between text-center cursor-pointer bg-[#F4F2EE] text-[#1A1A1A] rounded-md ${
                isSelected
                  ? 'border-[#1A1A1A] ring-4 ring-[#1A1A1A]/20 shadow-xl bg-[#FAF8F5]'
                  : 'border-[#1A1A1A]/15 hover:border-[#1A1A1A]/60'
              }`}
            >
              {/* Selection Badge */}
              {isSelected && (
                <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-[#1A1A1A] text-[#FDFCFB] text-xs font-bold px-3.5 py-1.5 tracking-wider uppercase rounded-xs shadow-md">
                  <Check className="w-4 h-4 text-[#FDFCFB]" />
                  <span>ĐÃ CHỌN</span>
                </div>
              )}

              {/* Layout Illustration Centered */}
              <div className="my-auto flex items-center justify-center h-full py-4">
                <div className="transform scale-125 sm:scale-135 transition-transform duration-200">
                  {opt.preview}
                </div>
              </div>

              <span className="text-3xl sm:text-4xl font-serif font-black tracking-tight mt-6 text-[#1A1A1A]">
                {opt.label}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* Bottom Action Bar */}
      {/* Shared Bottom Actions */}
      <GuestBottomNavigation
        onBack={onBackToStart}
        backText="QUAY LẠI"
        onNext={() => selectedShotCount && onSelectShots(selectedShotCount)}
        nextText="TIẾP TỤC"
        nextDisabled={!selectedShotCount}
      />
    </div>
  );
};


