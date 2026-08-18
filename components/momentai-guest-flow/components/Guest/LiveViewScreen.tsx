import React, { useEffect, useRef } from 'react';
import { CameraSettings, SessionData } from '../../types';
import { cameraService } from '../../services/cameraService';
import { CanonViewfinderHUD } from '../UI/CanonViewfinderHUD';
import { Play, Camera } from 'lucide-react';
import { motion } from 'motion/react';

interface LiveViewScreenProps {
  session: SessionData;
  cameraSettings: CameraSettings;
  onStartCapture: () => void;
}

export const LiveViewScreen: React.FC<LiveViewScreenProps> = ({
  session,
  cameraSettings,
  onStartCapture,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      cameraService.attachToVideo(videoRef.current);
    }
  }, []);

  return (
    <div className="w-full h-[calc(100vh-68px)] flex flex-col items-center justify-between p-4 sm:p-8 bg-[#FDFCFB] text-[#1A1A1A] select-none">
      {/* Header Prompt */}
      <div className="text-center z-10 mb-2">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-3.5 py-1 bg-[#F4F2EE] border border-[#1A1A1A]/15 text-[10px] font-bold uppercase tracking-[0.3em] text-[#1A1A1A] mb-2"
        >
          <span>Step 02 / 05 • Canon Live View Alignment</span>
        </motion.div>
        <h2 className="text-2xl sm:text-4xl font-serif tracking-tight text-[#1A1A1A]">
          Chuẩn bị tạo dáng & nhìn vào ống kính
        </h2>
      </div>

      {/* Main Live View Viewfinder Box */}
      <div className="relative w-full max-w-4xl h-[52vh] sm:h-[60vh] bg-[#1A1A1A] border border-[#1A1A1A] shadow-lg overflow-hidden flex items-center justify-center my-auto">
        {/* Real Webcam or Simulated Viewfinder Content */}
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
            <div className="w-24 h-24 bg-[#FDFCFB]/10 border border-[#FDFCFB]/20 flex items-center justify-center mb-4 animate-pulse">
              <Camera className="w-12 h-12 text-[#FDFCFB]" />
            </div>
            <p className="font-serif italic text-lg tracking-wide text-[#FDFCFB]">Canon EOS 6D Studio Feed</p>
            <p className="text-[10px] font-mono tracking-widest text-[#FDFCFB]/60 mt-1 uppercase">EDSDK USB Frame Buffer • Active</p>
          </div>
        )}

        {/* Canon EOS 6D Viewfinder OSD / HUD */}
        <CanonViewfinderHUD settings={cameraSettings} showGrid={true} />
      </div>

      {/* Action Footer Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="z-10 mt-3 mb-2 flex flex-col items-center"
      >
        <button
          onClick={onStartCapture}
          className="w-[300px] sm:w-[360px] h-[52px] bg-[#1A1A1A] text-[#FDFCFB] border border-[#1A1A1A] flex items-center justify-center gap-3 text-xs font-bold tracking-[0.25em] uppercase hover:bg-[#FDFCFB] hover:text-[#1A1A1A] transition-all cursor-pointer shadow-md"
        >
          <Play className="w-4 h-4 fill-current" />
          <span>BẮT ĐẦU CHỤP ({session.captureCount} ẢNH)</span>
        </button>

        <span className="text-[10px] font-mono opacity-50 mt-2 uppercase tracking-wider">
          * Đếm ngược {session.captureCount} lượt chụp liên tiếp
        </span>
      </motion.div>
    </div>
  );
};

