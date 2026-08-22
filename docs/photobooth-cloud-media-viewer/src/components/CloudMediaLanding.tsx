import React, { useState, useRef } from 'react';
import {
  Download,
  Image as ImageIcon,
  Film,
  Maximize2,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Share2,
  Smartphone,
  Check,
  Sparkles,
  Camera,
  RefreshCw,
  HelpCircle,
  ArrowDownToLine,
  CheckCircle2,
  ExternalLink,
  Layers,
  Copy
} from 'lucide-react';
import { PhotoboothSession, PhotoboothMedia } from '../types';
import { downloadMediaFile, triggerConfetti } from '../utils/downloadHelpers';

interface CloudMediaLandingProps {
  session: PhotoboothSession;
  onOpenLightbox: (url: string, title: string, type: 'image' | 'video') => void;
  onShare: () => void;
  onOpenGuide: () => void;
  onDownloadAllZip: () => void;
  isZipping: boolean;
  lang: 'vi' | 'en';
  onReloadCloud: () => void;
  isLoadingCloud: boolean;
}

export const CloudMediaLanding: React.FC<CloudMediaLandingProps> = ({
  session,
  onOpenLightbox,
  onShare,
  onOpenGuide,
  onDownloadAllZip,
  isZipping,
  lang,
  onReloadCloud,
  isLoadingCloud
}) => {
  // View mode switcher: 'both' | 'photo' | 'video'
  const [viewMode, setViewMode] = useState<'both' | 'photo' | 'video'>('both');

  // Video playback state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isLooping, setIsLooping] = useState(true);

  // Download loading states
  const [downloadingPhoto, setDownloadingPhoto] = useState(false);
  const [downloadingVideo, setDownloadingVideo] = useState(false);
  const [copiedLink, setCopiedLink] = useState<'photo' | 'video' | null>(null);

  // Video control functions
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

  const changeSpeed = (speed: number) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = speed;
    setPlaybackSpeed(speed);
  };

  // 1. Download Photo to Mobile Phone
  const handleDownloadPhoto = async () => {
    if (!session.stripMedia?.url) return;
    setDownloadingPhoto(true);
    const filename = session.stripMedia.name || `Photobooth_Photo_${session.code || 'HD'}.jpg`;
    await downloadMediaFile(session.stripMedia.url, filename);
    setDownloadingPhoto(false);
  };

  // 2. Download Video to Mobile Phone
  const handleDownloadVideo = async () => {
    if (!session.videoMedia?.url) return;
    setDownloadingVideo(true);
    const filename = session.videoMedia.name || `Photobooth_Video_${session.code || 'Boomerang'}.mp4`;
    await downloadMediaFile(session.videoMedia.url, filename);
    setDownloadingVideo(false);
  };

  // 3. Extract Snapshot Frame from Video
  const handleCaptureVideoFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 1080;
    canvas.height = video.videoHeight || 1920;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Frame_Snapshot_${session.code || 'Live'}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      triggerConfetti();
    }, 'image/jpeg', 0.95);
  };

  // Copy direct media URL
  const handleCopyUrl = (url: string, type: 'photo' | 'video') => {
    navigator.clipboard.writeText(url);
    setCopiedLink(type);
    setTimeout(() => setCopiedLink(null), 2500);
  };

  const photo = session.stripMedia;
  const video = session.videoMedia;

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      
      {/* Hidden canvas for video frame extraction */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Hero Cloud Banner */}
      <div className="bg-white border border-[#1A1A1A]/15 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-300 font-sans text-[10px] uppercase tracking-widest font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>{lang === 'vi' ? 'Dữ liệu trực tiếp từ Cloud' : 'Cloud Synchronized'}</span>
              </span>

              <span className="font-mono text-[11px] font-bold text-[#1A1A1A] px-2.5 py-1 bg-[#E5E2DD] border border-[#1A1A1A]/15">
                MÃ: #{session.code}
              </span>

              <span className="font-sans text-[10px] uppercase tracking-wider text-[#1A1A1A]/60 font-semibold">
                1 Ảnh HD + 1 Video Boomerang
              </span>
            </div>

            <h2 className="font-serif-display text-2xl sm:text-4xl font-bold uppercase tracking-tight text-[#1A1A1A]">
              {session.boothName || 'PHOTOBOOTH MEMORIES'}
            </h2>

            <p className="font-sans text-xs sm:text-sm text-[#1A1A1A]/70 max-w-2xl leading-relaxed">
              {lang === 'vi' 
                ? 'Khoảnh khắc chụp ảnh của bạn đã được lưu trữ trên Cloud. Bạn có thể xem trực tiếp và tải về trọn bộ chất lượng gốc cho điện thoại của mình bên dưới.'
                : 'Your photobooth media is stored on Cloud. View and download high-resolution master media directly to your phone below.'
              }
            </p>
          </div>

          {/* Quick Actions in Banner */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={onOpenGuide}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#E5E2DD] hover:bg-[#1A1A1A] hover:text-white border border-[#1A1A1A]/20 font-sans text-[11px] uppercase tracking-widest font-bold text-[#1A1A1A] transition-colors cursor-pointer"
            >
              <Smartphone className="w-4 h-4" />
              <span>{lang === 'vi' ? 'Cách lưu vào điện thoại' : 'Mobile Guide'}</span>
            </button>

            <button
              onClick={onReloadCloud}
              disabled={isLoadingCloud}
              className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-[#E5E2DD] border border-[#1A1A1A]/20 font-sans text-[11px] uppercase tracking-widest font-bold text-[#1A1A1A] transition-colors cursor-pointer"
              title="Làm mới dữ liệu từ Cloud"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingCloud ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{lang === 'vi' ? 'Làm mới Cloud' : 'Sync'}</span>
            </button>

            <button
              onClick={onShare}
              className="p-2.5 bg-white hover:bg-[#1A1A1A] hover:text-white border border-[#1A1A1A]/20 text-[#1A1A1A] transition-colors cursor-pointer"
              title={lang === 'vi' ? 'Chia sẻ liên kết' : 'Share'}
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* View Mode Segmented Controls */}
        <div className="mt-6 pt-6 border-t border-[#1A1A1A]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-1 bg-[#E5E2DD]/70 p-1 border border-[#1A1A1A]/15 font-sans text-[10px] uppercase tracking-widest font-bold">
            <button
              onClick={() => setViewMode('both')}
              className={`px-4 py-2 transition-all cursor-pointer ${
                viewMode === 'both' ? 'bg-[#1A1A1A] text-white shadow-xs' : 'text-[#1A1A1A] hover:bg-white/50'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                <span>{lang === 'vi' ? 'Xem Cả Hai (Ảnh & Video)' : 'Dual View (Both)'}</span>
              </span>
            </button>

            <button
              onClick={() => setViewMode('photo')}
              className={`px-4 py-2 transition-all cursor-pointer ${
                viewMode === 'photo' ? 'bg-[#1A1A1A] text-white shadow-xs' : 'text-[#1A1A1A] hover:bg-white/50'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5" />
                <span>{lang === 'vi' ? 'Chỉ Xem Ảnh' : 'Photo Only'}</span>
              </span>
            </button>

            {video && (
              <button
                onClick={() => setViewMode('video')}
                className={`px-4 py-2 transition-all cursor-pointer ${
                  viewMode === 'video' ? 'bg-[#1A1A1A] text-white shadow-xs' : 'text-[#1A1A1A] hover:bg-white/50'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Film className="w-3.5 h-3.5" />
                  <span>{lang === 'vi' ? 'Chỉ Xem Video' : 'Video Only'}</span>
                </span>
              </button>
            )}
          </div>

          <div className="font-mono text-[11px] text-[#1A1A1A]/60 flex items-center gap-2">
            <span>CLOUD STORAGE ID:</span>
            <span className="font-bold text-[#1A1A1A]">{session.id}</span>
          </div>
        </div>
      </div>

      {/* Main Dual Stage (1 Ảnh & 1 Video) */}
      <div className={`grid gap-8 ${
        viewMode === 'both' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 max-w-2xl mx-auto'
      }`}>

        {/* ========================================================================= */}
        {/* CARD 1: 1 ẢNH TỪ CLOUD (PHOTO VIEW & DOWNLOAD) */}
        {/* ========================================================================= */}
        {(viewMode === 'both' || viewMode === 'photo') && (
          <div className="bg-white border border-[#1A1A1A]/15 shadow-sm p-5 sm:p-7 flex flex-col justify-between">
            
            <div>
              {/* Header of Photo Card */}
              <div className="flex items-center justify-between pb-4 mb-5 border-b border-[#1A1A1A]/10">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 bg-[#1A1A1A] text-white flex items-center justify-center">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-serif-display text-lg font-bold text-[#1A1A1A] uppercase tracking-tight">
                      {lang === 'vi' ? '1. Bức Ảnh Kỷ Niệm (HD)' : '1. Original HD Photo'}
                    </h3>
                    <p className="font-sans text-[10px] uppercase tracking-widest text-[#1A1A1A]/60">
                      {photo?.width ? `${photo.width} × ${photo.height} PX` : 'MASTER RESOLUTION'} • CLOUD STORAGE
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => photo?.url && onOpenLightbox(photo.url, `Ảnh Photobooth - ${session.boothName}`, 'image')}
                  className="p-2 border border-[#1A1A1A]/20 hover:bg-[#1A1A1A] hover:text-white text-[#1A1A1A] transition-colors cursor-pointer"
                  title="Phóng to ảnh"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>

              {/* Photo Display Frame */}
              <div className="relative bg-[#F9F8F6] border border-[#1A1A1A]/10 p-3 sm:p-4 flex items-center justify-center group">
                <div
                  onClick={() => photo?.url && onOpenLightbox(photo.url, `Ảnh Photobooth - ${session.boothName}`, 'image')}
                  className="relative max-h-[520px] w-auto overflow-hidden cursor-pointer shadow-md border border-[#1A1A1A]/15 group-hover:border-[#1A1A1A] transition-colors"
                >
                  <img
                    src={photo?.url}
                    alt={photo?.name || 'Photobooth Photo'}
                    referrerPolicy="no-referrer"
                    className="max-h-[500px] w-auto object-contain transition-transform duration-500 group-hover:scale-[1.02]"
                    loading="eager"
                  />

                  {/* Overlay on hover */}
                  <div className="absolute inset-0 bg-[#1A1A1A]/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                    <span className="px-4 py-2 bg-[#1A1A1A] text-white font-sans text-[10px] uppercase tracking-widest font-bold flex items-center gap-2 shadow-lg">
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span>{lang === 'vi' ? 'Chạm để Phóng To HD' : 'Click to View Full HD'}</span>
                    </span>
                  </div>
                </div>

                {/* Badge top-left */}
                <div className="absolute top-6 left-6 px-2.5 py-1 bg-[#1A1A1A]/85 backdrop-blur-xs text-white font-mono text-[9px] uppercase tracking-widest font-bold border border-white/20">
                  CLOUD PHOTO
                </div>
              </div>

              {/* Photo metadata line */}
              <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-[#1A1A1A]/60 px-1">
                <span className="truncate max-w-[200px]">{photo?.name || `Photo_${session.code}.jpg`}</span>
                <span className="text-emerald-700 font-bold uppercase">✓ 100% Master Quality</span>
              </div>
            </div>

            {/* Photo Action Buttons */}
            <div className="mt-6 pt-5 border-t border-[#1A1A1A]/10 space-y-3">
              
              {/* PRIMARY MOBILE DOWNLOAD BUTTON */}
              <button
                id="btn-download-photo-mobile"
                onClick={handleDownloadPhoto}
                disabled={downloadingPhoto}
                className="w-full py-4 px-6 font-sans font-bold text-xs uppercase tracking-widest bg-[#1A1A1A] hover:bg-black text-[#F9F8F6] shadow-sm flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] cursor-pointer"
              >
                <Download className={`w-4 h-4 text-emerald-400 ${downloadingPhoto ? 'animate-bounce' : ''}`} />
                <span>
                  {downloadingPhoto 
                    ? (lang === 'vi' ? 'Đang tải ảnh xuống máy...' : 'Downloading...') 
                    : (lang === 'vi' ? 'TẢI ẢNH VỀ ĐIỆN THOẠI (HD)' : 'DOWNLOAD PHOTO TO PHONE')
                  }
                </span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => photo?.url && onOpenLightbox(photo.url, `Ảnh Photobooth - ${session.boothName}`, 'image')}
                  className="py-2.5 px-3 border border-[#1A1A1A]/20 bg-white hover:bg-[#E5E2DD] font-sans text-[10px] uppercase tracking-widest font-bold text-[#1A1A1A] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>{lang === 'vi' ? 'Phóng to xem' : 'Full Zoom'}</span>
                </button>

                <button
                  onClick={() => photo?.url && handleCopyUrl(photo.url, 'photo')}
                  className="py-2.5 px-3 border border-[#1A1A1A]/20 bg-white hover:bg-[#E5E2DD] font-sans text-[10px] uppercase tracking-widest font-bold text-[#1A1A1A] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiedLink === 'photo' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{lang === 'vi' ? 'Đã sao chép' : 'Copied'}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>{lang === 'vi' ? 'Copy Link Ảnh' : 'Copy URL'}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Mobile tip */}
              <div className="p-3 bg-[#E5E2DD]/40 border border-[#1A1A1A]/10 text-[11px] font-sans text-[#1A1A1A]/70 flex items-start gap-2">
                <Smartphone className="w-4 h-4 text-[#1A1A1A] shrink-0 mt-0.5" />
                <p>
                  {lang === 'vi'
                    ? '💡 Trên iPhone/Android: Nhấn nút tải hoặc chạm giữ ngón tay vào bức ảnh để chọn "Lưu vào Thư viện ảnh".'
                    : '💡 On iPhone/Android: Tap download or touch & hold the image to save directly into your Photos app.'
                  }
                </p>
              </div>
            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* CARD 2: 1 VIDEO TỪ CLOUD (VIDEO VIEW & DOWNLOAD) */}
        {/* ========================================================================= */}
        {(viewMode === 'both' || viewMode === 'video') && video && (
          <div className="bg-white border border-[#1A1A1A]/15 shadow-sm p-5 sm:p-7 flex flex-col justify-between">
            
            <div>
              {/* Header of Video Card */}
              <div className="flex items-center justify-between pb-4 mb-5 border-b border-[#1A1A1A]/10">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 bg-[#1A1A1A] text-white flex items-center justify-center">
                    <Film className="w-4 h-4 text-rose-300" />
                  </div>
                  <div>
                    <h3 className="font-serif-display text-lg font-bold text-[#1A1A1A] uppercase tracking-tight">
                      {lang === 'vi' ? '2. Video Boomerang (MP4)' : '2. Live Video Clip (MP4)'}
                    </h3>
                    <p className="font-sans text-[10px] uppercase tracking-widest text-[#1A1A1A]/60">
                      MP4 HD • LIVE RECORDING • CLOUD STORAGE
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => onOpenLightbox(video.url, `Live Video - ${session.boothName}`, 'video')}
                  className="p-2 border border-[#1A1A1A]/20 hover:bg-[#1A1A1A] hover:text-white text-[#1A1A1A] transition-colors cursor-pointer"
                  title="Toàn màn hình video"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>

              {/* Video Player Display Container */}
              <div className="relative bg-[#1A1A1A] border border-[#1A1A1A] overflow-hidden shadow-md flex items-center justify-center aspect-9/16 max-h-[500px] mx-auto group">
                <video
                  ref={videoRef}
                  src={video.url}
                  poster={video.thumbnailUrl}
                  playsInline
                  autoPlay
                  loop={isLooping}
                  muted={isMuted}
                  className="w-full h-full object-cover"
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                />

                {/* Badge top-left */}
                <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-[#1A1A1A]/85 backdrop-blur-xs text-white font-sans text-[9px] uppercase tracking-widest font-bold border border-white/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                  <span>CLOUD BOOMERANG</span>
                </div>

                {/* Play/Pause Overlay Indicator on click */}
                {!isPlaying && (
                  <div
                    onClick={togglePlay}
                    className="absolute inset-0 flex items-center justify-center bg-[#1A1A1A]/40 backdrop-blur-[2px] cursor-pointer"
                  >
                    <div className="w-16 h-16 bg-white text-[#1A1A1A] flex items-center justify-center shadow-xl hover:scale-105 transition-transform">
                      <Play className="w-7 h-7 translate-x-0.5 fill-[#1A1A1A]" />
                    </div>
                  </div>
                )}

                {/* Bottom Floating Control Bar */}
                <div className="absolute bottom-3 inset-x-3 bg-[#1A1A1A]/90 backdrop-blur-md p-2 flex items-center justify-between text-white border border-white/15">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={togglePlay}
                      className="p-1.5 hover:bg-white/20 text-white transition-colors cursor-pointer"
                      title={isPlaying ? 'Pause' : 'Play'}
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
                    </button>

                    <button
                      onClick={toggleMute}
                      className="p-1.5 hover:bg-white/20 text-white transition-colors cursor-pointer"
                      title={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
                    >
                      {isMuted ? <VolumeX className="w-4 h-4 text-stone-400" /> : <Volume2 className="w-4 h-4 text-white" />}
                    </button>
                  </div>

                  <div className="flex items-center gap-2 font-mono text-[10px]">
                    <button
                      onClick={() => changeSpeed(playbackSpeed === 1 ? 0.5 : 1)}
                      className={`px-2 py-1 font-bold uppercase tracking-wider transition-colors border ${
                        playbackSpeed === 0.5 ? 'bg-white text-[#1A1A1A] border-white' : 'border-white/20 text-white hover:bg-white/10'
                      }`}
                      title="Tốc độ phát"
                    >
                      {playbackSpeed === 0.5 ? '0.5x Slow' : '1x Normal'}
                    </button>

                    <button
                      onClick={() => setIsLooping(!isLooping)}
                      className={`p-1.5 transition-colors ${
                        isLooping ? 'text-white bg-white/20' : 'text-white/40'
                      }`}
                      title="Lặp lại"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Video metadata line */}
              <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-[#1A1A1A]/60 px-1">
                <span className="truncate max-w-[200px]">{video.name || `LiveVideo_${session.code}.mp4`}</span>
                <span className="text-emerald-700 font-bold uppercase">✓ 1080p MP4 Ready</span>
              </div>
            </div>

            {/* Video Action Buttons */}
            <div className="mt-6 pt-5 border-t border-[#1A1A1A]/10 space-y-3">
              
              {/* PRIMARY MOBILE DOWNLOAD BUTTON */}
              <button
                id="btn-download-video-mobile"
                onClick={handleDownloadVideo}
                disabled={downloadingVideo}
                className="w-full py-4 px-6 font-sans font-bold text-xs uppercase tracking-widest bg-[#1A1A1A] hover:bg-black text-[#F9F8F6] shadow-sm flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] cursor-pointer"
              >
                <Download className={`w-4 h-4 text-rose-300 ${downloadingVideo ? 'animate-bounce' : ''}`} />
                <span>
                  {downloadingVideo 
                    ? (lang === 'vi' ? 'Đang tải video xuống máy...' : 'Downloading Video...') 
                    : (lang === 'vi' ? 'TẢI VIDEO VỀ ĐIỆN THOẠI (MP4)' : 'DOWNLOAD VIDEO TO PHONE')
                  }
                </span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleCaptureVideoFrame}
                  className="py-2.5 px-3 border border-[#1A1A1A]/20 bg-white hover:bg-[#E5E2DD] font-sans text-[10px] uppercase tracking-widest font-bold text-[#1A1A1A] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  title="Chụp ảnh tĩnh từ khoảnh khắc video đang chạy"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{lang === 'vi' ? 'Trích ảnh từ video' : 'Extract Photo'}</span>
                </button>

                <button
                  onClick={() => handleCopyUrl(video.url, 'video')}
                  className="py-2.5 px-3 border border-[#1A1A1A]/20 bg-white hover:bg-[#E5E2DD] font-sans text-[10px] uppercase tracking-widest font-bold text-[#1A1A1A] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiedLink === 'video' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{lang === 'vi' ? 'Đã sao chép' : 'Copied'}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>{lang === 'vi' ? 'Copy Link Video' : 'Copy URL'}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Video tip */}
              <div className="p-3 bg-[#E5E2DD]/40 border border-[#1A1A1A]/10 text-[11px] font-sans text-[#1A1A1A]/70 flex items-start gap-2">
                <Film className="w-4 h-4 text-[#1A1A1A] shrink-0 mt-0.5" />
                <p>
                  {lang === 'vi'
                    ? '💡 Video Boomerang được quay tự động tại buồng chụp, định dạng chuẩn tương thích với Story Instagram, TikTok và Facebook.'
                    : '💡 Recorded automatically during booth countdown, perfectly formatted for Instagram Stories & TikTok.'
                  }
                </p>
              </div>
            </div>

          </div>
        )}

      </div>

      {/* Combined Download Box */}
      <div className="bg-[#E5E2DD]/60 border border-[#1A1A1A]/15 p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-1 text-center md:text-left">
          <h3 className="font-serif-display text-xl font-bold uppercase tracking-tight text-[#1A1A1A]">
            {lang === 'vi' ? 'Tải Trọn Bộ Cả Ảnh & Video (Tệp ZIP)' : 'Download Full Package (Photo + Video ZIP)'}
          </h3>
          <p className="font-sans text-xs text-[#1A1A1A]/70">
            {lang === 'vi'
              ? 'Gom cả 1 bức ảnh chất lượng cao và 1 video boomerang vào 1 tệp nén duy nhất chỉ với 1 cú chạm.'
              : 'Bundle both 1 HD photo and 1 boomerang video into a single ZIP file with 1 tap.'
            }
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            id="btn-download-both-zip-landing"
            onClick={onDownloadAllZip}
            disabled={isZipping}
            className="py-4 px-8 font-sans font-bold text-xs uppercase tracking-widest bg-[#1A1A1A] hover:bg-black text-[#F9F8F6] shadow-md flex items-center gap-2.5 transition-all active:scale-[0.98] cursor-pointer"
          >
            <ArrowDownToLine className={`w-4 h-4 text-rose-300 ${isZipping ? 'animate-bounce' : ''}`} />
            <span>
              {isZipping 
                ? (lang === 'vi' ? 'Đang nén...' : 'Zipping...') 
                : (lang === 'vi' ? 'TẢI CẢ HAI (ZIP)' : 'DOWNLOAD ALL (ZIP)')
              }
            </span>
          </button>
        </div>
      </div>

    </div>
  );
};
