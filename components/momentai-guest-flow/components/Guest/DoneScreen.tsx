import React, { useEffect, useState } from 'react';
import { Heart, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';

interface DoneScreenProps {
  onAutoReset: () => void;
  resetDelaySeconds?: number;
}

export const DoneScreen: React.FC<DoneScreenProps> = ({
  onAutoReset,
  resetDelaySeconds = 6,
}) => {
  const [secondsLeft, setSecondsLeft] = useState<number>(resetDelaySeconds);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onAutoReset();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onAutoReset]);

  return (
    <div
      onClick={onAutoReset}
      className="w-full h-[calc(100vh-68px)] flex flex-col items-center justify-center p-8 bg-[#FDFCFB] text-[#1A1A1A] select-none cursor-pointer"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="max-w-md w-full text-center flex flex-col items-center"
      >
        <div className="w-20 h-20 sm:w-24 sm:h-24 bg-[#1A1A1A] text-[#FDFCFB] mb-8 flex items-center justify-center border border-[#1A1A1A]">
          <Heart className="w-10 h-10 text-[#FDFCFB] fill-[#FDFCFB]" />
        </div>

        <h2 className="text-4xl sm:text-6xl font-serif tracking-tight text-[#1A1A1A] mb-3">
          Cảm Ơn Bạn
        </h2>

        <p className="text-sm sm:text-base opacity-70 font-sans mb-8 leading-relaxed max-w-sm">
          Cảm ơn bạn đã trải nghiệm PhotoBoothAI. Ảnh số đã được lưu và có thể tải về qua mã QR.
          {' '}Nếu đã xác nhận in, vui lòng nhận ảnh tại khay ra của máy in.
        </p>

        <div className="inline-flex items-center gap-3 px-5 py-2.5 bg-[#F4F2EE] border border-[#1A1A1A]/15 text-[10px] font-mono font-bold uppercase tracking-widest text-[#1A1A1A]">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#1A1A1A]" />
          <span>Tự động chuyển tiếp sau {secondsLeft}s</span>
        </div>
      </motion.div>
    </div>
  );
};

