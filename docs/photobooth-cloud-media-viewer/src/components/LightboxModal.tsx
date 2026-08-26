import React, { useEffect } from 'react';
import { X, Download, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { downloadMediaFile } from '../utils/downloadHelpers';

interface LightboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  title: string;
  type?: 'image' | 'video';
  lang?: 'vi' | 'en';
}

export const LightboxModal: React.FC<LightboxModalProps> = ({
  isOpen,
  onClose,
  url,
  title,
  type = 'image',
  lang = 'vi'
}) => {
  const [scale, setScale] = React.useState(1);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'auto';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !url) return null;

  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.25, 0.6));
  const handleResetZoom = () => setScale(1);

  const handleDownload = () => {
    downloadMediaFile(url, `${title.replace(/\s+/g, '_')}.${type === 'video' ? 'mp4' : 'jpg'}`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex flex-col items-center justify-between p-4 sm:p-6 animate-in fade-in duration-200">
      
      {/* Top Bar */}
      <div className="w-full max-w-5xl flex items-center justify-between text-white z-10 pb-3 border-b border-white/10">
        <div className="truncate max-w-md">
          <h4 className="font-sans text-sm font-semibold text-white/90 truncate">{title}</h4>
          <p className="text-[11px] text-white/50 font-mono">
            {lang === 'vi' ? 'Nhấn ESC để đóng' : 'Press ESC to close'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {type === 'image' && (
            <div className="hidden sm:flex items-center bg-white/[0.07] border border-white/10 rounded-xl p-1 gap-1">
              <button
                onClick={handleZoomOut}
                className="p-1.5 hover:bg-white/10 text-white/70 hover:text-white rounded-lg transition-colors cursor-pointer"
                title="Thu nhỏ"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={handleResetZoom}
                className="px-2 py-1 text-xs font-mono text-white/80 hover:text-white"
                title="Đặt lại"
              >
                {Math.round(scale * 100)}%
              </button>
              <button
                onClick={handleZoomIn}
                className="p-1.5 hover:bg-white/10 text-white/70 hover:text-white rounded-lg transition-colors cursor-pointer"
                title="Phóng to"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
          )}

          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white text-xs font-semibold rounded-xl shadow-lg transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{lang === 'vi' ? 'Tải tệp' : 'Download'}</span>
          </button>

          <button
            onClick={onClose}
            className="p-2 bg-white/10 hover:bg-white/20 text-white/80 hover:text-white rounded-xl border border-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main View Area */}
      <div 
        className="relative flex-1 w-full max-w-4xl flex items-center justify-center overflow-hidden my-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {type === 'video' ? (
          <video
            src={url}
            controls
            autoPlay
            loop
            playsInline
            className="max-h-[75vh] max-w-full rounded-2xl shadow-2xl border border-white/15"
          />
        ) : (
          <img
            src={url}
            alt={title}
            referrerPolicy="no-referrer"
            style={{ transform: `scale(${scale})` }}
            className="max-h-[78vh] max-w-full object-contain rounded-2xl shadow-2xl transition-transform duration-200 border border-white/10"
          />
        )}
      </div>

      {/* Footer Info */}
      <div className="text-center text-[11px] text-white/40 tracking-wider font-mono">
        ORIGINAL HIGH RESOLUTION CLOUD MEDIA
      </div>
    </div>
  );
};
