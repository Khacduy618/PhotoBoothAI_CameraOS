import React, { useState } from 'react';
import { Download, Maximize2, Sparkles, Image as ImageIcon } from 'lucide-react';
import { PhotoboothMedia, PhotoboothSession } from '../types';
import { downloadMediaFile } from '../utils/downloadHelpers';

interface RawPhotosGalleryProps {
  session: PhotoboothSession;
  onOpenLightbox: (url: string, title: string, type?: 'image') => void;
  lang: 'vi' | 'en';
}

export const RawPhotosGallery: React.FC<RawPhotosGalleryProps> = ({
  session,
  onOpenLightbox,
  lang
}) => {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownloadSingle = async (photo: PhotoboothMedia, index: number) => {
    setDownloadingId(photo.id || `raw-${index}`);
    await downloadMediaFile(photo.url, photo.name || `Photo_Raw_${index + 1}_${session.code}.jpg`);
    setDownloadingId(null);
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Editorial Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-2 pb-4 border-b border-[#1A1A1A]/10">
        <div>
          <h3 className="font-serif-display text-xl sm:text-2xl font-bold text-[#1A1A1A] uppercase tracking-tight">
            {lang === 'vi' ? 'Bộ sưu tập ảnh đơn gốc' : 'Raw Snapshot Archive'}
          </h3>
          <p className="font-sans text-[11px] uppercase tracking-widest text-[#1A1A1A]/60 mt-1">
            {lang === 'vi'
              ? 'Tất cả các khoảnh khắc chụp chưa qua đóng khung, giữ nguyên độ phân giải cao nhất.'
              : 'All captured snapshot takes before framing, full original resolution.'
            }
          </p>
        </div>
        <span className="font-sans text-[10px] uppercase tracking-widest font-bold px-3 py-1.5 bg-[#E5E2DD] text-[#1A1A1A] border border-[#1A1A1A]/10 shrink-0 self-start sm:self-auto">
          {session.rawPhotos.length} {lang === 'vi' ? 'Bản ghi' : 'Shots'}
        </span>
      </div>

      {/* Grid of Raw Photos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {session.rawPhotos.map((photo, index) => {
          const isDownloading = downloadingId === (photo.id || `raw-${index}`);
          return (
            <div
              key={photo.id || index}
              className="group relative bg-white border border-[#1A1A1A]/15 shadow-xs hover:border-[#1A1A1A] transition-colors"
            >
              {/* Photo Box */}
              <div
                onClick={() => onOpenLightbox(photo.url, `Ảnh đơn gốc #${index + 1} - ${session.boothName}`)}
                className="relative aspect-4/3 overflow-hidden bg-stone-100 cursor-pointer border-b border-[#1A1A1A]/10"
              >
                <img
                  src={photo.url}
                  alt={photo.name || `Shot ${index + 1}`}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />

                <div className="absolute inset-0 bg-[#1A1A1A]/0 group-hover:bg-[#1A1A1A]/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <span className="px-3.5 py-2 bg-[#1A1A1A] text-white font-sans text-[10px] uppercase tracking-widest font-bold flex items-center gap-1.5 shadow-lg">
                    <Maximize2 className="w-3.5 h-3.5" />
                    {lang === 'vi' ? 'Phóng to xem HD' : 'View Full High-Res'}
                  </span>
                </div>

                <div className="absolute top-3 left-3 px-2 py-1 bg-[#1A1A1A]/85 text-white font-mono text-[9px] uppercase tracking-wider">
                  TAKE 0{index + 1}
                </div>
              </div>

              {/* Card Footer with Download Button */}
              <div className="p-4 bg-white flex items-center justify-between gap-3">
                <div className="truncate">
                  <p className="font-sans text-xs font-bold text-[#1A1A1A] uppercase tracking-wider truncate">
                    {photo.name || `Shot_${index + 1}_${session.code}.jpg`}
                  </p>
                  <p className="font-mono text-[10px] text-[#1A1A1A]/50 mt-0.5">
                    {photo.width ? `${photo.width} × ${photo.height} px` : 'Original HD Resolution'}
                  </p>
                </div>

                <button
                  id={`btn-download-raw-${index}`}
                  onClick={() => handleDownloadSingle(photo, index)}
                  disabled={isDownloading}
                  className="px-3.5 py-2 font-sans font-bold text-[10px] uppercase tracking-widest text-[#1A1A1A] bg-[#E5E2DD] hover:bg-[#1A1A1A] hover:text-white border border-[#1A1A1A]/20 flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
                >
                  <Download className={`w-3.5 h-3.5 ${isDownloading ? 'animate-bounce' : ''}`} />
                  <span>
                    {isDownloading
                      ? (lang === 'vi' ? 'Đang tải...' : 'Downloading...')
                      : (lang === 'vi' ? 'Tải ảnh này' : 'Download')
                    }
                  </span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

