import React, { useState } from 'react';
import { PhotoItem, SessionData } from '../../types';
import { cameraService } from '../../services/cameraService';
import { RefreshCw, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PhotoReviewScreenProps {
  session: SessionData;
  onRetakePhoto: (indexToReplace: number, newPhoto: PhotoItem) => void;
  onContinueToFrame: () => void;
}

export const PhotoReviewScreen: React.FC<PhotoReviewScreenProps> = ({
  session,
  onRetakePhoto,
  onContinueToFrame,
}) => {
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [isRetaking, setIsRetaking] = useState<boolean>(false);
  const [retakeCountdown, setRetakeCountdown] = useState<number>(3);

  const startRetakeProcess = (index: number) => {
    setSelectedPhotoIndex(index);
    setIsRetaking(true);
    setRetakeCountdown(3);

    let count = 3;
    const interval = setInterval(() => {
      count -= 1;
      cameraService.playBeepSound(800 + (4 - count) * 100, 120);
      setRetakeCountdown(count);

      if (count === 0) {
        clearInterval(interval);
        executeSingleRetake(index);
      }
    }, 1000);
  };

  const executeSingleRetake = async (index: number) => {
    const dataUrl = await cameraService.capturePhoto(index);
    const newPhoto: PhotoItem = {
      id: `photo_retake_${Date.now()}_${index}`,
      index: index + 1,
      dataUrl,
      timestamp: new Date().toLocaleTimeString('vi-VN'),
      isRetaken: true,
    };

    onRetakePhoto(index, newPhoto);
    setIsRetaking(false);
    setSelectedPhotoIndex(null);
  };

  return (
    <div className="w-full h-[calc(100vh-68px)] flex flex-col items-center justify-between p-6 bg-[#FDFCFB] text-[#1A1A1A] select-none overflow-y-auto">
      {/* Header */}
      <div className="text-center z-10 mb-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-[#F4F2EE] border border-[#1A1A1A]/15 text-[10px] font-bold uppercase tracking-[0.3em] text-[#1A1A1A] mb-2">
          <span>Step 03 / 05 • Gallery Inspection</span>
        </div>
        <h2 className="text-3xl sm:text-5xl font-serif tracking-tight text-[#1A1A1A]">
          Kiểm Tra Bộ Ảnh Chụp
        </h2>
        <p className="text-xs sm:text-sm opacity-70 mt-1 max-w-md mx-auto">
          Chọn bức ảnh bạn muốn chụp lại (retake) hoặc tiếp tục để chọn khung ảnh in.
        </p>
      </div>

      {/* Grid of Photos */}
      <div className="w-full max-w-5xl grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5 my-auto">
        {session.photos.map((photo, idx) => {
          const isSelected = selectedPhotoIndex === idx;
          return (
            <motion.div
              key={photo.id || idx}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => setSelectedPhotoIndex(idx)}
              className={`group relative overflow-hidden bg-[#F4F2EE] border cursor-pointer transition-all ${
                isSelected
                  ? 'border-[#1A1A1A] ring-2 ring-[#1A1A1A]/30 scale-[1.02] shadow-md'
                  : 'border-[#1A1A1A]/15 hover:border-[#1A1A1A]'
              }`}
            >
              <div className="aspect-[4/3] w-full bg-[#E8E6E1] relative">
                <img
                  src={photo.dataUrl}
                  alt={`Photo ${idx + 1}`}
                  className="w-full h-full object-cover"
                />

                <div className="absolute top-2 left-2 px-2 py-0.5 bg-[#1A1A1A] text-[#FDFCFB] font-mono font-bold text-[10px] tracking-wider">
                  #{idx + 1}
                </div>

                {photo.isRetaken && (
                  <div className="absolute top-2 right-2 px-2 py-0.5 bg-[#1A1A1A] text-[#FDFCFB] font-mono font-bold text-[9px] uppercase tracking-widest border border-[#FDFCFB]/30">
                    RETAKEN
                  </div>
                )}
              </div>

              {/* Card Footer */}
              <div className="p-3 bg-[#F4F2EE] flex items-center justify-between border-t border-[#1A1A1A]/10">
                <span className="text-[10px] font-mono opacity-60">{photo.timestamp}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startRetakeProcess(idx);
                  }}
                  className="px-2.5 py-1 bg-[#1A1A1A] text-[#FDFCFB] hover:bg-transparent hover:text-[#1A1A1A] border border-[#1A1A1A] text-[9px] font-bold tracking-widest uppercase flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-2.5 h-2.5" />
                  <span>Retake</span>
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Action Footer */}
      <div className="w-full max-w-2xl flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
        {selectedPhotoIndex !== null ? (
          <button
            onClick={() => startRetakeProcess(selectedPhotoIndex)}
            className="w-full sm:flex-1 h-[48px] bg-[#E8E6E1] hover:bg-[#1A1A1A] hover:text-[#FDFCFB] text-[#1A1A1A] font-bold text-xs uppercase tracking-[0.2em] border border-[#1A1A1A] flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Chụp lại tấm #{selectedPhotoIndex + 1}</span>
          </button>
        ) : (
          <div className="hidden sm:block flex-1 text-[11px] font-mono opacity-60 text-center">
            * Chọn vào tấm ảnh nếu bạn muốn chụp lại
          </div>
        )}

        <button
          onClick={onContinueToFrame}
          className="w-full sm:flex-1 h-[48px] bg-[#1A1A1A] text-[#FDFCFB] hover:bg-[#FDFCFB] hover:text-[#1A1A1A] font-bold text-xs tracking-[0.2em] uppercase border border-[#1A1A1A] flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-md"
        >
          <span>Tiếp tục chọn khung</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Retake Countdown Overlay Modal */}
      <AnimatePresence>
        {isRetaking && selectedPhotoIndex !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#FDFCFB]/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center text-[#1A1A1A]"
          >
            <div className="font-serif text-3xl sm:text-4xl mb-2">
              Đang Chụp Lại Ảnh #{selectedPhotoIndex + 1}
            </div>
            <p className="text-xs uppercase tracking-[0.2em] opacity-70 mb-8 font-bold">Hãy nhìn vào ống kính camera!</p>

            <motion.div
              key={retakeCountdown}
              initial={{ scale: 1.8 }}
              animate={{ scale: 1 }}
              className="w-36 h-36 bg-[#1A1A1A] text-[#FDFCFB] border border-[#1A1A1A] flex items-center justify-center font-serif text-7xl shadow-2xl mb-6"
            >
              {retakeCountdown}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

