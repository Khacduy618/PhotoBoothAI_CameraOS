import React from 'react';
import { FrameTemplate, SessionData } from '../../../types';
import { HOI_AN_SAMPLE_PHOTOS } from '../../../data/hoianSamplePhotos';
import { calculatePhotoLayerGeometry } from '../../../../../services/layout/frameGeometry';

export interface FramePreviewCardProps {
  template: FrameTemplate;
  session: SessionData;
  drawDataUrl?: string;
  className?: string;
  mode?: 'default' | 'thumbnail';
  debugScale?: number;
}

const normalizePercent = (val: number): number => (val <= 1 && val > 0 ? val * 100 : val);

export const isStripTemplate = (template: FrameTemplate): boolean => {
  const normSlots = template.slots || [];

  // Any template with 2 columns of slots (x >= 35%) or explicit 2x2/2x3 grid is a 10x15 Sheet/Grid, NEVER a 5x15 Strip!
  const hasSecondColumn = normSlots.some((s) => normalizePercent(s.x) >= 35);
  if (hasSecondColumn || template.layout?.type === '2x2' || template.layout?.type === '2x3') {
    return false;
  }

  if (
    (template as { targetProduct?: string }).targetProduct === 'STRIP_2' ||
    (template as { targetProduct?: string }).targetProduct === 'STRIP_4' ||
    template.category === 'STRIP' ||
    template.renderMode === 'double-strip' ||
    template.preferredPaper === '2x6-double' ||
    (template.preferredPaper as string) === '5x15' ||
    template.layout?.type === '1x4' ||
    template.layout?.type === '1x2'
  ) {
    return true;
  }

  const slotCount = normSlots.length || template.shotCount || template.layout?.slotCount || 4;
  return (slotCount === 2 || slotCount === 4) && normalizePercent(normSlots[0]?.width || 0) > 60;
};

