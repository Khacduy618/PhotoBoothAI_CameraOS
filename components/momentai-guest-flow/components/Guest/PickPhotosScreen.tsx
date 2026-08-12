import React, { useState, useEffect } from 'react';
import { PhotoItem, SessionData, EventConfig } from '../../types';
import { compositionEngine } from '../../services/compositionEngine';
import { HOI_AN_SAMPLE_PHOTOS } from '../../data/hoianSamplePhotos';
import { Check, Trash2, ArrowRight, Sparkles, ArrowLeft } from 'lucide-react';

interface PickPhotosScreenProps {
  session: SessionData;
  eventConfig: EventConfig;
  onConfirmAssignments: (assignments: (PhotoItem | null)[]) => void;
  onBackToFrame?: () => void;
}

export const PickPhotosScreen: React.FC<PickPhotosScreenProps> = ({
  session,
  eventConfig,
  onConfirmAssignments,
  onBackToFrame,
}) => {
  const frame = session.selectedFrame!;

  // Fallback to sample photos if session photos are empty
  const availablePhotos: PhotoItem[] = (session.photos && session.photos.length > 0)
    ? session.photos
      : HOI_AN_SAMPLE_PHOTOS.map((url, i) => ({
        id: `sample-${i}`,
        index: i + 1,
        dataUrl: url,
        timestamp: new Date().toLocaleTimeString('vi-VN'),
      }));


  // Initialize assignments array matching frame slot count
  const [assignments, setAssignments] = useState<(PhotoItem | null)[]>(() => {
    if (session.slotAssignments && session.slotAssignments.length === frame.layout.slotCount && session.slotAssignments.some((p) => p !== null)) {
      return session.slotAssignments;
    }
    // Auto-fill initial slots in order
    return Array(frame.layout.slotCount)
      .fill(null)
      .map((_, i) => availablePhotos[i % availablePhotos.length] || null);
  });

  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [isRenderingPreview, setIsRenderingPreview] = useState<boolean>(false);

  // Re-render live composition preview whenever assignments change
  useEffect(() => {
    let isMounted = true;
    const updatePreview = async () => {
      setIsRenderingPreview(true);
      try {
        const res = await compositionEngine.renderComposition(
          frame,
          assignments,
          eventConfig,
          session.customText,
          session.drawDataUrl,
          1200,
          1800
        );
        if (isMounted) {
          setPreviewDataUrl(res.share);
        }
      } catch (err) {
        console.error('Preview error:', err);
      } finally {
        if (isMounted) setIsRenderingPreview(false);
      }
    };

    updatePreview();
    return () => {
      isMounted = false;
    };
  }, [assignments, frame, eventConfig, session.customText, session.drawDataUrl]);

  // Tap unselected photo -> find first empty slot or replace active slot
  const handlePhotoClick = (photo: PhotoItem) => {
    const existingIndex = assignments.findIndex((p) => p?.id === photo.id);

    if (activeSlotIndex !== null) {
      // Replace photo in activeSlotIndex
      const newAssignments = [...assignments];
      newAssignments[activeSlotIndex] = photo;
      setAssignments(newAssignments);
      setActiveSlotIndex(null);
      return;
    }

    if (existingIndex !== -1) {
      // Photo is already assigned, highlight that slot
      setActiveSlotIndex(existingIndex);
      return;
    }

    // Find first empty slot
    const firstEmptyIndex = assignments.findIndex((p) => p === null);
    if (firstEmptyIndex !== -1) {
      const newAssignments = [...assignments];
      newAssignments[firstEmptyIndex] = photo;
      setAssignments(newAssignments);
    }
  };

  const handleSlotClick = (slotIdx: number) => {
    if (activeSlotIndex === slotIdx) {
      setActiveSlotIndex(null);
    } else {
      setActiveSlotIndex(slotIdx);
    }
  };

  const handleRemoveFromSlot = (slotIdx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const newAssignments = [...assignments];
    newAssignments[slotIdx] = null;
    setAssignments(newAssignments);
    if (activeSlotIndex === slotIdx) setActiveSlotIndex(null);
  };

  const filledCount = assignments.filter((p) => p !== null).length;
  const isComplete = filledCount === frame.layout.slotCount;

  return (
    <div className="w-full h-screen flex flex-col justify-between p-4 sm:p-8 bg-[#FDFCFB] text-[#1A1A1A] select-none overflow-y-auto">
      {/* Header */}
      <div className="text-center z-10 mb-3">
        <h2 className="text-3xl sm:text-5xl font-serif tracking-tight text-[#1A1A1A]">
          SẮP XẾP BỐ CỤC ẢNH
        </h2>
        <p className="text-xs sm:text-sm opacity-75 mt-1">
          Chạm vào ảnh để tự động đưa vào khung, hoặc chọn ô vị trí để đổi ảnh khác.
        </p>
      </div>

      {/* Split View Layout */}
      <div className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 my-auto items-center">
        {/* LEFT PANEL: PHOTO POOL */}
        <div className="lg:col-span-5 bg-[#F4F2EE] border border-[#1A1A1A]/15 p-5 flex flex-col justify-between h-full max-h-[620px] rounded-xs shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#1A1A1A]/10 mb-4">
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-[#1A1A1A]">KHO ẢNH ĐÃ CHỤP ({availablePhotos.length})</h3>
            <span className="text-[10px] font-mono opacity-60 uppercase font-medium">Chạm để chọn</span>
          </div>

          <div className="grid grid-cols-3 gap-3 overflow-y-auto max-h-[460px] p-1">
            {availablePhotos.map((photo, idx) => {
              const assignedSlotIndex = assignments.findIndex((p) => p?.id === photo.id);
              const isAssigned = assignedSlotIndex !== -1;

              return (
                <div
                  key={photo.id}
                  onClick={() => handlePhotoClick(photo)}
                  className={`relative overflow-hidden border-2 cursor-pointer transition-all aspect-[4/3] bg-[#E8E6E1] rounded-xs ${
                    isAssigned
                      ? 'border-[#1A1A1A] opacity-65 ring-1 ring-[#1A1A1A]'
                      : 'border-[#1A1A1A]/20 hover:border-[#1A1A1A] hover:scale-[1.02]'
                  }`}
                >
                  <img
                    src={photo.dataUrl}
                    alt={`P${idx + 1}`}
                    className="w-full h-full object-cover"
                  />

                  <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-[#1A1A1A] text-[9px] font-mono text-[#FDFCFB] font-bold rounded-2xs">
                    P{idx + 1}
                  </div>

                  {isAssigned && (
                    <div className="absolute inset-0 bg-[#1A1A1A]/70 backdrop-blur-xs flex items-center justify-center font-bold text-[10px] text-[#FDFCFB] gap-1 font-mono uppercase tracking-wider">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>Ô {assignedSlotIndex + 1}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-[#1A1A1A]/10 text-[10px] font-mono opacity-70 text-center uppercase tracking-wider font-medium">
            {activeSlotIndex !== null
              ? `* Chọn 1 ảnh ở trên để thay vào Ô ${activeSlotIndex + 1}`
              : '* Chạm ảnh chưa dùng để tự động đưa vào ô trống kế tiếp'}
          </div>
        </div>

        {/* RIGHT PANEL: LIVE FRAME PREVIEW */}
        <div className="lg:col-span-7 bg-[#F4F2EE] border border-[#1A1A1A]/15 p-5 flex flex-col items-center justify-between h-full rounded-xs shadow-xs">
          <div className="w-full flex items-center justify-between pb-3 border-b border-[#1A1A1A]/10 mb-3">
            <h3 className="font-serif italic text-2xl text-[#1A1A1A] font-bold">
              {frame.name}
            </h3>
            <div className={`px-3.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider border rounded-2xs ${
              isComplete ? 'bg-[#1A1A1A] text-[#FDFCFB] border-[#1A1A1A]' : 'bg-[#E8E6E1] text-[#1A1A1A] border-[#1A1A1A]/20'
            }`}>
              {filledCount} / {frame.layout.slotCount} ĐÃ CHỌN
            </div>
          </div>

          {/* Canvas Rendered Preview */}
          <div className="relative w-full max-w-sm aspect-[2/3] bg-[#FDFCFB] overflow-hidden border border-[#1A1A1A]/20 flex items-center justify-center p-2 shadow-lg rounded-2xs">
            {previewDataUrl ? (
              <img
                src={previewDataUrl}
                alt="Live Composition Preview"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-[#1A1A1A]/50">
                <Sparkles className="w-6 h-6 animate-spin text-[#1A1A1A]" />
                <span className="text-[10px] font-mono uppercase tracking-widest">Đang tải bản xem trước...</span>
              </div>
            )}

            {/* Interactive Slot Touch Targets Overlaid */}
            <div className="absolute inset-2 pointer-events-auto">
              {frame.slots.map((slot, sIdx) => {
                const assignedPhoto = assignments[sIdx];
                const isActive = activeSlotIndex === sIdx;

                return (
                  <div
                    key={slot.id || sIdx}
                    onClick={() => handleSlotClick(sIdx)}
                    style={{
                      left: `${slot.x}%`,
                      top: `${slot.y}%`,
                      width: `${slot.width}%`,
                      height: `${slot.height}%`,
                      borderRadius: slot.borderRadius ? `${slot.borderRadius}px` : undefined,
                    }}
                    className={`absolute border cursor-pointer transition-all flex items-center justify-center overflow-hidden ${
                      isActive
                        ? 'border-[#1A1A1A] bg-[#1A1A1A]/20 z-20 ring-2 ring-[#1A1A1A]'
                        : assignedPhoto
                        ? 'border-[#1A1A1A]/20 hover:border-[#1A1A1A] bg-transparent'
                        : 'border-dashed border-[#1A1A1A]/60 bg-[#1A1A1A]/5 hover:bg-[#1A1A1A]/10'
                    }`}
                  >
                    {!assignedPhoto ? (
                      <div className="flex flex-col items-center p-1 text-center bg-white/80 p-1.5 rounded-2xs shadow-2xs">
                        <span className="text-[10px] font-bold text-[#1A1A1A] font-mono uppercase tracking-widest">
                          Ô {sIdx + 1}
                        </span>
                        <span className="text-[9px] font-mono opacity-70 uppercase font-medium">TRỐNG</span>
                      </div>
                    ) : (
                      <div className="absolute top-1 right-1 flex items-center gap-1 z-10">
                        <button
                          onClick={(e) => handleRemoveFromSlot(sIdx, e)}
                          className="w-6 h-6 bg-[#1A1A1A] text-[#FDFCFB] flex items-center justify-center hover:bg-rose-700 transition-colors shadow-sm rounded-2xs cursor-pointer"
                          title="Xóa khỏi ô"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Footer Button */}
          <div className="w-full mt-4 pt-4 border-t border-[#1A1A1A]/10 flex items-center justify-between gap-4">
            {onBackToFrame && (
              <button
                onClick={onBackToFrame}
                className="px-5 py-3 border border-[#1A1A1A]/30 text-[#1A1A1A] hover:border-[#1A1A1A] text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>QUAY LẠI</span>
              </button>
            )}

            <button
              disabled={!isComplete}
              onClick={() => onConfirmAssignments(assignments)}
              className={`flex-1 h-[52px] px-8 font-bold text-xs tracking-[0.2em] uppercase border flex items-center justify-center gap-3 transition-colors cursor-pointer rounded-xs ${
                isComplete
                  ? 'bg-[#1A1A1A] text-[#FDFCFB] border-[#1A1A1A] hover:bg-[#333333] shadow-md'
                  : 'bg-[#E8E6E1] text-[#1A1A1A]/40 border-[#1A1A1A]/10 cursor-not-allowed'
              }`}
            >
              <span>Tiếp Tục (Xem Thành Phẩm)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


