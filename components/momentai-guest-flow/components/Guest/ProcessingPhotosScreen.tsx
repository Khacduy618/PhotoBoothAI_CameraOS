import React from 'react';
import { PhotoItem } from '../../types';
import { motion } from 'motion/react';
import { Sparkles, Loader2, Image as ImageIcon } from 'lucide-react';

interface ProcessingPhotosScreenProps {
  photos: PhotoItem[];
  statusMessage?: string;
}

export const ProcessingPhotosScreen: React.FC<ProcessingPhotosScreenProps> = ({
  photos = [],
  statusMessage = 'Đang đồng bộ ảnh chất lượng cao vào các mẫu khung hình...',
}) => {
  const count = photos.length;
  const isSixPhotos = count >= 6;
  const isFourPhotos = count === 4;

  const containerMaxWidth = isFourPhotos
    ? 'max-w-5xl'
    : isSixPhotos
      ? 'max-w-4xl'
      : count === 1
        ? 'max-w-md'
        : 'max-w-2xl';

  const layoutClass = isSixPhotos
    ? 'grid grid-cols-3 gap-3.5 sm:gap-4 p-4 sm:p-5 w-full bg-[#F4F2EE] border border-[#1A1A1A]/10 rounded-2xl shadow-sm'
    : isFourPhotos
      ? 'grid grid-cols-4 gap-3 sm:gap-4 p-4 sm:p-5 w-full bg-[#F4F2EE] border border-[#1A1A1A]/10 rounded-2xl shadow-sm'
      : 'flex flex-row items-center justify-center gap-4 sm:gap-6 p-4 sm:p-5 w-full bg-[#F4F2EE] border border-[#1A1A1A]/10 rounded-2xl shadow-sm';

  const cardWidthClass = isSixPhotos || isFourPhotos
    ? 'w-full'
    : count === 1
      ? 'w-64 sm:w-72'
      : 'w-48 sm:w-56';

  return (
    <div className="w-full h-screen flex flex-col justify-between items-center px-4 py-8 sm:px-8 sm:py-12 bg-[#FDFCFB] text-[#1A1A1A] select-none overflow-hidden relative">
      {/* Subtle Background Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#D97706]/5 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-xl mx-auto text-center flex flex-col items-center gap-2"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D97706]/10 text-[#D97706] text-xs font-bold tracking-widest uppercase mb-1">
          <Sparkles className="w-3.5 h-3.5 animate-pulse" />
          <span>XỬ LÝ HOÀN TẤT SHOT CHỤP</span>
        </div>

        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif tracking-normal text-[#1A1A1A]">
          ĐANG CHUẨN BỊ ẢNH
        </h2>

        <p className="text-xs sm:text-sm text-[#1A1A1A]/70 font-sans max-w-md">
          {statusMessage}
        </p>
      </motion.div>

      {/* Center Filmstrip / Photos Gallery */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className={`w-full ${containerMaxWidth} mx-auto flex flex-col items-center justify-center gap-6 my-auto`}
      >
        {/* Photo Grid / Strip */}
        <div className={layoutClass}>
          {photos.length > 0 ? (
            photos.map((photo, index) => (
              <motion.div
                key={photo.id || index}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.15 + index * 0.08 }}
                className={`relative aspect-[3/2] ${cardWidthClass} bg-white rounded-lg overflow-hidden border border-[#1A1A1A]/15 shadow-md flex-shrink-0`}
              >
                {photo.dataUrl ? (
                  <img
                    src={photo.dataUrl}
                    alt={`Shot #${index + 1}`}
                    className="w-full h-full object-cover"
                    style={{ imageRendering: '-webkit-optimize-contrast' }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
                    <ImageIcon className="w-8 h-8 opacity-40" />
                  </div>
                )}
                {/* Shot Number Badge */}
                <div className="absolute top-1.5 left-1.5 bg-[#1A1A1A]/80 text-white text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-xs backdrop-blur-xs">
                  #{index + 1}
                </div>
              </motion.div>
            ))
          ) : (
            <div className="py-10 text-center text-sm opacity-60 font-sans">
              Đang tổng hợp các tấm ảnh...
            </div>
          )}
        </div>

        {/* Animated Progress / Spinner Indicator */}
        <div className="flex items-center gap-3 text-[#D97706]">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-xs sm:text-sm font-mono font-bold tracking-wider uppercase text-[#1A1A1A]/80">
            Sắp chuyển sang chọn khung hình...
          </span>
        </div>
      </motion.div>

      {/* Footer Branding */}
      <div className="text-center">
        <span className="text-[11px] font-serif italic text-[#1A1A1A]/50 tracking-wider">
          MomentAI CameraOS • Tiệm Ảnh Di Sản Hội An
        </span>
      </div>
    </div>
  );
};
