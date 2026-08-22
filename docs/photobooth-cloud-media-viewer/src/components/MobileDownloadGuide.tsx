import React from 'react';
import { X, Smartphone, Download, Share2, CheckCircle2, Image as ImageIcon, Film, HelpCircle } from 'lucide-react';

interface MobileDownloadGuideProps {
  isOpen: boolean;
  onClose: () => void;
  lang: 'vi' | 'en';
}

export const MobileDownloadGuide: React.FC<MobileDownloadGuideProps> = ({
  isOpen,
  onClose,
  lang
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#1A1A1A]/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-[#F9F8F6] border border-[#1A1A1A] p-6 sm:p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#1A1A1A]/15">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#1A1A1A] text-white flex items-center justify-center">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif-display text-lg sm:text-xl font-bold text-[#1A1A1A] uppercase tracking-tight">
                {lang === 'vi' ? 'Hướng dẫn lưu về Điện thoại' : 'Mobile Download Guide'}
              </h3>
              <p className="font-sans text-[10px] uppercase tracking-widest text-[#1A1A1A]/60">
                {lang === 'vi' ? 'Cách lưu ảnh & video vào Thư viện / Cuộn Camera' : 'How to save photo & video to Camera Roll'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 hover:bg-[#E5E2DD] text-[#1A1A1A] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="py-6 space-y-6">
          
          {/* iOS iPhone / iPad Guide */}
          <div className="p-4 bg-white border border-[#1A1A1A]/15 space-y-3">
            <div className="flex items-center gap-2 font-sans text-xs uppercase font-bold tracking-wider text-[#1A1A1A] border-b border-[#1A1A1A]/10 pb-2">
              <span className="w-2 h-2 rounded-full bg-[#1A1A1A]" />
              <span>{lang === 'vi' ? 'Dành cho iPhone / iPad (Safari & Chrome)' : 'For iPhone & iPad (iOS)'}</span>
            </div>
            
            <div className="space-y-2.5 text-xs text-[#1A1A1A]/80 font-sans leading-relaxed">
              <div className="flex items-start gap-2.5">
                <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 bg-[#E5E2DD] text-[#1A1A1A]">01</span>
                <p>
                  {lang === 'vi' 
                    ? 'Nhấn vào nút "Tải Ảnh Về Điện Thoại" hoặc "Tải Video MP4". Trình duyệt Safari sẽ hỏi cho phép tải tệp xuống.'
                    : 'Tap "Download Photo to Phone" or "Download MP4 Video". Safari will prompt to download the file.'
                  }
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 bg-[#E5E2DD] text-[#1A1A1A]">02</span>
                <p>
                  {lang === 'vi' 
                    ? 'Cách nhanh nhất để lưu ảnh: Chạm và Giữ ngón tay vào bức ảnh trên màn hình trong 1 giây -> Chọn "Lưu vào Ảnh" (Save to Photos).'
                    : 'Fastest way for photo: Touch & Hold the image on screen for 1 second -> Tap "Save to Photos".'
                  }
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 bg-[#E5E2DD] text-[#1A1A1A]">03</span>
                <p>
                  {lang === 'vi' 
                    ? 'Với video: Sau khi tải về mục Tải về của Safari, mở tệp video -> Nhấn biểu tượng Chia sẻ -> Chọn "Lưu video" để lưu vào Thư viện ảnh.'
                    : 'For video: Open the downloaded file in Safari Downloads -> Tap Share -> Select "Save Video" to save to Camera Roll.'
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Android Guide */}
          <div className="p-4 bg-white border border-[#1A1A1A]/15 space-y-3">
            <div className="flex items-center gap-2 font-sans text-xs uppercase font-bold tracking-wider text-[#1A1A1A] border-b border-[#1A1A1A]/10 pb-2">
              <span className="w-2 h-2 rounded-full bg-emerald-600" />
              <span>{lang === 'vi' ? 'Dành cho điện thoại Android (Samsung, Xiaomi, Oppo,...)' : 'For Android (Google Chrome / Samsung Internet)'}</span>
            </div>
            
            <div className="space-y-2.5 text-xs text-[#1A1A1A]/80 font-sans leading-relaxed">
              <div className="flex items-start gap-2.5">
                <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 bg-[#E5E2DD] text-[#1A1A1A]">01</span>
                <p>
                  {lang === 'vi' 
                    ? 'Nhấn nút "Tải Ảnh Về Điện Thoại" hoặc "Tải Video MP4". Trình duyệt Chrome sẽ tự động lưu tệp về thư mục Download.'
                    : 'Tap "Download Photo to Phone" or "Download MP4 Video". Chrome will automatically download the files to your device.'
                  }
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 bg-[#E5E2DD] text-[#1A1A1A]">02</span>
                <p>
                  {lang === 'vi' 
                    ? 'Tệp tải về sẽ tự động hiển thị trong ứng dụng "Bộ sưu tập" (Gallery) hoặc "Google Photos" của bạn.'
                    : 'Downloaded media will automatically appear in your Gallery or Google Photos app.'
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Cloud Retention note */}
          <div className="p-3.5 bg-[#E5E2DD]/50 border border-[#1A1A1A]/10 flex items-center gap-3">
            <CheckCircle2 className="w-4 h-4 text-[#1A1A1A] shrink-0" />
            <p className="font-sans text-[11px] text-[#1A1A1A]/70 leading-relaxed">
              {lang === 'vi'
                ? 'Dữ liệu từ Cloud Photobooth được giữ nguyên độ phân giải gốc cao nhất khi tải về.'
                : 'All media fetched from Cloud Photobooth preserves original full HD master quality.'
              }
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-[#1A1A1A]/15 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-[#1A1A1A] hover:bg-black text-white font-sans text-xs uppercase tracking-widest font-bold cursor-pointer"
          >
            {lang === 'vi' ? 'Đã hiểu' : 'Got it'}
          </button>
        </div>
      </div>
    </div>
  );
};
