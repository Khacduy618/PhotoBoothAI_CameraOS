import React, { useState, useEffect, useRef } from 'react';
import { FrameTemplate, SessionData, PhotoItem } from '../../../types';
import { renderFrameComposition } from '@/services/render/frame-compositor.service';
import { isStripProduct, type CanonicalProduct } from '@/services/frame/resolveTargetProduct';

export interface FramePreviewCardProps {
  template: FrameTemplate;
  session: SessionData;
  drawDataUrl?: string;
  className?: string;
  mode?: 'default' | 'thumbnail';
  debugScale?: number;
}

// In-memory composition cache: Map<CompositionKey, string (dataUrl)>
const compositionCache = new Map<string, string>();
const CROP_POLICY_VERSION = 'cover-bottom-center-v1';

function buildCompositionKey(
  template: FrameTemplate,
  photos: readonly (PhotoItem | null)[],
  overlayUrl: string,
): string {
  const photoKeys = photos.map((p, idx) => (p ? `${p.id || idx}:${p.dataUrl?.substring(0, 32)}` : `empty:${idx}`)).join('|');
  const slotKeys = (template.slots || []).map((s) => `${s.id ?? ''}:${s.x}:${s.y}:${s.width}:${s.height}`).join(';');
  return `${template.id}_${template.updatedAt || '0'}_${template.outputWidth || 1800}x${template.outputHeight || 2700}_${overlayUrl}_${slotKeys}_[${photoKeys}]_${CROP_POLICY_VERSION}`;
}

export const isStripTemplate = (template: FrameTemplate): boolean => {
  const tp = (template as { targetProduct?: string }).targetProduct;
  if (tp) return isStripProduct(tp as CanonicalProduct);
  if (template.layout?.type === '1x2' || template.layout?.type === '1x4') return true;
  if (template.layout?.type === '2x2' || template.layout?.type === '2x3' || template.layout?.type === '1x1') return false;
  if (template.renderMode === 'double-strip' || template.preferredPaper === '2x6-double') return true;
  return false;
};

export function mapPhotosToFrameSlots<TPhoto, TSlot>(
  capturedPhotos: readonly TPhoto[],
  frameSlots: readonly TSlot[]
): Array<{ slot: TSlot; photo: TPhoto | null; slotIndex: number }> {
  return frameSlots.map((slot, index) => ({
    slot,
    photo: capturedPhotos[index] ?? null,
    slotIndex: index + 1,
  }));
}

export const FramePreviewCard: React.FC<FramePreviewCardProps> = ({
  template,
  session,
  drawDataUrl,
  className = '',
  mode = 'default',
}) => {
  const width = template.outputWidth || 1800;
  const height = template.outputHeight || 2700;
  const isLandscape = template.orientation === 'landscape' || width > height;
  const overlayUrl = template.assets?.overlay || ((template as unknown) as { assetUrl?: string }).assetUrl || '';

  const isThumbnailMode = mode === 'thumbnail' || className.includes('max-h-full');

  // ── 1. Thumbnail Mode: Raw Frame PNG ONLY (Zero customer photos, zero slots) ──
  if (isThumbnailMode) {
    return (
      <div
        className={`mx-auto relative overflow-hidden rounded-xs flex items-center justify-center border border-[#1A1A1A]/15 h-full max-h-full w-auto max-w-full shadow-[0_4px_16px_rgba(0,0,0,0.14)] ${className}`}
        style={{
          aspectRatio: `${width} / ${height}`,
          backgroundColor: template.assets?.background && template.assets.background !== '#FDFCFB' ? template.assets.background : 'transparent',
        }}
      >
        {overlayUrl ? (
          <img
            src={overlayUrl}
            alt={template.name}
            className="w-full h-full object-contain pointer-events-none"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-[#f4f2ee] flex items-center justify-center text-xs text-[#1a1a1a]/40">
            {template.name}
          </div>
        )}
      </div>
    );
  }

  // ── 2. Large Selected Preview Mode: Shared Canvas renderFrameComposition ──
  const photosList = session.slotAssignments && session.slotAssignments.length > 0
    ? session.slotAssignments
    : session.photos;

  const [composedDataUrl, setComposedDataUrl] = useState<string>('');
  const [isComposing, setIsComposing] = useState<boolean>(false);
  const requestIdRef = useRef<number>(0);

  useEffect(() => {
    const currentRequestId = ++requestIdRef.current;
    const abortController = new AbortController();

    const cacheKey = buildCompositionKey(template, photosList, overlayUrl);
    const cached = compositionCache.get(cacheKey);

    if (cached) {
      setComposedDataUrl(cached);
      setIsComposing(false);
      return () => {
        abortController.abort();
      };
    }

    setIsComposing(true);

    const isProduction = typeof process !== 'undefined' && process.env.NODE_ENV === 'production';
    const allowSampleFallback = !isProduction;

    renderFrameComposition({
      frame: template,
      photos: photosList,
      overlayUrl,
      allowSampleFallback,
      signal: abortController.signal,
    })
      .then((result) => {
        if (requestIdRef.current !== currentRequestId) return; // Stale async protection
        const dataUrl = result.toDataURL('image/jpeg', 0.90);
        compositionCache.set(cacheKey, dataUrl);
        setComposedDataUrl(dataUrl);
        setIsComposing(false);
      })
      .catch((err) => {
        if (requestIdRef.current !== currentRequestId) return;
        if (err?.name === 'AbortError') return;
        console.warn('[FramePreviewCard] Composition error:', err);
        setIsComposing(false);
      });

    return () => {
      abortController.abort();
    };
  }, [template, photosList, overlayUrl]);

  return (
    <div
      key={template.id}
      className={`mx-auto relative overflow-hidden rounded-xs flex items-center justify-center border border-[#1A1A1A]/15 ${
        isLandscape
          ? 'w-full max-w-full h-auto max-h-[72vh] shadow-[0_8px_30px_rgba(0,0,0,0.22)]'
          : 'h-[72vh] xl:h-[78vh] max-h-[80vh] max-w-full w-auto shadow-[0_8px_30px_rgba(0,0,0,0.22)]'
      } ${className}`}
      style={{
        aspectRatio: `${width} / ${height}`,
        backgroundColor: template.assets?.background && template.assets.background !== '#FDFCFB' ? template.assets.background : '#ffffff',
      }}
    >
      {/* 1. Composed Photo + Frame Canvas Output */}
      {composedDataUrl ? (
        <img
          src={composedDataUrl}
          alt={template.name}
          className="w-full h-full object-contain pointer-events-none select-none"
        />
      ) : isComposing ? (
        <div className="w-full h-full flex items-center justify-center bg-[#F4F2EE] text-sm text-[#1A1A1A]/50 animate-pulse">
          Đang tạo bản xem trước...
        </div>
      ) : null}

      {/* 2. Optional Guest Drawing Overlay (Layer 30) */}
      {drawDataUrl && (
        <img
          src={drawDataUrl}
          alt="Guest Drawing"
          className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none z-30"
        />
      )}
    </div>
  );
};
