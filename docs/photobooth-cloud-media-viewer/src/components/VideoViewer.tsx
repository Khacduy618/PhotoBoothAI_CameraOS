import React, { useRef, useState } from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Download, Camera, Maximize2, Sparkles, Film } from 'lucide-react';
import { PhotoboothMedia, PhotoboothSession } from '../types';
import { downloadMediaFile, triggerConfetti } from '../utils/downloadHelpers';

interface VideoViewerProps {
  session: PhotoboothSession;
  video: PhotoboothMedia;
  onOpenLightbox: (url: string, title: string, type: 'video') => void;
  lang: 'vi' | 'en';
}

export const VideoViewer: React.FC<VideoViewerProps> = ({
  session,
  video,
  onOpenLightbox,
  lang
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isLooping, setIsLooping] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [downloading, setDownloading] = useState(false);
  const [capturedFrameUrl, setCapturedFrameUrl] = useState<string | null>(null);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

  const changeSpeed = (speed: number) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = speed;
    setPlaybackSpeed(speed);
  };

  const handleDownloadVideo = async () => {
    setDownloading(true);
    await downloadMediaFile(video.url, video.name || `Photobooth_Video_${session.code}.mp4`);
    setDownloading(false);
  };

  // Frame capture function: Extract current frame from the video
  const captureCurrentFrame = () => {
    const videoEl = videoRef.current;
    const canvas = canvasRef.current;
    if (!videoEl || !canvas) return;

    canvas.width = videoEl.videoWidth || 1080;
    canvas.height = videoEl.videoHeight || 1920;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    try {
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      setCapturedFrameUrl(dataUrl);
      
      // Auto-trigger frame download
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `Frame_Snapshot_${session.code}_${Math.floor(videoEl.currentTime * 10)}s.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      triggerConfetti();
    } catch (err) {
      console.warn('Canvas export failed due to CORS:', err);
    }
  };

  return (
    <div className="flex flex-col items-center">
      {/* Hidden Canvas for Frame Capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Video Container Box */}
      <div className="relative w-full max-w-[340px] sm:max-w-[380px] aspect-9/16 bg-[#1A1A1A] overflow-hidden shadow-2xl border border-[#1A1A1A] group">
        <video
          ref={videoRef}
          src={video.url}
          poster={video.thumbnailUrl}
          playsInline
          loop={isLooping}
          muted={isMuted}
          crossOrigin="anonymous"
          className="w-full h-full object-cover cursor-pointer"
          onClick={togglePlay}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />

        {/* Photobooth Live Watermark */}
        <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-[#1A1A1A]/80 backdrop-blur-md text-white font-sans text-[9px] uppercase tracking-widest font-bold border border-white/20">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
          <span>BOOMERANG ARCHIVE</span>
        </div>

        {/* Lightbox / Fullscreen Top-Right */}
        <button
          onClick={() => onOpenLightbox(video.url, `Live Video - ${session.boothName}`, 'video')}
          className="absolute top-4 right-4 p-2 bg-[#1A1A1A]/80 hover:bg-[#1A1A1A] text-white border border-white/20 transition-colors cursor-pointer"
          title="Fullscreen"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>

        {/* Center Play/Pause Overlay Indicator */}
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
            {/* Speed selection */}
            <button
              onClick={() => changeSpeed(playbackSpeed === 1 ? 0.5 : 1)}
              className={`px-2 py-1 font-bold uppercase tracking-wider transition-colors border ${
                playbackSpeed === 0.5 ? 'bg-white text-[#1A1A1A] border-white' : 'border-white/20 text-white hover:bg-white/10'
              }`}
              title="Tốc độ phát"
            >
              {playbackSpeed === 0.5 ? '0.5x Slow' : '1.0x'}
            </button>

            {/* Loop indicator */}
            <button
              onClick={() => setIsLooping(!isLooping)}
              className={`p-1.5 transition-colors ${
                isLooping ? 'text-white bg-white/20' : 'text-white/40'
              }`}
              title="Lặp lại liên tục"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="w-full max-w-[380px] mt-6 space-y-3">
        {/* Main Video Download Button */}
        <button
          id="btn-download-video-mp4"
          onClick={handleDownloadVideo}
          disabled={downloading}
          className="w-full py-4 px-6 font-sans font-bold text-xs uppercase tracking-widest bg-[#1A1A1A] hover:bg-black text-[#F9F8F6] shadow-sm flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] cursor-pointer"
        >
          <Film className="w-4 h-4 text-rose-300" />
          <span>
            {downloading
              ? (lang === 'vi' ? 'Đang tải video...' : 'Downloading Video...')
              : (lang === 'vi' ? 'Tải Video Boomerang (MP4)' : 'Download Original Video MP4')
            }
          </span>
        </button>

        {/* Capture Current Frame Button */}
        <button
          id="btn-capture-video-frame"
          onClick={captureCurrentFrame}
          className="w-full py-3 px-4 font-sans font-bold text-[11px] uppercase tracking-wider bg-white hover:bg-[#F9F8F6] border border-[#1A1A1A]/20 text-[#1A1A1A] flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <Camera className="w-3.5 h-3.5 text-[#1A1A1A]/70" />
          <span>
            {lang === 'vi' ? 'Trích xuất ảnh tĩnh từ video' : 'Extract Still Frame Snapshot'}
          </span>
        </button>

        <p className="text-center font-sans text-[11px] uppercase tracking-wider text-[#1A1A1A]/60 pt-1">
          {lang === 'vi' 
            ? 'Clip boomerang ghi lại trực tiếp tại buồng chụp photobooth.'
            : 'Live clip recorded live during the photobooth countdown.'
          }
        </p>
      </div>
    </div>
  );
};
