import React, { useState } from 'react';
import { FrameTemplate, SessionData } from '../../types';
import { DEFAULT_FRAME_TEMPLATES } from '../../data/defaultTemplates';
import { HOI_AN_SAMPLE_PHOTOS } from '../../data/hoianSamplePhotos';
import { Check, ArrowRight, ArrowLeft } from 'lucide-react';
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
  const [activeCategory, setActiveCategory] = useState<string>('ALL');

  const categoryFilters = ['ALL', ...Array.from(new Set(compatibleTemplates.map((template) => template.category)))];
  const filteredTemplates = activeCategory === 'ALL'
    ? compatibleTemplates
    : compatibleTemplates.filter((template) => template.category === activeCategory);
  const visibleTemplates = filteredTemplates.length > 0 ? filteredTemplates : compatibleTemplates;
  const selectedTemplate = compatibleTemplates.find((t) => t.id === selectedFrameId) || visibleTemplates[0] || compatibleTemplates[0];

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
      {/* Main Grid: Preview left, title/filter/gallery right */}
      <div className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-10 gap-5 my-auto py-4 items-stretch">
        {/* Live Preview Display Card */}
        <div className="lg:col-span-3 flex flex-col items-center justify-center order-2 lg:order-1">
          {selectedTemplate && (
            <div className="w-full max-w-sm bg-[#F4F2EE] border border-[#1A1A1A]/12 p-2 shadow-lg flex flex-col items-center rounded-xs">
              <div
                className={`w-full ${getTemplateAspectClass(selectedTemplate)} relative overflow-hidden my-1`}
                style={{ backgroundColor: selectedTemplate.assets.background || '#FDFCFB' }}
              >
                {selectedTemplate.slots.map((slot, i) => {
                  const assignedPhoto = session.slotAssignments?.[i] || session.photos[i];
                  const photoUrl = assignedPhoto ? assignedPhoto.dataUrl : HOI_AN_SAMPLE_PHOTOS[i % HOI_AN_SAMPLE_PHOTOS.length];

                  return (
                    <div
                      key={slot.id || i}
                      className="absolute z-0 overflow-hidden bg-[#E8E6E1] flex items-center justify-center pointer-events-none transition-all duration-300"
                      style={{
                        left: `${slot.x}%`,
                        top: `${slot.y}%`,
                        width: `${slot.width}%`,
                        height: `${slot.height}%`,
                        borderRadius: slot.borderRadius ? `${slot.borderRadius}px` : undefined,
                      }}
                    >
                      <img src={photoUrl} alt={`Photo slot ${i + 1}`} className="w-full h-full object-cover" />
                    </div>
                  );
                })}

                {selectedTemplate.assets.overlay && (
                  <img
                    src={selectedTemplate.assets.overlay}
                    alt="Khung mẫu overlay"
                    className="absolute inset-0 z-20 h-full w-full object-fill pointer-events-none"
                  />
                )}
                {!selectedTemplate.assets.overlay && (
                  <div className="absolute inset-x-0 bottom-3 text-center py-1 z-10 pointer-events-none px-2">
                    <span className="block font-serif italic text-base font-bold" style={{ color: selectedTemplate.assets.textColor || '#1A1A1A' }}>
                      {selectedTemplate.eventBranding?.text || 'PHỐ CỔ HỘI AN'}
                    </span>
                    <span className="block text-[9px] font-mono opacity-75 font-medium" style={{ color: selectedTemplate.assets.textColor || '#1A1A1A' }}>
                      {selectedTemplate.eventBranding?.subtext || 'Kí Ức Di Sản'}
                    </span>
                  </div>
                )}
              </div>

              {selectedTemplate.allowDraw && (
                <div className="mt-3 text-center text-[11px] font-mono text-[#1A1A1A]/70 font-medium">
                  Có thể vẽ chữ trong khung này
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right column: title, event/category filter, template list */}
        <div className="lg:col-span-7 order-1 lg:order-2 flex min-h-[70vh] flex-col">
          <div className="mb-4 text-left lg:text-right">
            <h2 className="text-3xl sm:text-5xl font-serif tracking-tight text-[#1A1A1A]">
              CHỌN MẪU KHUNG
            </h2>
            <p className="ml-auto text-xs sm:text-sm opacity-75 mt-1 font-sans max-w-lg">
              Lọc theo event/category đã tạo ở phần upload khung.
            </p>
          </div>

          <nav className="mb-4 flex flex-wrap justify-start lg:justify-end gap-2 border-y border-[#1A1A1A]/10 py-3" aria-label="Lọc mẫu khung theo nhóm sự kiện">
            {categoryFilters.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={`px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.18em] border transition-colors rounded-xs ${
                  activeCategory === category
                    ? 'bg-[#1A1A1A] text-[#FDFCFB] border-[#1A1A1A]'
                    : 'bg-[#F4F2EE] text-[#1A1A1A] border-[#1A1A1A]/15 hover:border-[#1A1A1A]/50'
                }`}
              >
                {category}
              </button>
            ))}
          </nav>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5 overflow-y-auto pr-1 lg:max-h-[58vh]">
            {visibleTemplates.map((frame) => {
              const isSelected = selectedFrameId === frame.id;
              return (
                <motion.button
                  type="button"
                  key={frame.id}
                  whileHover={{ scale: 1.01 }}
                  onClick={() => setSelectedFrameId(frame.id)}
                  aria-label={frame.name}
                  className={`relative overflow-hidden border-2 transition-all cursor-pointer rounded-xs bg-[#F4F2EE] ${
                    isSelected
                      ? 'border-[#1A1A1A] shadow-md ring-2 ring-[#1A1A1A]'
                      : 'border-[#1A1A1A]/15 hover:border-[#1A1A1A]/60'
                  }`}
                >
                  <div className="aspect-[3/2] w-full bg-[#E8E6E1]">
                    {frame.thumbnail ? (
                      <img src={frame.thumbnail} alt={frame.name} className="h-full w-full object-contain" />
                    ) : (
                      <div className="grid h-full place-items-center text-[10px] font-mono opacity-40">FRAME</div>
                    )}
                  </div>
                  {isSelected && (
                    <div className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-[#1A1A1A] text-[#FDFCFB] shadow-xs">
                      <Check className="w-4 h-4 stroke-[3]" />
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>
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
          <span>TIẾP TỤC</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};



