import React, { useState } from 'react';
import { X, Cloud, Link as LinkIcon, Check, Image as ImageIcon, Film, Sparkles } from 'lucide-react';
import { PhotoboothSession } from '../types';

interface CustomCloudLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyCustomCloud: (session: PhotoboothSession) => void;
  lang: 'vi' | 'en';
}

export const CustomCloudLinkModal: React.FC<CustomCloudLinkModalProps> = ({
  isOpen,
  onClose,
  onApplyCustomCloud,
  lang
}) => {
  const [photoUrl, setPhotoUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [boothName, setBoothName] = useState('CUSTOM CLOUD PHOTOBOOTH');
  const [sessionCode, setSessionCode] = useState(Math.floor(1000 + Math.random() * 9000).toString());

  if (!isOpen) return null;

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoUrl.trim()) return;

    const customSession: PhotoboothSession = {
      id: `PB-CUSTOM-${sessionCode}`,
      code: sessionCode,
      boothName: boothName.trim() || 'PHOTOBOOTH CLOUD',
      location: 'Custom Cloud Feed',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 48).toISOString(),
      stripMedia: {
        id: `strip-custom-${Date.now()}`,
        url: photoUrl.trim(),
        name: `CloudPhoto_${sessionCode}.jpg`,
        type: 'image',
        width: 1200,
        height: 3600
      },
      videoMedia: videoUrl.trim() ? {
        id: `video-custom-${Date.now()}`,
        url: videoUrl.trim(),
        name: `CloudVideo_${sessionCode}.mp4`,
        type: 'video',
        width: 1080,
        height: 1920
      } : undefined,
      rawPhotos: [
        {
          id: `raw-custom-1`,
          url: photoUrl.trim(),
          name: `CloudPhoto_${sessionCode}.jpg`,
          type: 'image'
        }
      ],
      metadata: {
        photographer: 'Cloud Webhook',
        filterApplied: 'Custom Direct Feed'
      }
    };

    onApplyCustomCloud(customSession);
    onClose();
  };

  const handleQuickDemo = () => {
    setPhotoUrl('https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1080&q=80');
    setVideoUrl('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4');
    setBoothName('MEMORIES STUDIO 4-CUTS');
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#1A1A1A]/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-[#F9F8F6] border border-[#1A1A1A] p-6 sm:p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#1A1A1A]/15">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#1A1A1A] text-white flex items-center justify-center">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif-display text-lg font-bold text-[#1A1A1A] uppercase tracking-tight">
                {lang === 'vi' ? 'Nhập Link 1 Ảnh & 1 Video từ Cloud' : 'Custom Cloud Media Feed'}
              </h3>
              <p className="font-sans text-[10px] uppercase tracking-widest text-[#1A1A1A]/60">
                {lang === 'vi' ? 'Dán trực tiếp URL ảnh và video từ Cloud storage' : 'Directly view custom Cloud photo & video'}
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

        {/* Form */}
        <form onSubmit={handleApply} className="py-6 space-y-4">
          
          <div>
            <label className="block font-sans text-[10px] uppercase tracking-widest font-bold text-[#1A1A1A] mb-1 flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5" />
              <span>{lang === 'vi' ? 'URL Ảnh (1 Photo từ Cloud) *' : 'Photo URL (1 Image from Cloud) *'}</span>
            </label>
            <input
              type="url"
              required
              placeholder="https://..."
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs border border-[#1A1A1A]/30 focus:outline-[#1A1A1A] bg-white font-mono"
            />
          </div>

          <div>
            <label className="block font-sans text-[10px] uppercase tracking-widest font-bold text-[#1A1A1A] mb-1 flex items-center gap-1.5">
              <Film className="w-3.5 h-3.5" />
              <span>{lang === 'vi' ? 'URL Video (1 Video MP4 từ Cloud)' : 'Video URL (1 MP4 Video from Cloud)'}</span>
            </label>
            <input
              type="url"
              placeholder="https://...mp4"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs border border-[#1A1A1A]/30 focus:outline-[#1A1A1A] bg-white font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-sans text-[10px] uppercase tracking-widest font-bold text-[#1A1A1A] mb-1">
                {lang === 'vi' ? 'Tên Photobooth' : 'Booth Name'}
              </label>
              <input
                type="text"
                value={boothName}
                onChange={(e) => setBoothName(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-[#1A1A1A]/30 focus:outline-[#1A1A1A] bg-white"
              />
            </div>
            <div>
              <label className="block font-sans text-[10px] uppercase tracking-widest font-bold text-[#1A1A1A] mb-1">
                {lang === 'vi' ? 'Mã Phiên' : 'Session Code'}
              </label>
              <input
                type="text"
                value={sessionCode}
                onChange={(e) => setSessionCode(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-[#1A1A1A]/30 focus:outline-[#1A1A1A] bg-white font-mono uppercase"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={handleQuickDemo}
              className="text-[10px] font-sans uppercase tracking-wider font-bold text-[#1A1A1A]/70 hover:text-[#1A1A1A] flex items-center gap-1 cursor-pointer underline"
            >
              <Sparkles className="w-3 h-3" />
              <span>{lang === 'vi' ? 'Điền mẫu thử nghiệm' : 'Fill Sample URLs'}</span>
            </button>
          </div>

          {/* Submit */}
          <div className="pt-4 border-t border-[#1A1A1A]/15 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border border-[#1A1A1A]/20 font-sans text-xs uppercase tracking-widest font-bold text-[#1A1A1A] cursor-pointer hover:bg-[#E5E2DD]"
            >
              {lang === 'vi' ? 'Hủy' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={!photoUrl.trim()}
              className="px-6 py-2.5 bg-[#1A1A1A] hover:bg-black disabled:opacity-50 text-white font-sans text-xs uppercase tracking-widest font-bold flex items-center gap-2 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{lang === 'vi' ? 'Hiển thị ngay' : 'Load to Landing Page'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
