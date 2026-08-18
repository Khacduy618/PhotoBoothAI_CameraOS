import React, { useEffect, useRef, useState } from 'react';
import { CameraSettings, PhotoItem, SessionData, CaptureConfig } from '../../types';
import { cameraService } from '../../services/cameraService';
import { CanonViewfinderHUD } from '../UI/CanonViewfinderHUD';
import { Camera, Hand, MousePointer2, Check } from 'lucide-react';
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

interface WindowMiniCameraBridge {
  capture(context: { sessionId: string; shotIndex: number; correlationId: string }): Promise<unknown>;
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
  const [captureStep, setCaptureStep] = useState<CaptureStep>('ready');
  const [isFlashing, setIsFlashing] = useState<boolean>(false);
  const [capturedPool, setCapturedPool] = useState<PhotoItem[]>([]);
  const [videoReady, setVideoReady] = useState<boolean>(cameraSettings.mode === 'webcam');
  const videoRef = useRef<HTMLVideoElement>(null);
  const isCapturingRef = useRef(false);
  const gestureLockedRef = useRef(false);
  const completionNotifiedRef = useRef(false);
  const totalShots = session.captureCount || 4;
  const gestureEnabled = videoReady && captureStep === 'ready';
  const gesture = useGestureRecognizer(videoRef, gestureEnabled);

  useEffect(() => {
    let cancelled = false;
    void cameraService.startWebcam().then((started) => {
      if (cancelled) return;
      if (videoRef.current) cameraService.attachToVideo(videoRef.current);
      setVideoReady(started || cameraService.getSettings().mode === 'webcam');
    });
    return () => {
      cancelled = true;
      cameraService.stopWebcam();
    };
  }, []);

  const markVideoReady = () => {
    const video = videoRef.current;
    setVideoReady(Boolean(video && video.readyState >= HTMLMediaElement.HAVE_METADATA && video.videoWidth > 0 && video.videoHeight > 0));
  };

  const triggerCaptureSequence = async (_source: 'button' | 'gesture') => {
    if (isCapturingRef.current || captureStep !== 'ready') return;
    isCapturingRef.current = true;

    // Start recording session movie clip
    await cameraService.startSessionRecording(session.sessionId);

    const completedPhotos: PhotoItem[] = [];

    for (let shot = currentShot; shot < totalShots; shot += 1) {
      setCurrentShot(shot);
      setCaptureStep('countdown');
      for (let value = captureConfig.countdownSeconds || 3; value > 0; value -= 1) {
        setCountdown(value);
        if (value === 1) {
          await cameraService.autofocus(session.sessionId);
        } else {
          cameraService.playBeepSound(800 + (4 - value) * 100, 120);
        }
        await wait(1000);
      }

      setCaptureStep('capturing');
      setIsFlashing(true);
      await wait(180);
      setIsFlashing(false);

      setCaptureStep('saving');
      const shotIndex = shot + 1;
      const correlationId = `${session.sessionId}_shot_${shotIndex}_${Date.now()}`;
      await getDesktopCameraBridge()?.capture({ sessionId: session.sessionId, shotIndex, correlationId }).catch(() => null);
      const dataUrl = await cameraService.capturePhoto(shot, session.sessionId);
      const imgDimensions = await new Promise<{ width: number; height: number }>((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth || 1920, height: img.naturalHeight || 1080 });
        img.onerror = () => resolve({ width: 1920, height: 1080 });
        img.src = dataUrl;
      });

      const newPhoto: PhotoItem = {
        id: `photo_${Date.now()}_${shot}`,
        index: shot + 1,
        dataUrl,
        width: imgDimensions.width,
        height: imgDimensions.height,
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

    // Stop recording session movie clip
    await cameraService.stopSessionRecording(session.sessionId);

    setCapturedPool(completedPhotos);
    setCaptureStep('complete');
    if (!completionNotifiedRef.current) {
      completionNotifiedRef.current = true;
      onCaptureCompleted(completedPhotos);
    }
  };

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

