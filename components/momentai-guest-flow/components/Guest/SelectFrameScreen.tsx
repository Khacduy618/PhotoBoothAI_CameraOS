import React, { useState, useEffect, useMemo } from 'react';
import { FrameTemplate, SessionData } from '../../types';
import { LocalFrameRegistry } from '@/services/frame/local-frame-registry';
import { mapImportedFrameDefinitionToFrameTemplate } from '../../momentai-guest-flow-controller';
import { Check, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { FramePreviewCard, isStripTemplate } from '../UI/frame-previews/FramePreviewCard';
import { GuestBottomNavigation } from '../UI/GuestBottomNavigation';
import { HOI_AN_SAMPLE_PHOTOS } from '../../data/hoianSamplePhotos';

interface SelectFrameScreenProps {
  session: SessionData;
  customTemplates?: FrameTemplate[];
  onSelectFrame: (frame: FrameTemplate, selectedPhotoIndex?: number) => void;
  onBackToShots?: () => void;
}

export const SelectFrameScreen: React.FC<SelectFrameScreenProps> = ({
  session,
  customTemplates,
  onSelectFrame,
  onBackToShots,
}) => {
  const [registryTemplates, setRegistryTemplates] = useState<FrameTemplate[]>([]);

  useEffect(() => {
    const updateFromRegistry = async () => {
      await LocalFrameRegistry.refreshFromAdminDb().catch(() => undefined);
      const defs = LocalFrameRegistry.getPublishedDefinitions();
      const mapped = defs.map(mapImportedFrameDefinitionToFrameTemplate);
      setRegistryTemplates(mapped);
    };

    void updateFromRegistry();
    return LocalFrameRegistry.subscribe(() => {
      const defs = LocalFrameRegistry.getPublishedDefinitions();
      const mapped = defs.map(mapImportedFrameDefinitionToFrameTemplate);
      setRegistryTemplates(mapped);
    });
  }, []);

  const isPremiumProduct = session.product?.premium === true || session.product?.id === 'PREMIUM_POSTCARD';

  // Build combined available frame templates list from imported Admin DB definitions
  const allTemplates = useMemo(() => {
    const custom = customTemplates || [];
    const map = new Map<string, FrameTemplate>();
    [...registryTemplates, ...custom].forEach((t) => {
      map.set(t.id, t);
    });
    return Array.from(map.values());
  }, [customTemplates, registryTemplates]);

  const isStripProduct =
    session.product?.outputType === 'STRIP_5X15' ||
    session.product?.group === 'Photo Strip' ||
    session.product?.id?.startsWith('STRIP') ||
    session.product?.id === 'STRIP_4' ||
    session.product?.id === 'STRIP_2';

  const isSheetProduct =
    session.product?.outputType === 'SHEET_10X15' ||
    session.product?.group === 'Photo Sheet' ||
    session.product?.id?.startsWith('SHEET') ||
    session.product?.id === 'SHEET_4' ||
    session.product?.id === 'SHEET_6';

  const requiredShots = session.product?.requiredShots || session.captureCount || 4;

  // Filter templates matching current product specs strictly!
  const validTemplates = useMemo(() => {
    const filtered = allTemplates.filter((t) => {
      const isTemplateStrip = isStripTemplate(t);
      const templateSlotCount = t.slots?.length || t.shotCount || t.layout?.slotCount || 4;
      const targetProduct = (t as { targetProduct?: string }).targetProduct;

      if (isPremiumProduct) {
        return (targetProduct === 'PREMIUM_POSTCARD' || !isTemplateStrip) && templateSlotCount === 1;
      }

      if (isStripProduct) {
        return (targetProduct === session.product?.id || isTemplateStrip) && templateSlotCount === requiredShots;
      }

      if (isSheetProduct) {
        return (targetProduct === session.product?.id || !isTemplateStrip) && templateSlotCount === requiredShots;
      }

      return templateSlotCount === requiredShots;
    });

    if (filtered.length > 0) return filtered;

    return allTemplates.filter((t) => (t.slots?.length || t.shotCount || t.layout?.slotCount) === requiredShots);
  }, [allTemplates, isPremiumProduct, isStripProduct, isSheetProduct, requiredShots]);

  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(
    validTemplates.length > 0 ? validTemplates[0].id : null
  );
  const [selectedPhotoIdx, setSelectedPhotoIdx] = useState<number>(session.selectedPhotoIndex ?? 0);
  const [activeCategory, setActiveCategory] = useState<string>('ALL');

  const categoryFilters = useMemo(
    () => ['ALL', ...Array.from(new Set(validTemplates.map((template) => template.category)))],
    [validTemplates]
  );

  const filteredTemplates = useMemo(
    () =>
      activeCategory === 'ALL'
        ? validTemplates
        : validTemplates.filter((template) => template.category === activeCategory),
    [validTemplates, activeCategory]
  );

  const visibleTemplates = filteredTemplates.length > 0 ? filteredTemplates : validTemplates;
  const selectedTemplate =
    validTemplates.find((t) => t.id === selectedFrameId) || visibleTemplates[0] || validTemplates[0];

  // Update session slotAssignments for preview if Premium
  const sessionForPreview: SessionData = useMemo(() => {
    if (!isPremiumProduct || session.photos.length === 0) return session;
    const chosenPhoto = session.photos[selectedPhotoIdx] || session.photos[0];
    return {
      ...session,
      slotAssignments: [chosenPhoto],
    };
  }, [session, isPremiumProduct, selectedPhotoIdx]);

  const handleContinue = () => {
    if (selectedTemplate) {
      onSelectFrame(selectedTemplate, isPremiumProduct ? selectedPhotoIdx : undefined);
    }
  };

  return (
    <div className="w-full h-screen flex flex-col justify-between px-4 py-3 sm:px-8 sm:py-5 bg-[#FDFCFB] text-[#1A1A1A] select-none overflow-hidden">
      {/* Top Header - Left Aligned */}
      <div className="w-full max-w-[98%] mx-auto flex flex-col items-start text-left mb-1">
        <h2 className="text-3xl sm:text-5xl font-serif tracking-tight text-[#1A1A1A]">CHỌN MẪU KHUNG</h2>
        <p className="text-xs sm:text-sm opacity-75 mt-0.5 font-sans max-w-2xl">
          {isPremiumProduct
            ? 'Gói Premium Postcard: Chọn 1 ảnh đẹp nhất trong 3 ảnh đã chụp & Mẫu bưu thiếp 10×15.'
            : `Gói đã chọn: ${session.product?.name || 'Đã chọn'} (${
                isStripProduct ? `${requiredShots} Ô Dải Strip 5x15cm` : `${requiredShots} Ô Tấm Sheet 10x15cm`
              }).`}
        </p>
      </div>

      {/* Main Grid: 50%/50% for Premium Postcard, 5:7 (41.6%/58.3%) for Strip & Sheet products */}
      <div
        className={`w-full max-w-[98%] mx-auto flex-1 grid grid-cols-1 lg:grid-cols-12 my-auto py-1 items-center overflow-hidden ${
          isPremiumProduct ? 'gap-6 xl:gap-8' : 'gap-4 xl:gap-5'
        }`}
      >
        {/* Live Preview Display Card */}
        <div
          className={`${
            isPremiumProduct ? 'lg:col-span-6 xl:col-span-6' : 'lg:col-span-5 xl:col-span-5'
          } w-full h-full flex flex-col items-center justify-center order-2 lg:order-1 p-1`}
        >
          {selectedTemplate && (
            <motion.div
              key={selectedTemplate.id}
              initial={{ opacity: 0, scale: 0.99 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              className="w-full h-full flex flex-col items-center justify-center relative"
            >
              <FramePreviewCard template={selectedTemplate} session={sessionForPreview} />
            </motion.div>
          )}
        </div>

        {/* Right column: premium photo picker, filter, template list */}
        <div
          className={`${
            isPremiumProduct ? 'lg:col-span-6 xl:col-span-6' : 'lg:col-span-7 xl:col-span-7'
          } order-1 lg:order-2 flex min-h-[68vh] flex-col justify-between`}
        >
          <div>
            {/* PREMIUM 1-OF-3 PHOTO SELECTOR STRIP */}
            {isPremiumProduct && session.photos.length > 0 && (
              <div className="mb-2 p-2 rounded-md bg-[#FFF9F0] border border-[#f59e0b]/40">
                <div className="mb-1 text-[11px] font-black uppercase text-[#f59e0b] tracking-wider">
                  CHỌN 1 ẢNH CHÍNH CHO BƯU THIẾP (3 SHOTS)
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {session.photos.map((photo, index) => {
                    const isPhotoSelected = selectedPhotoIdx === index;
                    return (
                      <button
                        key={photo.id || index}
                        type="button"
                        onClick={() => setSelectedPhotoIdx(index)}
                        className={`relative aspect-[3/2] rounded-xs overflow-hidden border transition-all cursor-pointer bg-black/5 ${
                          isPhotoSelected
                            ? 'border-[#f59e0b] ring-2 ring-[#f59e0b]/40 shadow-xs scale-[1.01]'
                            : 'border-[#1A1A1A]/15 opacity-75 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={photo.dataUrl}
                          alt={`Shot ${index + 1}`}
                          className="w-full h-full object-contain bg-black/10"
                        />
                        {isPhotoSelected && (
                          <div className="absolute top-1 right-1 p-0.5 rounded-full bg-[#f59e0b] text-[#FDFCFB] shadow-xs">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Category Filter Nav Bar (Only show if multiple categories exist in valid list) */}
            {categoryFilters.length > 2 && (
              <nav
                className="mb-3 flex flex-wrap justify-start lg:justify-end gap-2 border-y border-[#1A1A1A]/10 py-2.5"
                aria-label="Lọc mẫu khung"
              >
                {categoryFilters.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setActiveCategory(category)}
                    className={`px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] border transition-colors rounded-xs cursor-pointer ${
                      activeCategory === category
                        ? 'bg-[#1A1A1A] text-[#FDFCFB] border-[#1A1A1A]'
                        : 'bg-[#F4F2EE] text-[#1A1A1A] border-[#1A1A1A]/15 hover:border-[#1A1A1A]/50'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </nav>
            )}
          </div>

          {/* Template Grid List - Taller height (max-h 64-72vh) ONLY for Non-Premium products */}
          <div
            className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3.5 sm:gap-4 items-start overflow-y-auto pr-1 flex-1 ${
              isPremiumProduct ? 'max-h-[46vh] xl:max-h-[56vh]' : 'max-h-[64vh] xl:max-h-[72vh]'
            }`}
          >
            {visibleTemplates.map((frame) => {
              const isSelected = selectedFrameId === frame.id;
              const isStrip = isStripTemplate(frame);

              return (
                <motion.button
                  type="button"
                  key={frame.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedFrameId(frame.id)}
                  aria-label={frame.name}
                  className={`relative overflow-hidden border-2 transition-all cursor-pointer rounded-xs p-1.5 flex flex-col items-center justify-start bg-transparent text-[#1A1A1A] ${
                    isSelected
                      ? 'border-[#10b981] shadow-lg ring-2 ring-[#10b981]'
                      : 'border-[#1A1A1A]/15 hover:border-[#1A1A1A]/60'
                  }`}
                >
                  <div className="w-full h-36 sm:h-40 relative flex items-center justify-center p-2 bg-[#1A1A1A]/5 rounded-xs overflow-hidden pointer-events-none">
                    <FramePreviewCard template={frame} session={sessionForPreview} mode="thumbnail" className="pointer-events-none shadow-xs" />
                  </div>

                  <div className="mt-2 w-full text-left">
                    <div className="text-[11px] font-serif font-bold truncate">{frame.name}</div>
                    <div className="text-[9px] opacity-70 font-mono flex items-center justify-between mt-0.5">
                      <span>{isStrip ? '5x15cm Strip' : '10x15cm Sheet'}</span>
                      <span>{frame.slots.length} Slots</span>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="absolute top-2 right-2 p-1 rounded-full bg-[#10b981] text-white shadow-xs z-30">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      {/* FIXED BOTTOM NAVIGATION AT SCREEN ROOT */}
      <GuestBottomNavigation
        onBack={onBackToShots}
        backText="QUAY LẠI CHỌN GÓI"
        onNext={handleContinue}
        nextText="TIẾP TỤC TRANG TRÍ"
        nextDisabled={!selectedTemplate}
      />
    </div>
  );
};
