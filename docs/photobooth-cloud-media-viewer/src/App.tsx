import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Download,
  Image as ImageIcon,
  Film,
  Maximize2,
  Clock,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Smartphone,
  CheckCircle2,
  Loader2,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { AnimatedBackground } from './components/AnimatedBackground';
import { LightboxModal } from './components/LightboxModal';
import { RawPhotosGallery } from './components/RawPhotosGallery';
import { SAMPLE_SESSIONS } from './data/sampleSessions';
import { PhotoboothSession } from './types';
import { saveToAlbumDirect, saveBothDirectToAlbum } from './utils/downloadHelpers';
import { firebaseConfig, fetchSessionViaRest } from './firebase/config';

type CloudState =
  | 'IDLE'
  | 'LOADING'
  | 'CREATED'
  | 'UPLOADING_ORIGINALS'
  | 'ORIGINALS_READY'
  | 'COMPOSING_FINAL'
  | 'UPLOADING_FINAL'
  | 'READY'
  | 'PARTIAL'
  | 'COMPOSE_FAILED'
  | 'UPLOAD_FAILED'
  | 'NOT_FOUND'
  | 'ERROR';

export default function App() {
  const [session, setSession] = useState<PhotoboothSession | null>(null);
  const [cloudState, setCloudState] = useState<CloudState>('LOADING');
  const [resolvedToken, setResolvedToken] = useState<string>('');

  // Video playback
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);

  // Download states (direct album saves - NO ZIP)
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [savingVideo, setSavingVideo] = useState(false);
  const [savingBoth, setSavingBoth] = useState(false);

  // Lightbox
  const [lightboxState, setLightboxState] = useState<{
    isOpen: boolean;
    url: string;
    title: string;
    type: 'image' | 'video';
  }>({
    isOpen: false,
    url: '',
    title: '',
    type: 'image'
  });

  // Countdown timer
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number; isExpired: boolean }>({
    hours: 48,
    minutes: 0,
    seconds: 0,
    isExpired: false
  });

  // Toast feedback
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // 1. Extract Public Token & Subscribe to Real Session Data
  useEffect(() => {
    let isMounted = true;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    const resolveToken = () => {
      // 1. Match from pathname: /s/:publicToken or /session/:publicToken
      const pathMatch = window.location.pathname.match(/\/(?:s|session)\/([a-zA-Z0-9_-]+)/i);
      if (pathMatch?.[1]) return pathMatch[1];

      // 2. Match from query parameters: ?token=... or ?session=...
      const params = new URLSearchParams(window.location.search);
      return params.get('token') || params.get('publicToken') || params.get('session') || params.get('id') || params.get('code') || '';
    };

    const token = resolveToken();
    setResolvedToken(token);

    const querySession = async () => {
      if (!token) {
        // If no token in URL, check sample/demo mode
        setSession(SAMPLE_SESSIONS[0]);
        setCloudState('READY');
        return;
      }

      try {
        const projectId = firebaseConfig.projectId;
        if (projectId) {
          // Real Firebase Firestore query
          const cloudDoc = await fetchSessionViaRest(projectId, token, firebaseConfig.apiKey);
          if (!isMounted) return;

          if (cloudDoc) {
            const status = String(cloudDoc.status || '').toUpperCase() as CloudState;
            const isImageReady = cloudDoc.finalImage?.status === 'READY' || Boolean(cloudDoc.finalImage?.url);
            const isVideoReady = cloudDoc.finalVideo?.status === 'READY' || Boolean(cloudDoc.finalVideo?.url);

            if (isImageReady || isVideoReady || status === 'READY') {
              const codeDisplay = token.slice(0, 6).toUpperCase();
              const formattedSession: PhotoboothSession = {
                id: token,
                code: codeDisplay,
                boothName: cloudDoc.boothName || 'TIỆM ẢNH DI SẢN • MOMENTAI',
                location: 'MomentAI Cloud Storage',
                createdAt: cloudDoc.createdAt || new Date().toISOString(),
                expiresAt: new Date(new Date(cloudDoc.createdAt || Date.now()).getTime() + 48 * 60 * 60 * 1000).toISOString(),
                stripMedia: isImageReady ? {
                  id: `strip-${token}`,
                  url: cloudDoc.finalImage?.url || '',
                  name: `MomentAI-${codeDisplay}-photo.jpg`,
                  type: 'image',
                  width: cloudDoc.finalImage?.width || 1800,
                  height: cloudDoc.finalImage?.height || 2700,
                } : {
                  id: `strip-${token}`,
                  url: '',
                  name: `MomentAI-${codeDisplay}-photo.jpg`,
                  type: 'image',
                },
                videoMedia: isVideoReady ? {
                  id: `video-${token}`,
                  url: cloudDoc.finalVideo?.url || '',
                  name: `MomentAI-${codeDisplay}-video.mp4`,
                  type: 'video',
                  width: cloudDoc.finalVideo?.width || 1800,
                  height: cloudDoc.finalVideo?.height || 2700,
                } : undefined,
                rawPhotos: (cloudDoc.rawPhotos || []).map((p, idx) => ({
                  id: `raw-${token}-${p.shotIndex || idx + 1}`,
                  url: p.url,
                  name: p.name || `Shot_${p.shotIndex || idx + 1}_${codeDisplay}.jpg`,
                  type: 'image' as const,
                })),
              };

              setSession(formattedSession);
              setCloudState(status === 'READY' ? 'READY' : isImageReady ? 'PARTIAL' : status);

              // If video is still processing, keep polling in background for video readiness
              if (!isVideoReady && status !== 'READY') {
                pollTimer = setTimeout(querySession, 2000);
              }
              return;
            } else {
              // Document exists but still processing initial uploads
              setCloudState(status || 'UPLOADING_ORIGINALS');
              pollTimer = setTimeout(querySession, 2000);
              return;
            }
          } else {
            // Not found in Firestore, poll up to a few times in case upload is just starting
            setCloudState('NOT_FOUND');
          }
        } else {
          // If Firebase project ID not configured, fallback to local demo / sample
          setSession(SAMPLE_SESSIONS[0]);
          setCloudState('READY');
        }
      } catch (err) {
        console.warn('Session query error:', err);
        setCloudState('ERROR');
      }
    };

    void querySession();

    return () => {
      isMounted = false;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, []);

  // 2. Countdown calculation
  useEffect(() => {
    const calculateTime = () => {
      if (!session?.expiresAt) return;
      const diff = new Date(session.expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0, isExpired: true });
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft({ hours, minutes, seconds, isExpired: false });
      }
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [session]);

  // Video controls
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  // Direct Album Save Handlers (No ZIP!)
  const handleSavePhoto = async () => {
    if (!session?.stripMedia?.url) return;
    setSavingPhoto(true);
    const result = await saveToAlbumDirect(
      session.stripMedia.url,
      session.stripMedia.name || `Photobooth_Photo_${session.code}.jpg`,
      'image/jpeg'
    );
    setSavingPhoto(false);
    showToast(result === 'shared' ? '📱 Đã mở bảng lưu vào Album ảnh!' : '✓ Đã lưu ảnh vào thiết bị!');
  };

  const handleSaveVideo = async () => {
    if (!session?.videoMedia?.url) return;
    setSavingVideo(true);
    const result = await saveToAlbumDirect(
      session.videoMedia.url,
      session.videoMedia.name || `Photobooth_Video_${session.code}.mp4`,
      'video/mp4'
    );
    setSavingVideo(false);
    showToast(result === 'shared' ? '📱 Đã mở bảng lưu vào Album video!' : '✓ Đã lưu video vào thiết bị!');
  };

  const handleSaveBoth = async () => {
    if (!session?.stripMedia?.url) return;
    setSavingBoth(true);
    const res = await saveBothDirectToAlbum(
      session.stripMedia.url,
      session.videoMedia?.url,
      session.code || '8821'
    );
    setSavingBoth(false);
    showToast(
      res.method === 'native-share'
        ? '📱 Đã mở menu lưu trọn bộ vào Album điện thoại!'
        : '✓ Đã tải thẳng ảnh & video về Album (không dùng ZIP)!'
    );
  };

  const getProcessingMessage = (state: CloudState) => {
    switch (state) {
      case 'UPLOADING_ORIGINALS':
        return 'Đang tải ảnh chụp lên Cloud an toàn...';
      case 'ORIGINALS_READY':
        return 'Ảnh gốc đã tải lên, đang ghép khung & tạo video...';
      case 'COMPOSING_FINAL':
        return 'Đang xử lý khung ảnh và video boomerang HD...';
      case 'UPLOADING_FINAL':
        return 'Đang hoàn tất tải lên ảnh và video...';
      case 'PARTIAL':
        return 'Ảnh đã sẵn sàng, video đang tiếp tục xử lý...';
      default:
        return 'Ảnh và video của bạn đang được chuẩn bị...';
    }
  };

  return (
    <div className="relative min-h-screen text-white font-sans selection:bg-pink-400 selection:text-white flex flex-col justify-between overflow-x-hidden">
      
      {/* 🌸 Cotton Candy Sky Background */}
      <AnimatedBackground />

      {/* Main Content Area */}
      <div className="relative z-10 w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10 flex-1 flex flex-col items-center justify-center gap-6 sm:gap-8">

        {/* 1. BRAND HEADER */}
        <motion.header
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="w-full text-center space-y-3 flex flex-col items-center"
        >
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-pink-100 via-white to-pink-200 bg-clip-text text-transparent drop-shadow-sm">
            {session?.boothName || 'TIỆM ẢNH DI SẢN • MOMENTAI'}
          </h1>

          {session && (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/45 border border-pink-300/20 backdrop-blur-xl shadow-lg">
              <Clock className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span className="text-xs text-pink-100/80 font-medium">Hạn lưu trữ:</span>
              {timeLeft.isExpired ? (
                <span className="text-xs font-mono font-bold text-rose-400">Đã hết hạn</span>
              ) : (
                <div className="flex items-center gap-1 font-mono font-bold text-xs text-amber-300">
                  <span className="bg-white/10 px-1.5 py-0.5 rounded">{String(timeLeft.hours).padStart(2, '0')}h</span>
                  <span>:</span>
                  <span className="bg-white/10 px-1.5 py-0.5 rounded">{String(timeLeft.minutes).padStart(2, '0')}m</span>
                  <span>:</span>
                  <span className="bg-white/10 px-1.5 py-0.5 rounded">{String(timeLeft.seconds).padStart(2, '0')}s</span>
                </div>
              )}
            </div>
          )}
        </motion.header>

        {/* 2. CONDITIONAL STATE RENDERING */}
        {cloudState !== 'READY' && cloudState !== 'NOT_FOUND' && cloudState !== 'ERROR' ? (
          /* PROCESSING STATE UI */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md p-8 rounded-3xl bg-black/40 border border-pink-200/20 backdrop-blur-xl flex flex-col items-center text-center gap-5 shadow-2xl"
          >
            <div className="w-16 h-16 rounded-full bg-pink-500/20 border border-pink-400/30 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-pink-300 animate-spin" />
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-bold text-pink-100">
                {getProcessingMessage(cloudState)}
              </h2>
              <p className="text-xs text-white/70 leading-relaxed">
                Trang sẽ tự động hiển thị ảnh và video ngay khi máy photobooth xử lý xong. Quý khách không cần bấm tải lại trang.
              </p>
            </div>

            <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-pink-400 to-rose-400 rounded-full animate-pulse w-3/4" />
            </div>
          </motion.div>
        ) : cloudState === 'NOT_FOUND' ? (
          /* NOT FOUND UI */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md p-8 rounded-3xl bg-black/40 border border-rose-400/20 backdrop-blur-xl flex flex-col items-center text-center gap-4 shadow-2xl"
          >
            <AlertCircle className="w-12 h-12 text-rose-400" />
            <h2 className="text-lg font-bold text-rose-200">Không tìm thấy phiên chụp</h2>
            <p className="text-xs text-white/70 leading-relaxed">
              Mã phiên chụp không tồn tại hoặc đã hết hạn lưu trữ. Vui lòng quét lại mã QR trên màn hình Photobooth.
            </p>
          </motion.div>
        ) : session ? (
          /* READY STATE UI */
          <>
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
              className="w-full grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 items-stretch"
            >
              {/* ===================== HÌNH ẢNH + NÚT TẢI ẢNH ===================== */}
              <div className="flex flex-col items-center bg-black/35 border border-pink-200/15 backdrop-blur-xl rounded-3xl p-4 sm:p-5 shadow-2xl hover:border-pink-300/30 transition-all">
                
                <div className="w-full flex items-center justify-between pb-3 mb-3 border-b border-white/10 text-xs font-semibold text-pink-100">
                  <span className="flex items-center gap-1.5 text-pink-300">
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>1. Hình Ảnh (HD)</span>
                  </span>
                  <span className="font-mono text-[10px] text-white/50">GỐC</span>
                </div>

                {/* Khung Ảnh */}
                <div 
                  onClick={() => session.stripMedia?.url && setLightboxState({ isOpen: true, url: session.stripMedia.url, title: 'Ảnh Photobooth HD', type: 'image' })}
                  className="relative w-full aspect-3/4 max-h-[380px] rounded-2xl overflow-hidden bg-black/50 cursor-pointer group flex items-center justify-center"
                >
                  {session.stripMedia?.url ? (
                    <>
                      <img
                        src={session.stripMedia.url}
                        alt="Photobooth"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover rounded-2xl transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="px-3 py-1.5 rounded-full bg-black/70 backdrop-blur-md text-white text-xs font-medium flex items-center gap-1.5 border border-white/20">
                          <Maximize2 className="w-3 h-3" />
                          <span>Xem HD</span>
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="text-white/40 text-xs">Đang tải ảnh...</div>
                  )}
                </div>

                {/* NÚT TẢI ẢNH VỀ ALBUM */}
                <button
                  onClick={handleSavePhoto}
                  disabled={savingPhoto || !session.stripMedia?.url}
                  className="mt-4 w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-pink-500/80 to-rose-500/80 hover:from-pink-500 hover:to-rose-500 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-pink-500/20 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
                >
                  <Download className={`w-4 h-4 ${savingPhoto ? 'animate-bounce' : ''}`} />
                  <span>{savingPhoto ? 'Đang lưu ảnh...' : 'Tải Ảnh Về Album'}</span>
                </button>
              </div>

              {/* ===================== VIDEO + NÚT TẢI VIDEO ===================== */}
              <div className="flex flex-col items-center bg-black/35 border border-pink-200/15 backdrop-blur-xl rounded-3xl p-4 sm:p-5 shadow-2xl hover:border-pink-300/30 transition-all">
                
                <div className="w-full flex items-center justify-between pb-3 mb-3 border-b border-white/10 text-xs font-semibold text-pink-100">
                  <span className="flex items-center gap-1.5 text-purple-300">
                    <Film className="w-3.5 h-3.5" />
                    <span>2. Video (MP4)</span>
                  </span>
                  <span className="font-mono text-[10px] text-white/50">BOOMERANG</span>
                </div>

                {/* Khung Video */}
                <div className="relative w-full aspect-3/4 max-h-[380px] rounded-2xl overflow-hidden bg-black/50 flex items-center justify-center group">
                  {session.videoMedia?.url ? (
                    <>
                      <video
                        ref={videoRef}
                        src={session.videoMedia.url}
                        playsInline
                        preload="metadata"
                        loop
                        muted={isMuted}
                        className="w-full h-full object-cover rounded-2xl cursor-pointer"
                        onClick={togglePlay}
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                      />

                      {!isPlaying && (
                        <div 
                          onClick={togglePlay}
                          className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center cursor-pointer"
                        >
                          <div className="w-12 h-12 rounded-full bg-white/25 border border-white/30 backdrop-blur-md flex items-center justify-center text-white shadow-xl">
                            <Play className="w-5 h-5 fill-white translate-x-0.5" />
                          </div>
                        </div>
                      )}

                      <div className="absolute bottom-2.5 inset-x-2.5 flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/15 text-white/90">
                        <div className="flex items-center gap-2">
                          <button onClick={togglePlay} className="p-1 hover:text-white cursor-pointer">
                            {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 fill-white" />}
                          </button>
                          <button onClick={toggleMute} className="p-1 hover:text-white cursor-pointer">
                            {isMuted ? <VolumeX className="w-3 h-3 text-white/50" /> : <Volume2 className="w-3 h-3 text-white" />}
                          </button>
                        </div>

                        <button 
                          onClick={() => session.videoMedia?.url && setLightboxState({ isOpen: true, url: session.videoMedia.url, title: 'Video Photobooth MP4', type: 'video' })}
                          className="p-1 hover:text-white cursor-pointer"
                          title="Toàn màn hình"
                        >
                          <Maximize2 className="w-3 h-3" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
                      <div className="w-10 h-10 rounded-full bg-purple-500/20 border border-purple-400/30 flex items-center justify-center">
                        <Loader2 className="w-5 h-5 text-purple-300 animate-spin" />
                      </div>
                      <div className="text-xs text-purple-200 font-medium">Video đang được xử lý...</div>
                      <div className="text-[10px] text-white/50">Tự động hiển thị khi hoàn thành</div>
                    </div>
                  )}
                </div>

                {/* NÚT TẢI VIDEO VỀ ALBUM */}
                <button
                  onClick={handleSaveVideo}
                  disabled={savingVideo || !session.videoMedia?.url}
                  className="mt-4 w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-purple-500/80 to-indigo-500/80 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
                >
                  <Download className={`w-4 h-4 ${savingVideo ? 'animate-bounce' : ''}`} />
                  <span>{savingVideo ? 'Đang lưu video...' : 'Tải Video Về Album'}</span>
                </button>
              </div>

            </motion.div>

            {/* 3. NÚT TẢI CẢ HAI (THẲNG VÀO ALBUM - KHÔNG DÙNG ZIP) */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
              className="w-full max-w-md flex flex-col items-center gap-2.5"
            >
              <button
                onClick={handleSaveBoth}
                disabled={savingBoth || !session.stripMedia?.url}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-purple-600 hover:from-pink-600 hover:via-rose-600 hover:to-purple-700 text-white font-extrabold text-xs sm:text-sm uppercase tracking-wider shadow-xl shadow-pink-500/30 flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
              >
                <Smartphone className={`w-4 h-4 ${savingBoth ? 'animate-bounce' : ''}`} />
                <span>
                  {savingBoth ? 'Đang lưu cả 2 vào Album...' : 'LƯU CẢ HAI VÀO ALBUM (ẢNH & VIDEO)'}
                </span>
              </button>
            </motion.div>

            {/* 4. BỘ SƯU TẬP ẢNH ĐƠN GỐC (RAW PHOTOS) NẾU CÓ */}
            {session.rawPhotos && session.rawPhotos.length > 0 && (
              <div className="w-full mt-8 pt-8 border-t border-white/10">
                <RawPhotosGallery
                  session={session}
                  onOpenLightbox={(url, title) => setLightboxState({ isOpen: true, url, title, type: 'image' })}
                  lang="vi"
                />
              </div>
            )}
          </>
        ) : null}

      </div>

      {/* Clean Minimalist Footer */}
      <footer className="relative z-10 py-5 text-center text-[11px] text-white/50 font-mono">
        {session?.boothName || 'MomentAI'} • Photobooth Cloud
      </footer>

      {/* Lightbox Modal for HD inspection */}
      <LightboxModal
        isOpen={lightboxState.isOpen}
        onClose={() => setLightboxState((prev) => ({ ...prev, isOpen: false }))}
        url={lightboxState.url}
        title={lightboxState.title}
        type={lightboxState.type}
      />

      {/* Toast Feedback */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl bg-black/85 backdrop-blur-xl border border-pink-300/30 text-white text-xs font-semibold shadow-2xl flex items-center gap-2.5 max-w-[90vw] text-center"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
