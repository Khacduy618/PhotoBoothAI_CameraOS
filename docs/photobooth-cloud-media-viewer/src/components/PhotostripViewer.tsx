import React, { useState } from 'react';
import { Download, Maximize2, Share2, Sparkles, Palette, HelpCircle, Heart, Eye } from 'lucide-react';
import { PhotoboothSession } from '../types';
import { downloadMediaFile } from '../utils/downloadHelpers';

interface PhotostripViewerProps {
  session: PhotoboothSession;
  onOpenLightbox: (url: string, title: string, type?: 'image' | 'video') => void;
  onShare: () => void;
  lang: 'vi' | 'en';
}

const FRAME_THEMES = [
  { id: 'editorial_white', name: 'Trắng Sữa Báo Chí', nameEn: 'Editorial White', bg: 'bg-[#FFFFFF] text-[#1A1A1A]', border: 'border-[#1A1A1A]/20' },
  { id: 'noir_black', name: 'Đen Noir Paris', nameEn: 'Parisian Noir', bg: 'bg-[#1A1A1A] text-[#F9F8F6]', border: 'border-white/20' },
  { id: 'warm_linen', name: 'Linen Cổ Điển', nameEn: 'Raw Linen', bg: 'bg-[#E5E2DD] text-[#1A1A1A]', border: 'border-[#1A1A1A]/20' },
  { id: 'terracotta', name: 'Đất Nung Terracotta', nameEn: 'Terracotta', bg: 'bg-[#C87D65] text-[#FFFFFF]', border: 'border-white/20' },
  { id: 'sage_editorial', name: 'Xanh Sage Thanh Nhã', nameEn: 'Editorial Sage', bg: 'bg-[#A3B18A] text-[#1A1A1A]', border: 'border-[#1A1A1A]/20' },
  { id: 'deep_slate', name: 'Xanh Phiến Đá Slate', nameEn: 'Deep Slate', bg: 'bg-[#2F3E46] text-[#F9F8F6]', border: 'border-white/20' }
];

