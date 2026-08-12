import React, { useState } from 'react';
import { FrameTemplate, SessionData } from '../../types';
import { DEFAULT_FRAME_TEMPLATES } from '../../data/defaultTemplates';
import { HOI_AN_SAMPLE_PHOTOS } from '../../data/hoianSamplePhotos';
import { Check, ArrowRight, ArrowLeft, Edit3, Type, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

interface SelectFrameScreenProps {
  session: SessionData;
  customTemplates?: FrameTemplate[];
  onSelectFrame: (frame: FrameTemplate) => void;
  onBackToShots?: () => void;
}

export const SelectFrameScreen: React.FC<SelectFrameScreenProps> = ({
  session,
  customTemplates,
  onSelectFrame,
  onBackToShots,
}) => {
  const allTemplates = customTemplates && customTemplates.length > 0 ? customTemplates : DEFAULT_FRAME_TEMPLATES;
  const shotCount = session.captureCount || 4;

  // Filter templates matching current shotCount
  const compatibleTemplates = allTemplates.filter(
    (t) => (t.shotCount === shotCount) || (t.layout.slotCount === shotCount)
  );

  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(
    compatibleTemplates.length > 0 ? compatibleTemplates[0].id : null
  );

  const selectedTemplate = compatibleTemplates.find((t) => t.id === selectedFrameId) || compatibleTemplates[0];

  const handleContinue = () => {
    if (selectedTemplate) {
      onSelectFrame(selectedTemplate);
    }
  };

  // Compute dynamic aspect ratio for template preview container based on layout / paper type
  const getTemplateAspectClass = (template: FrameTemplate) => {
    if (template.layout.type === '1x4' || template.preferredPaper === '2x6-double') {
      return 'aspect-[1/2] max-w-[280px]'; // Strip 2x6
    }
    if (template.layout.type === '1x1') {
      return 'aspect-[1/1] max-w-[340px]';
    }
    return 'aspect-[2/3] max-w-[340px]'; // Standard 4x6
  };

  return (
    <div className="w-full h-screen flex flex-col justify-between p-6 sm:p-8 bg-[#FDFCFB] text-[#1A1A1A] select-none overflow-y-auto">
      {/* Header */}
      <div className="w-full max-w-6xl mx-auto flex flex-col items-center text-center">
        <h2 className="text-3xl sm:text-5xl font-serif tracking-tight text-[#1A1A1A]">
          CHỌN MẪU KHUNG
        </h2>
        <p className="text-xs sm:text-sm opacity-75 mt-1 font-sans max-w-lg">
          Xem trước trực tiếp ảnh của bạn theo đúng tỉ lệ và bố cục vị trí khung mẫu.
        </p>
      </div>

      {/* Main Grid: Gallery on left/bottom, Responsive Live Preview on right/center */}
      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 my-auto py-4 items-center">
        {/* Template Gallery Thumbnails */}
        <div className="lg:col-span-5 flex lg:flex-col gap-3.5 overflow-x-auto lg:overflow-y-auto max-h-[460px] p-1">
          {compatibleTemplates.map((frame) => {
            const isSelected = selectedFrameId === frame.id;
            const hasText = frame.allowTyping;
            const hasDraw = frame.allowDraw;

            return (
              <motion.div
                key={frame.id}
                whileHover={{ scale: 1.01 }}
                onClick={() => setSelectedFrameId(frame.id)}
                className={`relative p-4 border-2 transition-all flex items-center justify-between gap-4 cursor-pointer min-w-[260px] sm:min-w-[300px] lg:min-w-0 rounded-xs ${
                  isSelected
                    ? 'border-[#1A1A1A] bg-[#1A1A1A] text-[#FDFCFB] shadow-md ring-2 ring-[#1A1A1A]'
                    : 'border-[#1A1A1A]/15 bg-[#F4F2EE] text-[#1A1A1A] hover:border-[#1A1A1A]/60'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-14 h-18 bg-[#E8E6E1] overflow-hidden border border-[#1A1A1A]/10 flex-shrink-0 shadow-xs">
                    <img src={frame.thumbnail} alt={frame.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="text-left">
                    <h4 className="font-serif italic text-lg leading-snug font-bold">{frame.name}</h4>
                    <span className="text-[10px] opacity-70 font-mono tracking-wider block font-medium">
                      {frame.eventBranding?.text || 'HỘI AN'} • {frame.layout.type || 'Standard'}
                    </span>
                    
                    {/* Editable Badges */}
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {hasText && hasDraw ? (
                        <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 tracking-wider uppercase border ${
                          isSelected ? 'bg-[#FDFCFB]/20 border-white/30 text-[#FDFCFB]' : 'bg-[#E8E6E1] border-[#1A1A1A]/10 text-[#1A1A1A]'
                        }`}>
                          <Edit3 className="w-2.5 h-2.5" />
                          <span>VẼ & THÊM CHỮ</span>
                        </span>
                      ) : hasText ? (
                        <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 tracking-wider uppercase border ${
                          isSelected ? 'bg-[#FDFCFB]/20 border-white/30 text-[#FDFCFB]' : 'bg-[#E8E6E1] border-[#1A1A1A]/10 text-[#1A1A1A]'
                        }`}>
                          <Type className="w-2.5 h-2.5" />
                          <span>THÊM CHỮ</span>
                        </span>
                      ) : hasDraw ? (
                        <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 tracking-wider uppercase border ${
                          isSelected ? 'bg-[#FDFCFB]/20 border-white/30 text-[#FDFCFB]' : 'bg-[#E8E6E1] border-[#1A1A1A]/10 text-[#1A1A1A]'
                        }`}>
                          <Edit3 className="w-2.5 h-2.5" />
                          <span>VẼ TAY</span>
                        </span>
                      ) : (
                        <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 tracking-wider uppercase border ${
                          isSelected ? 'bg-[#FDFCFB]/20 border-white/30 text-[#FDFCFB]' : 'bg-[#E8E6E1] border-[#1A1A1A]/10 text-[#1A1A1A]'
                        }`}>
                          <span>KHUNG CỔ ĐIỂN</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {isSelected && (
                  <div className="w-7 h-7 bg-[#FDFCFB] text-[#1A1A1A] flex items-center justify-center flex-shrink-0 rounded-xs shadow-xs">
                    <Check className="w-4 h-4 stroke-[3]" />
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Live Preview Display Card */}
        <div className="lg:col-span-7 flex flex-col items-center justify-center">
          {selectedTemplate && (
            <div className="w-full max-w-md bg-[#F4F2EE] border border-[#1A1A1A]/20 p-6 shadow-xl flex flex-col items-center rounded-xs">
              <span className="text-[11px] font-mono tracking-[0.2em] uppercase font-bold text-[#1A1A1A] mb-3 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>BẢN XEM TRƯỚC THEO TỈ LỆ KHUNG</span>
              </span>

              {/* Dynamic Responsive Template Container */}
              <div
                className={`w-full ${getTemplateAspectClass(selectedTemplate)} relative border border-[#1A1A1A]/30 shadow-md overflow-hidden my-1`}
                style={{ backgroundColor: selectedTemplate.assets.background || '#FDFCFB' }}
              >
                {/* Slots mapped dynamically based on slot x/y/width/height percentages from template */}
                {selectedTemplate.slots.map((slot, i) => {
                  const assignedPhoto = session.slotAssignments?.[i] || session.photos[i];
                  const photoUrl = assignedPhoto ? assignedPhoto.dataUrl : HOI_AN_SAMPLE_PHOTOS[i % HOI_AN_SAMPLE_PHOTOS.length];

                  return (
                    <div
                      key={slot.id || i}
                      className="absolute overflow-hidden border border-[#1A1A1A]/10 bg-[#E8E6E1] flex items-center justify-center pointer-events-none transition-all duration-300"
                      style={{
                        left: `${slot.x}%`,
                        top: `${slot.y}%`,
                        width: `${slot.width}%`,
                        height: `${slot.height}%`,
                        borderRadius: slot.borderRadius ? `${slot.borderRadius}px` : undefined,
                      }}
                    >
                      <img
                        src={photoUrl}
                        alt={`Photo slot ${i + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  );
                })}

                {/* Event Branding Overlay */}
                <div className="absolute inset-x-0 bottom-3 text-center py-1 z-10 pointer-events-none px-2">
                  <span
                    className="block font-serif italic text-base font-bold"
                    style={{ color: selectedTemplate.assets.textColor || '#1A1A1A' }}
                  >
                    {selectedTemplate.eventBranding?.text || 'PHỐ CỔ HỘI AN'}
                  </span>
                  <span
                    className="block text-[9px] font-mono opacity-75 font-medium"
                    style={{ color: selectedTemplate.assets.textColor || '#1A1A1A' }}
                  >
                    {selectedTemplate.eventBranding?.subtext || 'Kí Ức Di Sản'}
                  </span>
                </div>
              </div>

              {/* Template Feature Indicator */}
              {(selectedTemplate.allowTyping || selectedTemplate.allowDraw) && (
                <div className="mt-4 text-center text-[11px] font-mono text-[#1A1A1A] bg-[#E8E6E1] px-4 py-1.5 border border-[#1A1A1A]/15 font-medium rounded-xs">
                  ✨ Mẫu này cho phép vẽ tay & viết câu chúc cá nhân ở bước kế tiếp.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="w-full max-w-6xl mx-auto border-t border-[#1A1A1A]/10 pt-5 flex justify-between items-center">
        <button
          onClick={onBackToShots}
          className="px-6 py-3.5 border border-[#1A1A1A]/30 hover:border-[#1A1A1A] text-xs font-bold tracking-[0.2em] uppercase flex items-center gap-2 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>QUAY LẠI</span>
        </button>

        <button
          onClick={handleContinue}
          className="px-10 py-4 bg-[#1A1A1A] text-[#FDFCFB] hover:bg-[#333333] text-xs font-bold tracking-[0.25em] uppercase flex items-center gap-3 transition-colors shadow-md cursor-pointer rounded-xs"
        >
          <span>
            {selectedTemplate?.allowTyping || selectedTemplate?.allowDraw
              ? 'TIẾP TỤC (TÙY CHỈNH)'
              : 'TIẾP TỤC (XEM THÀNH PHẨM)'}
          </span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};



