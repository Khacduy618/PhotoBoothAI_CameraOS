import React, { useState, useEffect, useRef } from 'react';
import { CameraSettings, PhotoItem, SessionData, CaptureConfig } from '../../types';
import { cameraService } from '../../services/cameraService';
import { CanonViewfinderHUD } from '../UI/CanonViewfinderHUD';
import { Camera } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AutoCaptureScreenProps {
  session: SessionData;
  cameraSettings: CameraSettings;
  captureConfig: CaptureConfig;
  onPhotoCaptured: (photo: PhotoItem) => void;
  onCaptureCompleted: () => void;
}

export const AutoCaptureScreen: React.FC<AutoCaptureScreenProps> = ({
  session,
  cameraSettings,
  captureConfig,
  onPhotoCaptured,
  onCaptureCompleted,
}) => {
  const [currentShot, setCurrentShot] = useState<number>(0);
  const [countdown, setCountdown] = useState<number>(captureConfig.countdownSeconds || 3);
  const [isFlashing, setIsFlashing] = useState<boolean>(false);
  const [capturedPool, setCapturedPool] = useState<PhotoItem[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);

  const totalShots = session.captureCount;

  useEffect(() => {
    if (videoRef.current) {
      cameraService.attachToVideo(videoRef.current);
    }
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (currentShot < totalShots) {
      if (countdown > 0) {
        // Play audio countdown beep
        cameraService.playBeepSound(800 + (4 - countdown) * 100, 120);
        timer = setTimeout(() => setCountdown((prev) => prev - 1), 1000);
      } else if (countdown === 0) {
        // Execute Capture
        executeCapture();
      }
    } else {
      // Completed all shots
      timer = setTimeout(() => {
        onCaptureCompleted();
      }, 1000);
    }

    return () => clearTimeout(timer);
  }, [currentShot, countdown, totalShots]);

  const executeCapture = async () => {
    // White shutter flash
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 200);

    // Capture photo from cameraService
    const dataUrl = await cameraService.capturePhoto(currentShot);

    const newPhoto: PhotoItem = {
      id: `photo_${Date.now()}_${currentShot}`,
      index: currentShot + 1,
      dataUrl,
      timestamp: new Date().toLocaleTimeString('vi-VN'),
    };

    setCapturedPool((prev) => [...prev, newPhoto]);
    onPhotoCaptured(newPhoto);

    // Next shot setup after interval
    setTimeout(() => {
      if (currentShot + 1 < totalShots) {
        setCurrentShot((prev) => prev + 1);
        setCountdown(captureConfig.countdownSeconds || 3);
      } else {
        setCurrentShot(totalShots);
      }
    }, (captureConfig.intervalSeconds || 2) * 1000);
  };

  return (
    <div className="relative w-full h-[calc(100vh-68px)] flex flex-col items-center justify-between p-4 sm:p-6 bg-[#FDFCFB] text-[#1A1A1A] select-none overflow-hidden">
      {/* White Camera Flash Overlay */}
      <AnimatePresence>
        {isFlashing && (
          <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-white z-50 pointer-events-none"
          />
        )}
      </AnimatePresence>

      {/* Header Info */}
      <div className="z-10 text-center mb-1">
        <h3 className="text-[#1A1A1A] font-serif text-lg font-bold uppercase tracking-wider">
          ĐANG CHỤP ẢNH {Math.min(currentShot + 1, totalShots)} / {totalShots}
        </h3>
      </div>

      {/* Main Viewfinder Canvas & Big Countdown Overlay */}
      <div className="relative w-full max-w-4xl h-[56vh] sm:h-[62vh] bg-[#1A1A1A] border border-[#1A1A1A] shadow-lg overflow-hidden flex items-center justify-center my-auto">
        {cameraSettings.mode === 'webcam' ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover -scale-x-100"
          />
        ) : (
          <div className="w-full h-full relative bg-[#1A1A1A] text-[#FDFCFB] flex flex-col items-center justify-center">
            <Camera className="w-16 h-16 text-[#FDFCFB]/40 animate-pulse" />
          </div>
        )}

        {/* HUD Viewfinder */}
        <CanonViewfinderHUD
          showGrid={true}
          isCapturing={countdown === 0}
        />

        {/* Big Animated Editorial Countdown Number */}
        {countdown > 0 && currentShot < totalShots && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#1A1A1A]/40 backdrop-blur-[2px]">
            <motion.div
              key={countdown}
              initial={{ scale: 1.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="w-36 h-36 sm:w-48 sm:h-48 bg-[#FDFCFB] text-[#1A1A1A] border border-[#1A1A1A] flex items-center justify-center font-serif text-7xl sm:text-9xl shadow-2xl"
            >
              {countdown}
            </motion.div>
          </div>
        )}
      </div>

      {/* Bottom Thumbnail Strip of Captured Photos in Real Time */}
      <div className="z-10 w-full max-w-4xl flex items-center justify-between gap-3 py-2.5 px-6 bg-[#F4F2EE] border border-[#1A1A1A]/15">
        <span className="text-[10px] font-mono font-bold tracking-widest uppercase opacity-60">
          GALLERY ({capturedPool.length}/{totalShots})
        </span>
        <div className="flex items-center gap-2 overflow-x-auto py-0.5">
          {Array.from({ length: totalShots }).map((_, idx) => {
            const photo = capturedPool[idx];
            return (
              <div
                key={idx}
                className={`w-14 h-10 sm:w-16 sm:h-11 border flex items-center justify-center overflow-hidden transition-all ${
                  photo
                    ? 'border-[#1A1A1A] bg-[#FDFCFB]'
                    : idx === currentShot
                    ? 'border-[#1A1A1A] bg-[#E8E6E1] animate-pulse'
                    : 'border-[#1A1A1A]/15 bg-[#FDFCFB]/50 text-[#1A1A1A]/30'
                }`}
              >
                {photo ? (
                  <img src={photo.dataUrl} alt={`Captured ${idx + 1}`} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[10px] font-mono font-bold">#{idx + 1}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

