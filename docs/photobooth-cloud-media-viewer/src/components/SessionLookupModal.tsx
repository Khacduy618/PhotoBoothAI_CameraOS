import React, { useState, useEffect, useRef } from 'react';
import { X, Search, Camera, QrCode, Sparkles, AlertCircle } from 'lucide-react';
import { SAMPLE_SESSIONS } from '../data/sampleSessions';
import { PhotoboothSession } from '../types';

interface SessionLookupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSession: (session: PhotoboothSession) => void;
  lang: 'vi' | 'en';
}

export const SessionLookupModal: React.FC<SessionLookupModalProps> = ({
  isOpen,
  onClose,
  onSelectSession,
  lang
}) => {
  const [codeInput, setCodeInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isScanningCamera, setIsScanningCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  if (!isOpen) return null;

  const handleLookup = async (query: string) => {
    const trimmed = query.trim().toUpperCase();
    if (!trimmed) {
      setErrorMsg(lang === 'vi' ? 'Vui lòng nhập mã phiên (4 số hoặc mã PB-xxxx)' : 'Please enter session code');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      // 1. Check local sample sessions first
      const matchedSample = SAMPLE_SESSIONS.find(
        (s) => s.code.toUpperCase() === trimmed || s.id.toUpperCase() === trimmed
      );

      if (matchedSample) {
        onSelectSession(matchedSample);
        onClose();
        setIsLoading(false);
        return;
      }

      // 2. Fetch from backend API
      const res = await fetch(`/api/photobooth/sessions/${encodeURIComponent(trimmed)}`);
      const data = await res.json();

      if (data.success && data.session) {
        onSelectSession(data.session);
        onClose();
      } else {
        setErrorMsg(data.message || (lang === 'vi' ? 'Không tìm thấy phiên chụp này.' : 'Session not found.'));
      }
    } catch {
      setErrorMsg(lang === 'vi' ? 'Lỗi kết nối máy chủ.' : 'Network connection error.');
    } finally {
      setIsLoading(false);
    }
  };

  const startCameraScanner = async () => {
    setIsScanningCamera(true);
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      // If BarcodeDetector is available natively in browser
      if ('BarcodeDetector' in window) {
        const barcodeDetector = new (window as any).BarcodeDetector({
          formats: ['qr_code']
        });
        const scanInterval = setInterval(async () => {
          if (!videoRef.current || !isScanningCamera) {
            clearInterval(scanInterval);
            return;
          }
          try {
            const barcodes = await barcodeDetector.detect(videoRef.current);
            if (barcodes.length > 0) {
              const rawValue = barcodes[0].rawValue;
              clearInterval(scanInterval);
              stopCamera();

              // Parse session ID from URL or raw text
              const url = new URL(rawValue, window.location.origin);
              const sessionParam = url.searchParams.get('session') || url.searchParams.get('id') || rawValue;
              handleLookup(sessionParam);
            }
          } catch {
            // keep scanning
          }
        }, 500);
      }
    } catch {
      setErrorMsg(lang === 'vi' ? 'Không thể truy cập camera để quét mã QR.' : 'Unable to access camera for QR scan.');
      setIsScanningCamera(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsScanningCamera(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#1A1A1A]/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#F9F8F6] border border-[#1A1A1A] p-6 sm:p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#1A1A1A]/15">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#1A1A1A] text-white flex items-center justify-center">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif-display text-lg font-bold text-[#1A1A1A] uppercase tracking-tight">
                {lang === 'vi' ? 'Nhập mã Photobooth' : 'Enter Session Code'}
              </h3>
              <p className="font-sans text-[10px] uppercase tracking-widest text-[#1A1A1A]/60">
                {lang === 'vi' ? 'Mã 4 số trên hóa đơn hoặc màn hình' : '4-digit code on receipt or screen'}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1.5 hover:bg-[#E5E2DD] text-[#1A1A1A] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Input & Form */}
        <div className="py-5 space-y-4">
          <div className="relative">
            <input
              type="text"
              placeholder={lang === 'vi' ? 'Ví dụ: 8821 hoặc PB-KOREA-8821' : 'e.g. 8821 or PB-KOREA-8821'}
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLookup(codeInput)}
              className="w-full pl-4 pr-12 py-3 border border-[#1A1A1A]/30 text-xs font-mono uppercase tracking-wider focus:outline-[#1A1A1A] bg-white text-[#1A1A1A]"
              autoFocus
            />
            <button
              onClick={() => handleLookup(codeInput)}
              disabled={isLoading}
              className="absolute right-2 top-2 bottom-2 px-3.5 bg-[#1A1A1A] hover:bg-black text-white font-sans text-[10px] uppercase tracking-widest font-bold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" />
            </button>
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-800 border border-red-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Camera Scanner Section */}
          {isScanningCamera ? (
            <div className="relative overflow-hidden bg-black aspect-square max-h-56 flex flex-col items-center justify-center border border-[#1A1A1A]">
              <video ref={videoRef} playsInline className="w-full h-full object-cover" />
              <div className="absolute inset-8 border border-white/60 border-dashed pointer-events-none animate-pulse" />
              <button
                onClick={stopCamera}
                className="absolute bottom-2 px-3 py-1 bg-[#1A1A1A]/90 text-white font-sans text-[10px] uppercase tracking-wider font-bold"
              >
                {lang === 'vi' ? 'Tắt camera' : 'Close Camera'}
              </button>
            </div>
          ) : (
            <button
              onClick={startCameraScanner}
              className="w-full py-2.5 px-4 border border-[#1A1A1A]/20 bg-white hover:bg-[#E5E2DD] font-sans text-[10px] uppercase tracking-widest font-bold text-[#1A1A1A] flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Camera className="w-4 h-4 text-[#1A1A1A]" />
              <span>{lang === 'vi' ? 'Quét mã QR bằng Camera' : 'Scan QR with Camera'}</span>
            </button>
          )}

          {/* Preset Sample Sessions */}
          <div className="pt-2">
            <div className="font-sans text-[10px] font-bold text-[#1A1A1A]/60 uppercase tracking-widest mb-2 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#1A1A1A]" />
              <span>{lang === 'vi' ? 'Hoặc chọn phiên mẫu lưu trữ:' : 'Or browse archive samples:'}</span>
            </div>
            <div className="space-y-1.5">
              {SAMPLE_SESSIONS.map((sample) => (
                <button
                  key={sample.id}
                  onClick={() => {
                    stopCamera();
                    onSelectSession(sample);
                    onClose();
                  }}
                  className="w-full text-left p-3 border border-[#1A1A1A]/10 bg-white hover:border-[#1A1A1A] hover:bg-[#E5E2DD]/40 flex items-center justify-between transition-colors group cursor-pointer"
                >
                  <div className="truncate">
                    <span className="font-serif-display font-bold text-sm text-[#1A1A1A] group-hover:underline block truncate">
                      {sample.boothName}
                    </span>
                    <span className="font-mono text-[10px] text-[#1A1A1A]/60">
                      Mã: #{sample.code} • {sample.rawPhotos.length} ảnh + 1 video
                    </span>
                  </div>
                  <span className="font-sans text-[10px] uppercase tracking-widest font-bold text-[#1A1A1A]/70 group-hover:text-[#1A1A1A] shrink-0">
                    Mở →
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
