import React, { useEffect, useRef, useState } from 'react';
import { CameraSettings, PhotoItem, SessionData, CaptureConfig } from '../../types';
import { cameraService } from '../../services/cameraService';
import { CanonViewfinderHUD } from '../UI/CanonViewfinderHUD';
import { Camera, Hand, MousePointer2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useGestureRecognizer } from '@/hooks/use-gesture-recognizer';

interface AutoCaptureScreenProps {
  session: SessionData;
  cameraSettings: CameraSettings;
  captureConfig: CaptureConfig;
  onPhotoCaptured: (photo: PhotoItem) => void;
  onCaptureCompleted: (photos: PhotoItem[]) => void;
}

type CaptureStep = 'ready' | 'countdown' | 'capturing' | 'saving' | 'between' | 'complete';

export const AutoCaptureScreen: React.FC<AutoCaptureScreenProps> = ({
  session,
  cameraSettings,
  captureConfig,
  onPhotoCaptured,
  onCaptureCompleted,
}) => {
  const [currentShot, setCurrentShot] = useState<number>(0);
  const [countdown, setCountdown] = useState<number>(captureConfig.countdownSeconds || 3);
  const [captureStep, setCaptureStep] = useState<CaptureStep>('ready');
  const [isFlashing, setIsFlashing] = useState<boolean>(false);
  const [capturedPool, setCapturedPool] = useState<PhotoItem[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isCapturingRef = useRef(false);
  const gestureLockedRef = useRef(false);
  const totalShots = session.captureCount;
  const gesture = useGestureRecognizer(videoRef, cameraSettings.mode === 'webcam' && captureStep === 'ready');

  useEffect(() => {
    void cameraService.startWebcam().then(() => {
      if (videoRef.current) cameraService.attachToVideo(videoRef.current);
    });
    return () => cameraService.stopWebcam();
  }, []);

  useEffect(() => {
    const fiveFingerReady = gesture.result.name === 'Open_Palm' && gesture.result.heldDurationMs >= 450;
    if (fiveFingerReady && captureStep === 'ready' && !gestureLockedRef.current) {
      gestureLockedRef.current = true;
      void triggerCaptureSequence('gesture');
    }
    if (gesture.result.name !== 'Open_Palm') {
      gestureLockedRef.current = false;
    }
  }, [gesture.result.heldDurationMs, gesture.result.name, captureStep]);

  const triggerCaptureSequence = async (_source: 'button' | 'gesture') => {
    if (isCapturingRef.current || captureStep !== 'ready') return;
    isCapturingRef.current = true;

    const completedPhotos: PhotoItem[] = [];

    for (let shot = currentShot; shot < totalShots; shot += 1) {
      setCurrentShot(shot);
      setCaptureStep('countdown');
      for (let value = captureConfig.countdownSeconds || 3; value > 0; value -= 1) {
        setCountdown(value);
        cameraService.playBeepSound(800 + (4 - value) * 100, 120);
        await wait(1000);
      }

      setCaptureStep('capturing');
      setIsFlashing(true);
      await wait(180);
      setIsFlashing(false);

      setCaptureStep('saving');
      const dataUrl = await cameraService.capturePhoto(shot);
      const newPhoto: PhotoItem = {
        id: `photo_${Date.now()}_${shot}`,
        index: shot + 1,
        dataUrl,
        timestamp: new Date().toLocaleTimeString('vi-VN'),
      };
      completedPhotos.push(newPhoto);
      setCapturedPool((prev) => [...prev, newPhoto]);
      onPhotoCaptured(newPhoto);

      if (shot + 1 < totalShots) {
        setCaptureStep('between');
        await wait((captureConfig.intervalSeconds || 2) * 1000);
      }
    }

    setCaptureStep('complete');
    await wait(900);
    onCaptureCompleted(completedPhotos);
  };

  const gestureCopy = gesture.isLoading
    ? 'Đang khởi tạo detect tay'
    : gesture.error
      ? 'Detect tay chưa sẵn sàng - dùng nút CHỤP'
      : gesture.result.name === 'Open_Palm'
        ? `Đã thấy 5 ngón ${(gesture.result.confidence * 100).toFixed(0)}%`
        : 'Giơ 5 ngón tay để bắt đầu';

  return (
    <div className="relative w-full h-screen flex flex-col items-center justify-between p-4 sm:p-6 bg-[#FDFCFB] text-[#1A1A1A] select-none overflow-hidden">
      <AnimatePresence>
        {isFlashing && (
          <motion.div initial={{ opacity: 1 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="fixed inset-0 bg-white z-50 pointer-events-none" />
        )}
      </AnimatePresence>

      <div className="z-10 text-center mb-1">
        <h3 className="text-[#1A1A1A] font-serif text-lg font-bold uppercase tracking-wider">ĐANG CHỤP ẢNH {Math.min(currentShot + 1, totalShots)} / {totalShots}</h3>
        <p className="mt-1 text-[10px] font-mono uppercase tracking-[0.22em] opacity-60">READY → detect 5 ngón / nút chụp → countdown → lưu ảnh gốc</p>
      </div>

      <div className="relative w-full max-w-4xl h-[56vh] sm:h-[62vh] bg-[#1A1A1A] shadow-lg overflow-hidden flex items-center justify-center my-auto rounded-[2rem]">
        {cameraSettings.mode === 'webcam' ? (
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover -scale-x-100" />
        ) : (
          <div className="w-full h-full relative bg-[#1A1A1A] text-[#FDFCFB] flex flex-col items-center justify-center">
            <Camera className="w-16 h-16 text-[#FDFCFB]/30 animate-pulse" />
          </div>
        )}

        <CanonViewfinderHUD showGrid={false} isCapturing={captureStep === 'capturing' || captureStep === 'saving'} />

        {captureStep === 'ready' && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-6 bg-[#1A1A1A]/18 text-[#FDFCFB]">
            <div className="rounded-full border border-white/25 bg-black/20 px-7 py-4 text-center backdrop-blur-sm">
              <Hand className="mx-auto mb-2 h-10 w-10 text-[#E6C687]" />
              <p className="font-serif text-3xl italic text-white/88">Ready</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.24em] text-white/62">{gestureCopy}</p>
            </div>
          </div>
        )}

        {captureStep === 'countdown' && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#1A1A1A]/18">
            <motion.div key={countdown} initial={{ scale: 1.15, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.25 }} className="flex h-44 w-44 items-center justify-center rounded-full border border-white/25 bg-transparent font-serif text-9xl text-white/62 shadow-[0_0_60px_rgba(255,255,255,0.12)] backdrop-blur-[1px]">
              {countdown}
            </motion.div>
          </div>
        )}

        {(captureStep === 'saving' || captureStep === 'between') && (
          <div className="absolute inset-x-0 bottom-8 z-20 text-center font-mono text-[11px] uppercase tracking-[0.25em] text-white/60">
            {captureStep === 'saving' ? 'Đang lưu ảnh gốc...' : 'Chuẩn bị shot tiếp theo...'}
          </div>
        )}
      </div>

      <div className="z-10 w-full max-w-4xl flex flex-col gap-3">
        <div className="flex items-center justify-center">
          <button
            type="button"
            disabled={captureStep !== 'ready'}
            onClick={() => void triggerCaptureSequence('button')}
            className="h-14 min-w-60 rounded-full bg-[#1A1A1A] px-8 text-xs font-bold uppercase tracking-[0.24em] text-[#FDFCFB] shadow-xl transition hover:bg-[#333333] disabled:cursor-not-allowed disabled:bg-[#D8D4CC] disabled:text-[#8C8880]"
          >
            <MousePointer2 className="mr-2 inline h-4 w-4" />
            CHỤP
          </button>
        </div>
        <div className="flex items-center justify-between gap-3 py-2.5 px-6 bg-[#F4F2EE] border border-[#1A1A1A]/15">
          <span className="text-[10px] font-mono font-bold tracking-widest uppercase opacity-60">GALLERY ({capturedPool.length}/{totalShots})</span>
          <div className="flex items-center gap-2 overflow-x-auto py-0.5">
            {Array.from({ length: totalShots }).map((_, idx) => {
              const photo = capturedPool[idx];
              return <div key={idx} className={`w-14 h-10 sm:w-16 sm:h-11 border flex items-center justify-center overflow-hidden transition-all ${photo ? 'border-[#1A1A1A] bg-[#FDFCFB]' : idx === currentShot ? 'border-[#1A1A1A] bg-[#E8E6E1] animate-pulse' : 'border-[#1A1A1A]/15 bg-[#FDFCFB]/50 text-[#1A1A1A]/30'}`}>{photo ? <img src={photo.dataUrl} alt={`Captured ${idx + 1}`} className="w-full h-full object-cover" /> : <span className="text-[10px] font-mono font-bold">#{idx + 1}</span>}</div>;
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