  useEffect(() => {
    if (capturedPool.length >= totalShots && captureStep === 'complete' && !completionNotifiedRef.current) {
      completionNotifiedRef.current = true;
      onCaptureCompleted(capturedPool.slice(0, totalShots));
    }
  }, [capturedPool, captureStep, onCaptureCompleted, totalShots]);

  const gestureCopy = !videoReady
    ? 'Đang chờ camera sẵn sàng'
    : gesture.isLoading
      ? 'Đang khởi tạo detect tay'
      : gesture.error
        ? `Detect tay chưa sẵn sàng - dùng nút CHỤP (${gesture.error})`
        : gesture.result.name === 'Open_Palm'
        ? `Đã thấy 5 ngón ${(gesture.result.confidence * 100).toFixed(0)}%`
        : 'Giơ 5 ngón tay để bắt đầu';

  return (
    <div className="relative w-full h-screen flex flex-col justify-between px-4 py-4 sm:px-8 sm:py-6 bg-[#FDFCFB] text-[#1A1A1A] select-none overflow-hidden">
      <AnimatePresence>
        {isFlashing && (
          <motion.div initial={{ opacity: 1 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="fixed inset-0 bg-white z-50 pointer-events-none" />
        )}
      </AnimatePresence>

      {/* Top Header */}
      <div className="z-10 w-full max-w-[98%] mx-auto text-center flex items-center justify-between border-b border-[#1A1A1A]/10 pb-3 mb-1">
        <h3 className="text-[#1A1A1A] font-serif text-2xl font-bold uppercase tracking-wider">
          ĐANG CHỤP ẢNH {Math.min(currentShot + 1, totalShots)} / {totalShots}
        </h3>
        <p className="text-xs font-mono uppercase tracking-[0.2em] opacity-60">
          READY → GIƠ 5 NGÓN TAY HOẶC BẤM NÚT CHỤP → CHỜ ẢNH LƯU
        </p>
      </div>

      {/* Side-by-Side Grid: 85% Left Camera Viewport (17/20), 15% Right Gallery Sidebar (3/20) */}
      <div className="w-full max-w-[98%] mx-auto flex-1 grid grid-cols-1 lg:grid-cols-20 gap-5 items-stretch overflow-hidden my-auto py-2">
        {/* Left Viewport Camera Live (85% width) */}
        <div className="lg:col-span-17 relative w-full h-[76vh] xl:h-[80vh] bg-[#1A1A1A] shadow-2xl overflow-hidden flex items-center justify-center rounded-xl border border-[#1A1A1A]/20">
          {cameraSettings.mode === 'webcam' ? (
            <video ref={videoRef} autoPlay playsInline muted onLoadedMetadata={markVideoReady} onCanPlay={markVideoReady} className="w-full h-full object-cover -scale-x-100" />
          ) : (
            <div className="w-full h-full relative bg-[#1A1A1A] text-[#FDFCFB] flex flex-col items-center justify-center">
              <Camera className="w-20 h-20 text-[#FDFCFB]/30 animate-pulse" />
            </div>
          )}

          <CanonViewfinderHUD showGrid={false} isCapturing={captureStep === 'capturing' || captureStep === 'saving'} />

          {captureStep === 'ready' && (
            <div className="absolute top-6 inset-x-0 z-20 flex justify-center pointer-events-none">
              <div className="flex items-center gap-3 bg-[#1A1A1A]/80 text-[#FDFCFB] px-6 py-2.5 rounded-full border border-white/20 shadow-xl backdrop-blur-md">
                <Hand className="h-5 w-5 text-[#E6C687] animate-bounce" />
                <span className="font-serif italic text-lg font-bold text-white/95">Ready</span>
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-white/80 border-l border-white/20 pl-3">
                  {gestureCopy}
                </span>
              </div>
            </div>
          )}

          {captureStep === 'countdown' && (
            <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
              <motion.div
                key={countdown}
                initial={{ scale: 1.25, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.2 }}
                className="flex h-44 w-44 items-center justify-center rounded-full border-4 border-white/90 bg-black/40 font-serif text-8xl font-black text-white shadow-[0_0_80px_rgba(0,0,0,0.5)]"
              >
                {countdown}
              </motion.div>
            </div>
          )}

          {(captureStep === 'saving' || captureStep === 'between') && (
            <div className="absolute inset-x-0 bottom-6 z-20 text-center font-mono text-xs uppercase tracking-[0.25em] text-white/90 font-bold bg-black/60 py-2 backdrop-blur-xs">
              {captureStep === 'saving' ? 'Đang lưu ảnh gốc...' : 'Chuẩn bị shot tiếp theo...'}
            </div>
          )}
        </div>

        {/* Right Gallery Sidebar (15% width) */}
        <div className="lg:col-span-3 w-full h-[76vh] xl:h-[80vh] bg-[#F4F2EE] border border-[#1A1A1A]/15 p-4 rounded-xl flex flex-col justify-start gap-4 overflow-y-auto shadow-sm">
          <div className="flex flex-col border-b border-[#1A1A1A]/10 pb-2">
            <span className="text-xs font-mono font-bold tracking-widest uppercase text-[#1A1A1A]">
              GALLERY ẢNH
            </span>
            <span className="text-[11px] font-mono text-[#1A1A1A]/70 font-semibold mt-0.5">
              ĐÃ CHỤP {capturedPool.length} / {totalShots} TẤM
            </span>
          </div>

          <div className="flex flex-col gap-3.5 overflow-y-auto flex-1 pr-1">
            {Array.from({ length: totalShots }).map((_, idx) => {
              const photo = capturedPool[idx];
              const isCurrent = idx === currentShot && captureStep !== 'ready' && captureStep !== 'complete';

              return (
                <div
                  key={idx}
                  className={`relative w-full aspect-[2/3] flex flex-col items-center justify-center overflow-hidden transition-all rounded-xs border-2 shadow-sm ${
                    photo
                      ? 'border-[#1A1A1A] bg-[#FDFCFB] ring-1 ring-[#1A1A1A]/30'
                      : isCurrent
                        ? 'border-amber-600 bg-amber-50 animate-pulse ring-2 ring-amber-500'
                        : 'border-dashed border-[#1A1A1A]/30 bg-white/60 text-[#1A1A1A]/40'
                  }`}
                >
                  {photo ? (
                    <>
                      <img src={photo.dataUrl} alt={`Captured ${idx + 1}`} className="w-full h-full object-cover" />
                      <div className="absolute top-1.5 right-1.5 grid h-6 w-6 place-items-center rounded-full bg-[#1A1A1A] text-[#FDFCFB] shadow-sm z-10">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                      <span className="absolute bottom-1.5 left-1.5 text-[9px] font-mono font-black bg-black/75 text-white px-1.5 py-0.5 rounded-2xs backdrop-blur-2xs">
                        #{idx + 1}
                      </span>
                    </>
                  ) : isCurrent ? (
                    <div className="flex flex-col items-center gap-1.5 text-amber-800">
                      <Camera className="w-6 h-6 animate-bounce" />
                      <span className="text-[10px] font-mono font-bold uppercase tracking-tighter">ĐANG CHỤP</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <Camera className="w-5 h-5 opacity-40" />
                      <span className="text-xs font-mono font-bold">#{idx + 1}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Control Section for Capture Action */}
      <div className="w-full max-w-[98%] mx-auto pt-2 border-t border-[#1A1A1A]/10 flex items-center justify-center">
        <button
          type="button"
          disabled={captureStep !== 'ready'}
          onClick={() => void triggerCaptureSequence('button')}
          className="h-14 min-w-80 rounded-full bg-[#1A1A1A] px-12 text-sm sm:text-base font-bold uppercase tracking-[0.25em] text-[#FDFCFB] shadow-2xl transition hover:bg-[#333333] border border-white/20 disabled:cursor-not-allowed disabled:bg-[#D8D4CC] disabled:text-[#8C8880] cursor-pointer flex items-center justify-center gap-3"
        >
          <MousePointer2 className="h-5 w-5" />
          <span>BẤM CHỤP ẢNH</span>
        </button>
      </div>
    </div>
  );
};

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function getDesktopCameraBridge(): WindowMiniCameraBridge | null {
  if (typeof window === 'undefined') return null;
  return (window.momentai?.guest?.camera as WindowMiniCameraBridge | undefined) ?? null;
}
