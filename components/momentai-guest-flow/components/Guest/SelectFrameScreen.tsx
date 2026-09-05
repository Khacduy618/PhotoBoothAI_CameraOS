import React, { useState, useEffect, useMemo } from 'react';
import { FrameTemplate, SessionData } from '../../types';
import { LocalFrameRegistry } from '@/services/frame/local-frame-registry';
import { mapImportedFrameDefinitionToFrameTemplate } from '../../momentai-guest-flow-controller';
import { Check, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { FramePreviewCard, isStripTemplate } from '../UI/frame-previews/FramePreviewCard';
import { GuestBottomNavigation } from '../UI/GuestBottomNavigation';
import { HOI_AN_SAMPLE_PHOTOS } from '../../data/hoianSamplePhotos';
import { DEFAULT_FRAME_TEMPLATES } from '../../data/defaultTemplates';

export function getSelectFrameLayoutPolicy(
  productType?: string,
  isStripFormat?: boolean,
  isPremiumProduct?: boolean
) {
  if (isStripFormat || productType === 'STRIP_2' || productType === 'STRIP_4') {
    return {
      leftPanelClass: 'lg:col-span-4 xl:col-span-4',
      rightPanelClass: 'lg:col-span-8 xl:col-span-8',
      gridColsClass: 'grid-cols-3 sm:grid-cols-6 lg:grid-cols-6 gap-2 sm:gap-2.5',
      targetPreviewRatio: 0.31,
      targetRightRatio: 0.69,
    };
  }

  if (isPremiumProduct) {
    return {
      leftPanelClass: 'lg:col-span-7 xl:col-span-6',
      rightPanelClass: 'lg:col-span-5 xl:col-span-6',
      gridColsClass: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3.5 sm:gap-4',
      targetPreviewRatio: 0.43,
      targetRightRatio: 0.57,
    };
  }

  return {
    leftPanelClass: 'lg:col-span-5 xl:col-span-5',
    rightPanelClass: 'lg:col-span-7 xl:col-span-7',
    gridColsClass: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3.5 sm:gap-4',
    targetPreviewRatio: 0.38,
    targetRightRatio: 0.62,
  };
}

interface SelectFrameScreenProps {
  session: SessionData;
  customTemplates?: FrameTemplate[];
  onSelectFrame: (frame: FrameTemplate, selectedPhotoIndex?: number) => void;
  onBackToShots?: () => void;
}

interface AdminEventItem {
  eventId: string;
  name: string;
}

export const SelectFrameScreen: React.FC<SelectFrameScreenProps> = ({
  session,
  customTemplates,
  onSelectFrame,
  onBackToShots,
}) => {
  const currentEventId = session.eventId || 'event_hoi_an_heritage';
  const [selectedEventFilter, setSelectedEventFilter] = useState<string>('all');
  const [eventsList, setEventsList] = useState<AdminEventItem[]>([]);

  const [registryTemplates, setRegistryTemplates] = useState<FrameTemplate[]>(() => {
    const initialDefs = LocalFrameRegistry.getPublishedDefinitions();
    return initialDefs.map(mapImportedFrameDefinitionToFrameTemplate);
  });

  useEffect(() => {
    const updateFromRegistry = async () => {
      await LocalFrameRegistry.refreshFromAdminDb().catch(() => undefined);
      const defs = LocalFrameRegistry.getPublishedDefinitions();
      setRegistryTemplates(defs.map(mapImportedFrameDefinitionToFrameTemplate));
    };

    const loadEvents = async () => {
      const bridge = (window as unknown as { momentai?: { admin?: { events?: { list: () => Promise<{ ok?: boolean; value?: AdminEventItem[] }> } } } }).momentai?.admin;
      if (bridge?.events?.list) {
        try {
          const res = await bridge.events.list();
          if (res?.ok && Array.isArray(res.value)) {
            setEventsList(res.value);
          }
        } catch {
          // Ignore
        }
      }
    };

    void updateFromRegistry();
    void loadEvents();

    return LocalFrameRegistry.subscribe(() => {
      const defs = LocalFrameRegistry.getPublishedDefinitions();
      setRegistryTemplates(defs.map(mapImportedFrameDefinitionToFrameTemplate));
    });
  }, [currentEventId]);

  const availableEvents = useMemo(() => {
    const eventMap = new Map<string, string>();
    eventMap.set('event_hoi_an_heritage', 'Phố Cổ Hội An');

    eventsList.forEach((e) => {
      if (e.eventId && e.name) eventMap.set(e.eventId, e.name);
    });

    registryTemplates.forEach((t) => {
      const eid = (t as { eventId?: string }).eventId;
      if (eid && !eventMap.has(eid)) {
        eventMap.set(eid, eid.replace(/^event_/, '').replace(/_/g, ' ').toUpperCase());
      }
    });

    return Array.from(eventMap.entries()).map(([eventId, name]) => ({ eventId, name }));
  }, [eventsList, registryTemplates]);

  const isPremiumProduct = session.product?.premium === true || session.product?.id === 'PREMIUM_POSTCARD';

  // Build combined available frame templates list from imported Admin DB definitions + fallback default seeds if DB is empty
  const allTemplates = useMemo(() => {
    const custom = customTemplates || [];
    if (registryTemplates.length > 0 || custom.length > 0) {
      const map = new Map<string, FrameTemplate>();
      [...registryTemplates, ...custom].forEach((t) => {
        map.set(t.id, t);
      });
      return Array.from(map.values());
    }
    return DEFAULT_FRAME_TEMPLATES;
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

  // Filter templates matching current product & selected event filter
  const validTemplates = useMemo(() => {
    const productFiltered = allTemplates.filter((t) => {
      const templateSlotCount = t.slots?.length || t.shotCount || t.layout?.slotCount || 4;
      const targetProduct = (t as { targetProduct?: string }).targetProduct;

      if (isPremiumProduct) {
        if (targetProduct) return targetProduct === 'PREMIUM_POSTCARD';
        return templateSlotCount === 1;
      }

      if (isStripProduct || isSheetProduct) {
        if (templateSlotCount !== requiredShots) return false;
        if (targetProduct) return targetProduct === session.product?.id;
        const isTemplateStrip = isStripTemplate(t);
        return isStripProduct ? isTemplateStrip : !isTemplateStrip;
      }

      return templateSlotCount === requiredShots;
    });

    // Apply Event filter if a specific event is selected
    if (selectedEventFilter !== 'all') {
      const eventFiltered = productFiltered.filter((t) => (t as { eventId?: string }).eventId === selectedEventFilter);
      if (eventFiltered.length > 0) {
        return eventFiltered;
      }
    }

    if (productFiltered.length === 0) {
      return allTemplates.filter(
        (t) => (t.slots?.length || t.shotCount || t.layout?.slotCount) === requiredShots,
      );
    }

    return productFiltered;
  }, [allTemplates, isPremiumProduct, isStripProduct, isSheetProduct, requiredShots, session.product?.id, selectedEventFilter]);

  const [selectedFrameId, setSelectedFrameId] = useState<string>(() => {
    return session.selectedFrame?.id || validTemplates[0]?.id || '';
  });
  const [selectedPhotoIdx, setSelectedPhotoIdx] = useState<number>(session.selectedPhotoIndex ?? 0);

  const visibleTemplates = validTemplates;

  useEffect(() => {
    if (visibleTemplates.length > 0 && (!selectedFrameId || !visibleTemplates.some((t) => t.id === selectedFrameId))) {
      setSelectedFrameId(visibleTemplates[0].id);
    }
  }, [visibleTemplates, selectedFrameId]);

  const selectedTemplate = useMemo(() => {
    return visibleTemplates.find((t) => t.id === selectedFrameId) || visibleTemplates[0] || allTemplates[0];
  }, [visibleTemplates, selectedFrameId, allTemplates]);

  const isStripFormat = isStripProduct || (selectedTemplate ? isStripTemplate(selectedTemplate) : false);
  const layoutPolicy = useMemo(() => {
    return getSelectFrameLayoutPolicy(session.product?.id, isStripFormat, isPremiumProduct);
  }, [session.product?.id, isStripFormat, isPremiumProduct]);

  const sessionForPreview: SessionData = useMemo(() => {
    if (!isPremiumProduct || session.photos.length === 0) return session;
    const chosenPhoto = session.photos[selectedPhotoIdx] || session.photos[0];
    return {
      ...session,
      photos: [chosenPhoto],
      slotAssignments: [chosenPhoto],
    };
  }, [session, isPremiumProduct, selectedPhotoIdx]);

  const handleContinue = () => {
    if (selectedTemplate) {
      onSelectFrame(selectedTemplate, isPremiumProduct ? selectedPhotoIdx : undefined);
    }
  };

  return (
    <div className="w-full h-screen bg-[#FDFCFB] flex flex-col justify-between p-3 sm:p-5 select-none overflow-hidden">
      {/* Top Header - Left Aligned */}
      <div className="w-full max-w-[99%] mx-auto flex flex-col items-start text-left flex-none mb-2">
        <h2 className="text-2xl sm:text-4xl font-serif tracking-tight text-[#1A1A1A]">CHỌN MẪU KHUNG</h2>
        <p className="text-xs sm:text-sm text-[#1A1A1A]/70 font-sans mt-0.5">
          {isPremiumProduct
            ? 'Gói Premium Postcard: Chọn 1 ảnh đẹp nhất trong 3 ảnh đã chụp & Mẫu bưu thiếp 10×15.'
            : `Gói đã chọn: ${session.product?.name || 'Photo Strip'} (${
                isStripProduct ? `${requiredShots} Ô Dải Strip 5x15cm` : `${requiredShots} Ô Tấm Sheet 10x15cm`
              }).`}
        </p>
      </div>

      {/* MAIN TWO-COLUMN WORKSPACE CONTAINER */}
      <div className="flex-1 max-w-[99%] w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4 items-start overflow-hidden min-h-0">
        {/* LEFT PREVIEW PANEL: Clean, No Gray BG, No Border, Only Soft Shadow */}
        <div
          className={`${layoutPolicy.leftPanelClass} h-full flex flex-col items-center justify-center bg-transparent p-1 overflow-hidden relative`}
        >
          {selectedTemplate ? (
            <FramePreviewCard key={selectedTemplate.id} template={selectedTemplate} session={sessionForPreview} mode="default" className={`shadow-lg drop-shadow-sm ${isPremiumProduct ? 'scale-[1]' : 'scale-[1.04]'}`} />
          ) : (
            <div className="text-center opacity-50 font-sans text-sm">Chưa chọn mẫu khung</div>
          )}
        </div>

        {/* RIGHT PANEL: TEMPLATE LIST GRID (FILTERED BY EVENT & PRODUCT) */}
        <div
          className={`${layoutPolicy.rightPanelClass} h-full flex flex-col justify-start overflow-hidden`}
        >
          {/* Event Filter Bar */}
          {availableEvents.length > 1 && (
            <div className="mb-2.5 flex-none flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#1A1A1A]/60 flex items-center gap-1 flex-none">
                <span>Sự Kiện:</span>
              </span>
              <button
                type="button"
                onClick={() => setSelectedEventFilter('all')}
                className={`px-3 py-1 rounded-full text-xs font-bold transition whitespace-nowrap cursor-pointer flex-none ${
                  selectedEventFilter === 'all'
                    ? 'bg-[#1A1A1A] text-[#FDFCFB] shadow-sm'
                    : 'bg-[#F4F2EE] text-[#1A1A1A]/70 hover:bg-[#eae7e1]'
                }`}
              >
                ✨ Tất Cả
              </button>
              {availableEvents.map((ev) => {
                const isEvSelected = selectedEventFilter === ev.eventId;
                return (
                  <button
                    key={ev.eventId}
                    type="button"
                    onClick={() => setSelectedEventFilter(ev.eventId)}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer flex-none ${
                      isEvSelected
                        ? 'bg-[#1A1A1A] text-[#F6C453] shadow-sm ring-1 ring-[#F6C453]/40'
                        : 'bg-[#F4F2EE] text-[#1A1A1A]/70 hover:bg-[#eae7e1]'
                    }`}
                  >
                    <span>🎪</span>
                    <span>{ev.name}</span>
                  </button>
                );
              })}
            </div>
          )}

          {isPremiumProduct && session.photos.length > 0 && (
            <div className="mb-3 flex-none bg-[#F4F2EE] p-2.5 rounded-xs border border-[#1A1A1A]/10">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#D97706] mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>CHỌN 1 ẢNH CHÍNH CHO BƯU THIẾP ({session.photos.length} SHOTS)</span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                {session.photos.map((photo, index) => {
                  const isPhotoSelected = selectedPhotoIdx === index;
                  return (
                    <button
                      key={photo.id || index}
                      type="button"
                      onClick={() => setSelectedPhotoIdx(index)}
                      className={`relative aspect-[3/2] overflow-hidden rounded-xs border-2 transition-all cursor-pointer ${
                        isPhotoSelected ? 'border-[#D97706] ring-2 ring-[#D97706]/40 scale-[1.02] shadow-sm' : 'border-transparent opacity-75 hover:opacity-100'
                      }`}
                    >
                      <img src={photo.dataUrl} alt={`Shot #${index + 1}`} className="w-full h-full object-cover" />
                      {isPhotoSelected && (
                        <div className="absolute top-1 right-1 bg-[#D97706] text-white rounded-full p-0.5 shadow-xs"><Check className="w-3 h-3 stroke-[3]" /></div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div
            className={`flex flex-wrap items-start justify-start gap-3.5 overflow-y-auto pt-3.5 pb-3 pl-[10px] pr-2 flex-1 ${
              isPremiumProduct ? 'max-h-[50vh] xl:max-h-[60vh]' : 'max-h-[76vh] xl:max-h-[82vh]'
            }`}
          >
            {visibleTemplates.map((frame) => {
              const isSelected = selectedFrameId === frame.id;
              const isLandscape = (frame.outputWidth || 1800) > (frame.outputHeight || 2700);

              return (
                <motion.button
                  type="button"
                  key={frame.id}
                  onClick={() => setSelectedFrameId(frame.id)}
                  className="cursor-pointer flex items-center justify-start bg-transparent p-0.5 focus:outline-none flex-none"
                >
                  <div
                    className={`relative flex items-center justify-center overflow-hidden rounded-xs transition-all border border-[#1A1A1A]/15 ${
                      isStripFormat
                        ? 'h-64 sm:h-72 xl:h-[68vh]'
                        : isLandscape
                        ? 'h-40 sm:h-48 xl:h-52'
                        : 'h-52 sm:h-60 xl:h-64'
                    } ${isSelected ? 'ring-3 ring-[#10b981] shadow-[0_10px_28px_rgba(16,185,129,0.35)] z-10 scale-[1.02]' : 'shadow-[0_6px_20px_rgba(0,0,0,0.16)] opacity-85 hover:opacity-100 hover:scale-[1.01] hover:shadow-[0_10px_25px_rgba(0,0,0,0.22)]'}`}
                  >
                    <FramePreviewCard template={frame} session={sessionForPreview} mode="thumbnail" className="h-full w-auto max-w-full max-h-full pointer-events-none object-contain" />
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      <GuestBottomNavigation
        onBack={onBackToShots}
        backText="QUAY LẠI"
        onNext={handleContinue}
        nextText="TIẾP TỤC TRANG TRÍ"
        nextDisabled={!selectedTemplate}
      />
    </div>
  );
};
