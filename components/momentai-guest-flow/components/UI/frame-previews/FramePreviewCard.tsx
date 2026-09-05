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
  const photoKeys = photos
    .map((p, idx) =>
      p
        ? `${p.id || idx}_${p.width || 0}x${p.height || 0}_len${p.dataUrl?.length || 0}_${p.dataUrl?.slice(-24) || ''}`
        : `empty:${idx}`,
    )
    .join('|');
  const slotKeys = (template.slots || []).map((s) => `${s.id ?? ''}:${s.x}:${s.y}:${s.width}:${s.height}`).join(';');
  return `${template.id}_${template.updatedAt || '0'}_${template.outputWidth || 1800}x${template.outputHeight || 2700}_${overlayUrl}_${slotKeys}_[${photoKeys}]_${CROP_POLICY_VERSION}`;
}

export const isStripTemplate = (template: FrameTemplate): boolean => {
  if (template.layout?.type === '1x2' || template.layout?.type === '1x4') return true;
  const tp = (template as { targetProduct?: string }).targetProduct;
  if (tp) return isStripProduct(tp as CanonicalProduct);
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
  const isStripSession =
    session?.product?.outputType === 'STRIP_5X15' ||
    session?.product?.group === 'Photo Strip' ||
    session?.product?.id?.startsWith('STRIP') ||
    session?.product?.id === 'STRIP_4' ||
    session?.product?.id === 'STRIP_2';
  const isStrip = isStripSession || isStripTemplate(template);
  const rawW = template.outputWidth || (isStrip ? 900 : 1800);
  const rawH = template.outputHeight || 2700;
  const isLandscape = !isStrip && (template.orientation === 'landscape' || rawW > rawH);

  const defaultW = isStrip ? 900 : isLandscape ? 2700 : 1800;
  const defaultH = isStrip ? 2700 : isLandscape ? 1800 : 2700;

  let width: number;
  let height: number;

  if (rawH < 1800 || rawW < 600) {
    width = defaultW;
    height = defaultH;
  } else if (rawW > 2700 || rawH > 2700) {
    const scale = 2700 / Math.max(rawW, rawH);
    width = Math.round(rawW * scale);
    height = Math.round(rawH * scale);
    if (isStrip && width >= height * 0.45) {
      width = Math.round(height / 3);
    }
  } else {
    height = rawH;
    width = isStrip && rawW >= rawH * 0.45 ? Math.round(rawH / 3) : rawW;
  }
  const overlayUrl = template.assets?.overlay || ((template as unknown) as { assetUrl?: string }).assetUrl || '';

  const isThumbnailMode = mode === 'thumbnail' || className.includes('max-h-full');

  const photosList = session.slotAssignments && session.slotAssignments.length > 0
    ? session.slotAssignments
    : session.photos;

  const [composedDataUrl, setComposedDataUrl] = useState<string>('');
  const [isComposing, setIsComposing] = useState<boolean>(false);
  const requestIdRef = useRef<number>(0);

  useEffect(() => {
    if (isThumbnailMode) return;
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

    console.log('[FramePreviewCard] Rendering template:', template.id, 'photosList count:', photosList.length, photosList.map((p) => ({
      index: p?.index,
      dataUrlLength: p?.dataUrl?.length,
      preview: p?.dataUrl?.slice(0, 40),
    })));

    const isProduction = typeof process !== 'undefined' && process.env.NODE_ENV === 'production';
    const allowSampleFallback = !isProduction;

    renderFrameComposition({
      frame: { ...template, outputWidth: width, outputHeight: height },
      photos: photosList,
      overlayUrl,
      allowSampleFallback,
      signal: abortController.signal,
    })
      .then((result) => {
        if (requestIdRef.current !== currentRequestId || abortController.signal.aborted) return;
        const dataUrl = result.toDataURL('image/jpeg', 0.95);
        compositionCache.set(cacheKey, dataUrl);
        setComposedDataUrl(dataUrl);
        setIsComposing(false);
      })
      .catch((err) => {
        if (requestIdRef.current !== currentRequestId || abortController.signal.aborted) return;
        if (err?.name === 'AbortError') return;
        console.warn('[FramePreviewCard] Composition error:', err);
        setIsComposing(false);
      });

    return () => {
      abortController.abort();
    };
  }, [template, photosList, drawDataUrl, overlayUrl, isThumbnailMode]);

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
          <div className="w-full h-full bg-[#f4f2ee] p-2 flex flex-col items-center justify-between text-center relative">
            <div className="w-full flex-1 relative my-1">
              {(template.slots || []).map((slot, sIdx) => {
                const isUnit = slot.width <= 1;
                const sx = isUnit ? slot.x * 100 : slot.x;
                const sy = isUnit ? slot.y * 100 : slot.y;
                const sw = isUnit ? slot.width * 100 : slot.width;
                const sh = isUnit ? slot.height * 100 : slot.height;
                return (
                  <div
                    key={sIdx}
                    className="absolute bg-white border border-[#1A1A1A]/20 rounded-2xs flex items-center justify-center text-[8px] font-mono text-gray-400"
                    style={{
                      left: `${sx}%`,
                      top: `${sy}%`,
                      width: `${sw}%`,
                      height: `${sh}%`,
                    }}
                  >
                    #{sIdx + 1}
                  </div>
                );
              })}
            </div>
            <span className="text-[10px] font-mono font-bold text-[#1a1a1a]/70 truncate max-w-full px-1">
              {template.name}
            </span>
          </div>
        )}
      </div>
    );
  }

  // ── 2. Large Selected Preview Mode: Shared Canvas renderFrameComposition ──

  return (
    <div
      key={template.id}
      className={`mx-auto relative overflow-hidden rounded-xs flex items-center justify-center border border-[#1A1A1A]/15 shrink-0 ${
        isLandscape
          ? 'w-full max-w-full h-auto max-h-[64vh] xl:max-h-[70vh] shadow-[0_8px_30px_rgba(0,0,0,0.22)]'
          : 'h-[64vh] xl:h-[72vh] max-h-[76vh] max-w-full w-auto shadow-[0_8px_30px_rgba(0,0,0,0.22)]'
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
          style={{ imageRendering: '-webkit-optimize-contrast' }}
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
