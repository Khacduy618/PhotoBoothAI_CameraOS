import React from 'react';
import { FrameTemplate, SessionData } from '../../../types';
import { HOI_AN_SAMPLE_PHOTOS } from '../../../data/hoianSamplePhotos';

interface FramePreview10x15GridProps {
  template: FrameTemplate;
  session: SessionData;
  drawDataUrl?: string;
  className?: string;
}

const normalizePercent = (val: number): number => (val <= 1 && val > 0 ? val * 100 : val);

export const FramePreview10x15Grid: React.FC<FramePreview10x15GridProps> = ({
  template,
  session,
  drawDataUrl,
  className = '',
}) => {
  const isDark = template.assets?.background === '#1A1A1A' || template.assets?.background === '#000000';
  const isLandscape = template.orientation === 'landscape';
  const aspectClass = isLandscape
    ? 'aspect-[3/2] h-[48vh] xl:h-[52vh] w-auto'
    : 'aspect-[2/3] h-[64vh] xl:h-[70vh] w-auto';
  const effectiveDrawUrl = drawDataUrl || session.drawDataUrl;

  return (
    <div
      className={`${aspectClass} mx-auto relative border border-[#1A1A1A]/15 shadow-[0_20px_50px_rgba(0,0,0,0.2)] overflow-hidden rounded-sm transition-all duration-300 ${className}`}
      style={{ backgroundColor: template.assets?.background || '#FDFCFB' }}
    >
      {/* 2x2 Grid Photo Slots */}
      {template.slots.map((slot, i) => {
        const assignedPhoto = session.slotAssignments?.[i] || session.photos?.[i];
        const photoUrl = assignedPhoto ? assignedPhoto.dataUrl : HOI_AN_SAMPLE_PHOTOS[i % HOI_AN_SAMPLE_PHOTOS.length];

        return (
          <div
            key={slot.id || i}
            className="absolute z-0 overflow-hidden bg-[#E8E6E1] flex items-center justify-center pointer-events-none transition-all duration-300 shadow-2xs"
            style={{
              left: `${normalizePercent(slot.x)}%`,
              top: `${normalizePercent(slot.y)}%`,
              width: `${normalizePercent(slot.width)}%`,
              height: `${normalizePercent(slot.height)}%`,
              borderRadius: slot.borderRadius ? `${slot.borderRadius}px` : undefined,
            }}
          >
            <img
              src={photoUrl}
              alt={`Slot ${i + 1}`}
              className="w-full h-full object-cover object-center"
            />
          </div>
        );
      })}

      {/* Frame Overlay Image */}
      {template.assets?.overlay && (
        <img
          src={template.assets.overlay}
          alt={template.name}
          className="absolute inset-0 z-10 w-full h-full object-contain pointer-events-none"
        />
      )}

      {/* Default Branding Subtext */}
      {!template.assets?.overlay && (
        <div className="absolute inset-x-0 bottom-4 text-center z-10 pointer-events-none px-4">
          <p className={`font-serif italic text-sm sm:text-base font-bold ${isDark ? 'text-[#FDFCFB]' : 'text-[#1A1A1A]'}`}>
            {template.eventBranding?.text || 'PHỐ CỔ HỘI AN'}
          </p>
          <p className={`text-[10px] font-mono tracking-widest uppercase opacity-70 mt-0.5 ${isDark ? 'text-[#FDFCFB]' : 'text-[#1A1A1A]'}`}>
            {template.eventBranding?.subtext || 'Tiệm Ảnh Di Sản • 2026'}
          </p>
        </div>
      )}

      {/* User Canvas Drawing */}
      {effectiveDrawUrl && (
        <img
          src={effectiveDrawUrl}
          alt="User Drawings"
          className="absolute inset-0 z-20 w-full h-full object-contain pointer-events-none"
        />
      )}
    </div>
  );
};
