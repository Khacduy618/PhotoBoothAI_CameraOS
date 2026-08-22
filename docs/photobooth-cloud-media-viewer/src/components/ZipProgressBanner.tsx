import React from 'react';
import { Download, Loader2, CheckCircle2 } from 'lucide-react';

interface ZipProgressBannerProps {
  isDownloading: boolean;
  progressPercent: number;
  statusText: string;
}

export const ZipProgressBanner: React.FC<ZipProgressBannerProps> = ({
  isDownloading,
  progressPercent,
  statusText
}) => {
  if (!isDownloading) return null;

  return (
    <div className="fixed bottom-6 inset-x-4 sm:inset-x-auto sm:right-6 sm:w-96 z-50 bg-[#1A1A1A] text-white p-4 border border-stone-800 shadow-2xl animate-in slide-in-from-bottom duration-200">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 font-sans text-[10px] uppercase tracking-widest font-bold text-[#F9F8F6]">
          {progressPercent < 100 ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-300" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          )}
          <span>{progressPercent < 100 ? 'Gom tệp & Đóng gói ZIP' : 'Hoàn tất tải về!'}</span>
        </div>
        <span className="font-mono text-[10px] font-bold text-[#E5E2DD]">{progressPercent}%</span>
      </div>

      <p className="font-sans text-xs text-[#E5E2DD]/70 mb-3 truncate">{statusText}</p>

      {/* Progress bar line */}
      <div className="w-full bg-white/20 h-1 overflow-hidden">
        <div
          className="bg-white h-full transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
};

