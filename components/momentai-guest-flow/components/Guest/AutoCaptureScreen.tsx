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

interface WindowMiniMediaBridge {
  startShotClip(sessionId: string, shotIndex: number, countdownStartedAt?: string): Promise<unknown>;
  pushDeviceFrame(sessionId: string, shotIndex: number, bufferData: Uint8Array, width?: number, height?: number): Promise<unknown>;
  markShutter(sessionId: string, shotIndex: number, shutterAt?: string): Promise<unknown>;
  stopShotClip(sessionId: string, shotIndex: number, persistedAt?: string, options?: { fallbackDataUrl?: string }): Promise<unknown>;
  failShotClip(sessionId: string, shotIndex: number, error: string): Promise<unknown>;
  getClips(sessionId: string): Promise<unknown>;
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
  const [isCanonEvfActive, setIsCanonEvfActive] = useState<boolean>(false);
  const [canonStatusText, setCanonStatusText] = useState<string>('Đang mở Live View...');

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as unknown as { momentai?: { guest?: { camera?: { status?: () => Promise<{ state?: string; hardwareStatus?: string; provider?: string }> } } } }).momentai?.guest?.camera?.status) {
      const interval = setInterval(async () => {
        try {
          const st = await (window as unknown as { momentai: { guest: { camera: { status: () => Promise<any> } } } }).momentai.guest.camera.status();
          const state = st?.value?.state || st?.state;
          if (state === 'STARTING_LIVEVIEW') setCanonStatusText('Đang mở Live View...');
          else if (state === 'LIVEVIEW_STALLED') setCanonStatusText('Live View tạm dừng — đang khôi phục...');
          else if (state === 'LIVEVIEW_RECOVERING') setCanonStatusText('Đang khôi phục Live View...');
          else if (state === 'RECOVERING') setCanonStatusText('Đang kết nối lại Canon EOS 6D...');
          else if (state === 'DISCONNECTED' || state === 'ERROR') setCanonStatusText('Mất kết nối máy ảnh Canon EOS 6D...');
          else setCanonStatusText('Đang mở Live View...');
        } catch {}
      }, 1500);
      return () => clearInterval(interval);
    }
  }, []);
  const [canonEvfReady, setCanonEvfReady] = useState<boolean>(false);
  const [webcamReady, setWebcamReady] = useState<boolean>(cameraSettings.mode === 'webcam');
  const previewReady = cameraSettings.mode === 'canon' ? canonEvfReady : webcamReady;
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isCapturingRef = useRef(false);
  const gestureLockedRef = useRef(false);
  const completionNotifiedRef = useRef(false);
  const totalShots = session.captureCount || 4;
  const gestureEnabled = previewReady && captureStep === 'ready';
  const gestureSourceRef = cameraSettings.mode === 'canon' ? canvasRef : videoRef;
  const gesture = useGestureRecognizer(gestureSourceRef, gestureEnabled);

  useEffect(() => {
    let cancelled = false;
    let unsubscribeEvf: (() => void) | undefined;
    const img = new Image();

    img.onload = () => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (canvas && img.naturalWidth > 0 && img.naturalHeight > 0) {
        if (canvas.width !== img.naturalWidth || canvas.height !== img.naturalHeight) {
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
        }
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          setIsCanonEvfActive(true);
          setCanonEvfReady(true);
        }
      }
    };

    img.onerror = (err) => {
      console.warn('[AutoCaptureScreen] EVF image decode error:', err);
    };

    if (typeof window !== 'undefined' && (window as unknown as { momentai?: { guest?: { camera?: { onEvfFrame?: (cb: (frame: { dataUrl: string }) => void) => () => void } } } }).momentai?.guest?.camera?.onEvfFrame) {
      const cam = (window as unknown as { momentai: { guest: { camera: { onEvfFrame: (cb: (frame: { dataUrl: string }) => void) => () => void } } } }).momentai.guest.camera;
      unsubscribeEvf = cam.onEvfFrame((frame) => {
        if (!cancelled && frame?.dataUrl) {
          img.src = frame.dataUrl;
        }
      });
    }

    void cameraService.startWebcam().then((started) => {
      if (cancelled) return;
      const currentMode = cameraService.getSettings().mode;
      if (currentMode !== 'canon' && videoRef.current) {
        cameraService.attachToVideo(videoRef.current);
      }
      setWebcamReady(started || currentMode === 'webcam');
    });

    return () => {
      cancelled = true;
      if (unsubscribeEvf) unsubscribeEvf();
      // Keep physical LiveView alive in background across normal Guest screens
    };
  }, []);

  const markVideoReady = () => {
    const video = videoRef.current;
    setWebcamReady(Boolean(video && video.readyState >= HTMLMediaElement.HAVE_METADATA && video.videoWidth > 0 && video.videoHeight > 0));
  };

  const [captureErrorMessage, setCaptureErrorMessage] = useState<string | null>(null);

  const triggerCaptureSequence = async (_source: 'button' | 'gesture') => {
    if (isCapturingRef.current || captureStep !== 'ready') return;
    isCapturingRef.current = true;
    setCaptureErrorMessage(null);

    const completedPhotos: PhotoItem[] = [...capturedPool];

    try {
      for (let shot = currentShot; shot < totalShots; shot += 1) {
        setCurrentShot(shot);
        setCaptureStep('countdown');

        // 1. COUNTDOWN_STARTED(shot) -> Start recording clip[shot]
        const countdownStartIso = new Date().toISOString();
        await getDesktopMediaBridge()?.startShotClip(session.sessionId, shot, countdownStartIso).catch(() => null);

        // Start fallback frame pumping if in webcam/device mode
        let fallbackPumpInterval: NodeJS.Timeout | null = null;
        if (cameraSettings.mode === 'webcam' && videoRef.current) {
          const vid = videoRef.current;
          const c = document.createElement('canvas');
          c.width = vid.videoWidth || 1280;
          c.height = vid.videoHeight || 720;
          const ctx = c.getContext('2d');
          if (ctx) {
            fallbackPumpInterval = setInterval(() => {
              if (vid.readyState >= 2) {
                ctx.drawImage(vid, 0, 0, c.width, c.height);
                c.toBlob((blob) => {
                  if (blob) {
                    blob.arrayBuffer().then((buf) => {
                      void getDesktopMediaBridge()?.pushDeviceFrame(session.sessionId, shot, new Uint8Array(buf), c.width, c.height);
                    }).catch(() => null);
                  }
                }, 'image/jpeg', 0.85);
              }
            }, 66);
          }
        }

        for (let value = captureConfig.countdownSeconds || 3; value > 0; value -= 1) {
          setCountdown(value);
          if (value === (captureConfig.countdownSeconds || 3)) {
            // Trigger autofocus once at approximately T-3s before physical shot
            void cameraService.autofocus(session.sessionId, shot + 1);
          }
          cameraService.playBeepSound(800 + (4 - value) * 100, 120);
          await wait(1000);
        }

        // 2. SHUTTER_TRIGGERED(shot) -> Mark shutter timestamp (recording continues)
        setCaptureStep('capturing');
        const shutterIso = new Date().toISOString();
        await getDesktopMediaBridge()?.markShutter(session.sessionId, shot, shutterIso).catch(() => null);

        setIsFlashing(true);
        await wait(180);
        setIsFlashing(false);

        // 3. Still photo capture continues
        setCaptureStep('saving');
        const shotIndex = shot + 1;

        let dataUrl: string;
        try {
          dataUrl = await cameraService.capturePhoto(shot, session.sessionId);
        } catch (err) {
          if (fallbackPumpInterval) clearInterval(fallbackPumpInterval);
          await getDesktopMediaBridge()?.failShotClip(session.sessionId, shot, err instanceof Error ? err.message : 'CAPTURE_FAILED').catch(() => null);
          throw err;
        }

        if (fallbackPumpInterval) {
          clearInterval(fallbackPumpInterval);
          fallbackPumpInterval = null;
        }

        // Persist original photo to storage
        if (typeof window !== 'undefined' && (window as unknown as { momentai?: { guest?: { storage?: { saveOriginal: (sid: string, idx: number, photo: unknown) => Promise<unknown> } } } }).momentai?.guest?.storage?.saveOriginal) {
          await (window as unknown as { momentai: { guest: { storage: { saveOriginal: (sid: string, idx: number, photo: unknown) => Promise<unknown> } } } }).momentai.guest.storage.saveOriginal(session.sessionId, shotIndex, {
            dataUrl,
            mimeType: 'image/jpeg',
          }).catch(() => null);
        }

        // 4. CAPTURED_PHOTO_PERSISTED(shot) -> Stop and finalize clip[shot]
        const persistedIso = new Date().toISOString();
        const clipOptions = cameraSettings.mode === 'canon' ? undefined : { fallbackDataUrl: dataUrl };
        await getDesktopMediaBridge()?.stopShotClip(session.sessionId, shot, persistedIso, clipOptions).catch(() => null);

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

      setCapturedPool(completedPhotos);
      setCaptureStep('complete');
      if (!completionNotifiedRef.current) {
        completionNotifiedRef.current = true;
        onCaptureCompleted(completedPhotos);
      }
    } catch (err) {
      console.error('[AutoCaptureScreen] Capture failed at shot', currentShot + 1, err);
      setCaptureErrorMessage('Không thể chụp ảnh. Đang khôi phục camera...');
      setCaptureStep('ready');
    } finally {
      isCapturingRef.current = false;
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

  const gestureCopy = !previewReady
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
          <canvas ref={canvasRef} className={`w-full h-full object-cover ${isCanonEvfActive ? 'block' : 'hidden'}`} />
          {!isCanonEvfActive && ((cameraSettings.mode === 'canon' || cameraService.getSettings().mode === 'canon') ? (
            <div className="w-full h-full relative bg-[#1A1A1A] text-[#FDFCFB] flex flex-col items-center justify-center gap-3 select-none">
              <Camera className="w-16 h-16 text-[#E6C687] animate-pulse" />
              <span className="font-mono text-sm font-bold tracking-wider text-[#E6C687]/90">
                {canonStatusText}
              </span>
              <span className="font-mono text-xs text-white/50 text-center max-w-md px-4">
                Canon EDSDK session đang mở. Vui lòng giữ cáp USB và bật nguồn máy ảnh (Chế độ chụp M / Av / Tv / P).
              </span>
            </div>
          ) : cameraSettings.mode === 'webcam' ? (
            <video ref={videoRef} autoPlay playsInline muted onLoadedMetadata={markVideoReady} onCanPlay={markVideoReady} className="w-full h-full object-cover -scale-x-100" />
          ) : (
            <div className="w-full h-full relative bg-[#1A1A1A] text-[#FDFCFB] flex flex-col items-center justify-center">
              <Camera className="w-20 h-20 text-[#FDFCFB]/30 animate-pulse" />
            </div>
          ))}

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

          {captureErrorMessage && captureStep === 'ready' && (
            <div className="absolute top-20 inset-x-0 z-20 flex justify-center pointer-events-none">
              <div className="bg-red-950/90 text-white border border-red-500/40 px-6 py-2 rounded-full font-mono text-xs font-bold tracking-wider shadow-xl animate-pulse">
                ⚠️ {captureErrorMessage}
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

function getDesktopMediaBridge(): WindowMiniMediaBridge | null {
  if (typeof window === 'undefined') return null;
  return (window.momentai?.guest?.media as WindowMiniMediaBridge | undefined) ?? null;
}