export const FramePreviewCard: React.FC<FramePreviewCardProps> = ({
  template,
  session,
  drawDataUrl,
  className = '',
  mode = 'default',
  debugScale,
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const width = template.outputWidth || ((template as unknown) as { canvas?: { width?: number } }).canvas?.width || 1800;
  const height = template.outputHeight || ((template as unknown) as { canvas?: { height?: number } }).canvas?.height || 2700;
  const isLandscape = template.orientation === 'landscape' || width > height;
  const overlayUrl = template.assets?.overlay || ((template as unknown) as { assetUrl?: string }).assetUrl;
  const effectiveDrawUrl = drawDataUrl || session.drawDataUrl;

  const computedAspect = width / height;

  React.useEffect(() => {
    const domWidth = containerRef.current?.clientWidth || 0;
    const domHeight = containerRef.current?.clientHeight || 0;
    const domRatio = domHeight > 0 ? Number((domWidth / domHeight).toFixed(4)) : 0;
    const overlayNaturalW = overlayUrl ? 6000 : 0;
    const overlayNaturalH = overlayUrl ? 9000 : 0;

    console.log('[FrameGeometryVerification]', {
      templateId: template.id,
      templateName: template.name,
      canvas: { width, height, ratio: Number(computedAspect.toFixed(4)) },
      png: { naturalWidth: overlayNaturalW, naturalHeight: overlayNaturalH },
      previewDom: { width: domWidth, height: domHeight, ratio: domRatio },
      slots: template.slots.map((s, idx) => {
        const photoImg = containerRef.current?.querySelector(`img[alt="Photo Layer ${idx + 1}"]`) as HTMLImageElement | null;
        const geom = calculatePhotoLayerGeometry({
          canvasWidth: width,
          canvasHeight: height,
          slot: s,
          imageWidth: photoImg?.naturalWidth || 1920,
          imageHeight: photoImg?.naturalHeight || 1080,
        });
        return {
          slotIndex: idx + 1,
          slot: { x: geom.slotX, y: geom.slotY, width: geom.slotWidth, height: geom.slotHeight, centerX: geom.slotCenterX, centerY: geom.slotCenterY },
          photo: { x: geom.photoX, y: geom.photoY, width: geom.photoWidth, height: geom.photoHeight, centerX: geom.photoCenterX, centerY: geom.photoCenterY },
          verification: {
            centerErrorX: Math.abs(geom.photoCenterX - geom.slotCenterX),
            centerErrorY: Math.abs(geom.photoCenterY - geom.slotCenterY),
            coversSlotX: geom.photoWidth >= geom.slotWidth,
            coversSlotY: geom.photoHeight >= geom.slotHeight,
          },
        };
      }),
    });
  }, [template, width, height, computedAspect, isLandscape, overlayUrl, session]);

  const isThumbnailMode = mode === 'thumbnail' || className.includes('max-h-full');

  return (
    <div
      ref={containerRef}
      className={`mx-auto relative border border-[#1A1A1A]/15 shadow-md overflow-hidden rounded-xs flex items-center justify-center ${
        isThumbnailMode
          ? 'max-w-full max-h-full w-auto h-auto'
          : isLandscape
          ? 'w-full max-w-full h-auto max-h-[64vh]'
          : 'h-[64vh] xl:h-[70vh] max-w-full w-auto'
      } ${className}`}
      style={{
        aspectRatio: `${width} / ${height}`,
        backgroundColor: template.assets?.background && template.assets.background !== '#FDFCFB' ? template.assets.background : 'transparent',
      }}
    >
      {/* 1. Captured Photo Layers (Layer 0 - Underneath Frame PNG) */}
      <div className="absolute inset-0 z-0 overflow-visible pointer-events-none">
        {template.slots.map((slot, i) => {
          const assignedPhoto = session.slotAssignments?.[i] || session.photos?.[i];
          const photoUrl = assignedPhoto ? assignedPhoto.dataUrl : HOI_AN_SAMPLE_PHOTOS[i % HOI_AN_SAMPLE_PHOTOS.length];

          const photoImg = containerRef.current?.querySelector(`img[alt="Photo Layer ${i + 1}"]`) as HTMLImageElement | null;
          const imageW = assignedPhoto?.width || photoImg?.naturalWidth || 1920;
          const imageH = assignedPhoto?.height || photoImg?.naturalHeight || 1080;

          const activeDebugScale = debugScale || (typeof window !== 'undefined' ? (window as unknown as { __DEBUG_PHOTO_SCALE__?: number }).__DEBUG_PHOTO_SCALE__ : undefined);

          const geom = calculatePhotoLayerGeometry({
            canvasWidth: width,
            canvasHeight: height,
            slot,
            imageWidth: imageW,
            imageHeight: imageH,
            debugScale: activeDebugScale,
          });

          return (
            <img
              key={slot.id || i}
              src={photoUrl}
              alt={`Photo Layer ${i + 1}`}
              style={{
                position: 'absolute',
                left: `${geom.leftPct}%`,
                top: `${geom.topPct}%`,
                width: `${geom.widthPct}%`,
                height: `${geom.heightPct}%`,
                objectFit: 'fill',
              }}
              className="pointer-events-none"
            />
          );
        })}
      </div>

      {/* 2. Imported PNG Frame Overlay (Layer 10 - On Top) */}
      {overlayUrl && (
        <img
          src={overlayUrl}
          alt={template.name}
          className="absolute inset-0 z-10 w-full h-full object-fill pointer-events-none"
          onLoad={() => {
            console.log('[GuestFrameOverlayLoaded]', {
              templateId: template.id,
              name: template.name,
              overlayLength: overlayUrl.length,
            });
          }}
          onError={(err) => {
            console.error('[GuestFrameOverlayLoadFailed]', {
              templateId: template.id,
              name: template.name,
              overlaySnippet: overlayUrl.substring(0, 100),
              error: err,
            });
          }}
        />
      )}

      {/* 3. User Canvas Drawing Overlay (Layer 20 - Topmost) */}
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
