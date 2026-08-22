import React from 'react';
import { Camera, Clock, Share2, Sparkles, Terminal, QrCode } from 'lucide-react';
import { PhotoboothSession } from '../types';

interface HeaderProps {
  session: PhotoboothSession | null;
  onOpenLookup: () => void;
  onOpenIntegration: () => void;
  onShare: () => void;
  timeRemaining: string;
  isExpired: boolean;
  lang: 'vi' | 'en';
  setLang: (l: 'vi' | 'en') => void;
}

export const Header: React.FC<HeaderProps> = ({
  session,
  onOpenLookup,
  onOpenIntegration,
  onShare,
  timeRemaining,
  isExpired,
  lang,
  setLang
}) => {
  return (
    <header className="sticky top-0 z-30 bg-[#F9F8F6]/95 backdrop-blur-md border-b border-[#1A1A1A]/10 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-5">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          
          {/* Brand Logo & Name */}
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-[#1A1A1A] text-white flex items-center justify-center shrink-0 shadow-xs">
              <Camera className="w-6 h-6 stroke-[1.5]" />
            </div>
            <div>
              <div className="flex items-baseline gap-3 flex-wrap">
                <h1 className="font-serif-display text-2xl sm:text-4xl tracking-tighter uppercase font-bold leading-none text-[#1A1A1A]">
                  {session?.boothName || 'MEMENTO'}
                </h1>
                <span className="font-sans text-[9px] uppercase tracking-[0.2em] px-2 py-0.5 border border-[#1A1A1A] text-[#1A1A1A] font-bold">
                  {lang === 'vi' ? 'Lưu trữ Cloud' : 'Cloud Archive'}
                </span>
              </div>
              <p className="font-sans text-[10px] uppercase tracking-widest text-[#1A1A1A]/60 mt-1.5 font-medium">
                {lang === 'vi' ? 'MÃ PHIÊN: ' : 'SESSION ID: '} 
                <span className="font-mono-code font-bold text-[#1A1A1A]">#{session?.code || 'PB-8821'}</span>
                {session?.id && <span className="opacity-60 ml-1">({session.id})</span>}
              </p>
            </div>
          </div>

          {/* Right Editorial Info & Actions */}
          <div className="flex flex-wrap items-center md:items-end justify-between md:justify-end gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-[#1A1A1A]/10">
            <div className="hidden lg:block text-right mr-3">
              <p className="text-xs italic uppercase tracking-wider text-[#1A1A1A]/80 font-serif-sub font-semibold">
                {session?.location || 'The Grand Studio'}
              </p>
              <p className="font-sans text-[10px] uppercase tracking-widest text-[#1A1A1A]/50">
                {session?.createdAt 
                  ? new Date(session.createdAt).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })
                  : 'Active Archive'
                }
              </p>
            </div>

            {/* Expiry Pill */}
            {session && (
              <div className={`flex items-center gap-1.5 px-3 py-1.5 border font-sans text-[10px] uppercase tracking-widest font-semibold ${
                isExpired
                  ? 'border-red-600 bg-red-50 text-red-700'
                  : 'border-[#1A1A1A]/20 bg-white/80 text-[#1A1A1A]'
              }`}>
                <Clock className="w-3 h-3 text-[#1A1A1A]/70" />
                <span>
                  {isExpired 
                    ? (lang === 'vi' ? 'Hết hạn' : 'Expired')
                    : (lang === 'vi' ? `Còn: ${timeRemaining}` : `Exp: ${timeRemaining}`)
                  }
                </span>
              </div>
            )}

            {/* Quick Session Lookup / Scan Button */}
            <button
              id="btn-open-lookup"
              onClick={onOpenLookup}
              className="flex items-center gap-1.5 px-3 py-2 font-sans text-[10px] uppercase tracking-widest font-bold text-[#1A1A1A] border border-[#1A1A1A]/30 hover:bg-[#1A1A1A] hover:text-white transition-colors cursor-pointer bg-white"
              title={lang === 'vi' ? 'Nhập mã hoặc quét QR khác' : 'Enter code or scan QR'}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>
                {session ? (lang === 'vi' ? 'Mã khác' : 'Code') : (lang === 'vi' ? 'Nhập mã' : 'Enter')}
              </span>
            </button>

            {/* Electron / Kiosk API Hub button */}
            <button
              id="btn-open-integration"
              onClick={onOpenIntegration}
              className="flex items-center gap-1.5 px-3 py-2 font-sans text-[10px] uppercase tracking-widest font-bold text-[#1A1A1A] bg-[#E5E2DD] hover:bg-[#1A1A1A] hover:text-white border border-[#1A1A1A]/20 transition-colors cursor-pointer"
              title="Electron App & Kiosk API Integration"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {lang === 'vi' ? 'Kiosk Dev' : 'Electron'}
              </span>
            </button>

            {/* Language Switcher */}
            <button
              id="btn-toggle-lang"
              onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')}
              className="px-2.5 py-1.5 font-sans text-[10px] uppercase tracking-widest font-bold text-[#1A1A1A] border border-[#1A1A1A]/20 hover:border-[#1A1A1A] bg-white transition-colors"
            >
              {lang === 'vi' ? 'EN' : 'VI'}
            </button>

            {/* Share Button */}
            {session && (
              <button
                id="btn-header-share"
                onClick={onShare}
                className="p-2 border border-[#1A1A1A]/30 bg-white hover:bg-[#1A1A1A] hover:text-white text-[#1A1A1A] transition-colors cursor-pointer"
                title={lang === 'vi' ? 'Chia sẻ' : 'Share'}
              >
                <Share2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