export const PhotostripViewer: React.FC<PhotostripViewerProps> = ({
  session,
  onOpenLightbox,
  onShare,
  lang
}) => {
  const [activeTheme, setActiveTheme] = useState(FRAME_THEMES[0]);
  const [downloading, setDownloading] = useState(false);
  const [filterStyle, setFilterStyle] = useState<'none' | 'bw' | 'warm' | 'cool'>('none');

  const photos = session.rawPhotos.length >= 4 
    ? session.rawPhotos.slice(0, 4) 
    : session.rawPhotos;

  const handleDownload = async () => {
    setDownloading(true);
    await downloadMediaFile(
      session.stripMedia.url,
      session.stripMedia.name || `Photostrip_${session.code}.jpg`
    );
    setDownloading(false);
  };

  const getFilterCss = () => {
    switch (filterStyle) {
      case 'bw': return 'grayscale contrast-110';
      case 'warm': return 'sepia-[0.25] saturate-110 contrast-105';
      case 'cool': return 'hue-rotate-15 saturate-110';
      default: return '';
    }
  };

  return (
    <div className="flex flex-col items-center">
      {/* Top Controls: Frame Theme & Filter */}
      <div className="w-full max-w-md mb-6 bg-white p-4 border border-[#1A1A1A]/10 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-sans text-[11px] uppercase tracking-widest font-bold text-[#1A1A1A]">
          <Palette className="w-3.5 h-3.5 text-[#1A1A1A]" />
          <span>{lang === 'vi' ? 'Khung in ấn:' : 'Frame Material:'}</span>
        </div>
        
        {/* Editorial Frame Palette Circles */}
        <div className="flex items-center gap-2">
          {FRAME_THEMES.map((theme) => (
            <button
              key={theme.id}
              onClick={() => setActiveTheme(theme)}
              className={`w-6 h-6 border transition-all cursor-pointer ${theme.bg} ${
                activeTheme.id === theme.id ? 'ring-2 ring-[#1A1A1A] scale-110' : 'opacity-70 hover:opacity-100'
              }`}
              title={lang === 'vi' ? theme.name : theme.nameEn}
            />
          ))}
        </div>
      </div>

      {/* The Iconic 4-Cut Photostrip Container (Editorial Fine Print Look) */}
      <div className="relative group p-2 bg-[#E5E2DD]/80 border border-[#1A1A1A]/10 shadow-lg">
        <div
          id="photostrip-canvas"
          className={`w-[290px] sm:w-[320px] p-5 transition-colors duration-300 ${activeTheme.bg} ${activeTheme.border} border`}
        >
          {/* Photostrip Header */}
          <div className="text-center pb-3 pt-1 border-b border-current/20 mb-3.5">
            <div className="font-serif-display text-sm tracking-widest uppercase font-bold">
              {session.boothName}
            </div>
            <div className="font-sans text-[9px] uppercase tracking-[0.25em] opacity-70 mt-1">
              {new Date(session.createdAt).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              })} • #{session.code}
            </div>
          </div>

          {/* 4 Photos Strip Body */}
          <div className="space-y-3">
            {photos.map((photo, index) => (
              <div
                key={photo.id || index}
                onClick={() => onOpenLightbox(photo.url, `Khung ảnh #${index + 1} - ${session.boothName}`)}
                className="relative group/photo overflow-hidden bg-stone-100 aspect-4/3 cursor-pointer border border-current/10"
              >
                <img
                  src={photo.url}
                  alt={`Shot ${index + 1}`}
                  referrerPolicy="no-referrer"
                  className={`w-full h-full object-cover transition-transform duration-500 group-hover/photo:scale-105 ${getFilterCss()}`}
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-[#1A1A1A]/0 group-hover/photo:bg-[#1A1A1A]/20 transition-colors flex items-center justify-center opacity-0 group-hover/photo:opacity-100">
                  <Maximize2 className="w-5 h-5 text-white drop-shadow-md" />
                </div>
                <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 bg-[#1A1A1A]/80 text-white font-mono text-[9px] uppercase tracking-wider">
                  0{index + 1}
                </div>
              </div>
            ))}
          </div>

          {/* Photostrip Footer Stamp & Barcode */}
          <div className="mt-4 pt-3 border-t border-current/20 text-center">
            <div className="flex items-center justify-between font-sans text-[9px] uppercase tracking-widest opacity-80 px-1 mb-2">
              <span className="font-bold">EDITORIAL EDITION</span>
              <span className="font-serif-sub italic font-bold">4-CUT STUDIO</span>
            </div>

            {/* Realistic Barcode Graphic */}
            <div className="h-6 flex items-center justify-center gap-0.5 opacity-60">
              {[4, 2, 1, 3, 1, 4, 2, 1, 3, 2, 4, 1, 3, 2, 1, 4, 2, 3, 1, 2, 4].map((h, i) => (
                <div
                  key={i}
                  className="bg-current"
                  style={{
                    width: `${(i % 3) + 1}px`,
                    height: `${12 + (h * 2.5)}px`
                  }}
                />
              ))}
            </div>
            <div className="font-mono text-[8px] opacity-60 tracking-widest mt-1">
              *{session.id}*
            </div>
          </div>
        </div>

        {/* Hover / Overlay Quick Preview Zoom Button */}
        <button
          onClick={() => onOpenLightbox(session.stripMedia.url, `Photostrip - ${session.boothName}`)}
          className="absolute top-4 right-4 p-2.5 bg-[#1A1A1A] text-white hover:bg-black transition-transform hover:scale-105 cursor-pointer shadow-md"
          title={lang === 'vi' ? 'Xem kích thước đầy đủ' : 'View full size'}
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Main Download & Action Controls */}
      <div className="w-full max-w-md mt-6 space-y-3">
        <button
          id="btn-download-photostrip"
          onClick={handleDownload}
          disabled={downloading}
          className="w-full py-4 px-6 font-sans font-bold text-xs uppercase tracking-widest bg-[#1A1A1A] hover:bg-black text-[#F9F8F6] shadow-sm flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] cursor-pointer"
        >
          <Download className={`w-4 h-4 text-rose-300 ${downloading ? 'animate-bounce' : ''}`} />
          <span>
            {downloading
              ? (lang === 'vi' ? 'Đang chuẩn bị tệp...' : 'Preparing Download...')
              : (lang === 'vi' ? 'Tải ảnh Photostrip (HD)' : 'Download Photostrip (HD)')
            }
          </span>
        </button>

        <div className="grid grid-cols-2 gap-3">
          <button
            id="btn-inspect-photostrip"
            onClick={() => onOpenLightbox(session.stripMedia.url, `Photostrip - ${session.boothName}`)}
            className="py-3 px-4 font-sans font-bold text-[11px] uppercase tracking-wider bg-white hover:bg-[#F9F8F6] border border-[#1A1A1A]/20 text-[#1A1A1A] flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Maximize2 className="w-3.5 h-3.5 text-[#1A1A1A]/70" />
            <span>{lang === 'vi' ? 'Phóng to ảnh' : 'Zoom View'}</span>
          </button>

          <button
            id="btn-share-photostrip"
            onClick={onShare}
            className="py-3 px-4 font-sans font-bold text-[11px] uppercase tracking-wider bg-white hover:bg-[#F9F8F6] border border-[#1A1A1A]/20 text-[#1A1A1A] flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5 text-[#1A1A1A]/70" />
            <span>{lang === 'vi' ? 'Chia sẻ' : 'Share'}</span>
          </button>
        </div>

        {/* Mobile helper tip */}
        <div className="p-3.5 bg-[#E5E2DD]/50 border border-[#1A1A1A]/10 font-sans text-xs text-[#1A1A1A]/80 leading-relaxed">
          <p>
            {lang === 'vi'
              ? '💡 Chạm và giữ vào ảnh để chọn "Lưu hình ảnh" trực tiếp vào Album ảnh điện thoại của bạn.'
              : '💡 Mobile Tip: Tap and hold the photo strip to save directly to your phone camera roll.'
            }
          </p>
        </div>
      </div>
    </div>
  );
};
