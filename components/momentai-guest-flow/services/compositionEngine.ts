import { FrameTemplate, PhotoItem, EventConfig, PaperSize } from '../types';
import { isStripTemplate } from '../components/UI/frame-previews/FramePreviewCard';
import { renderFrameComposition, loadImage } from '@/services/render/frame-compositor.service';
import { buildPrintMaster } from '@/services/render/print-master.service';

export class CompositionEngine {
  public async renderComposition(
    frame: FrameTemplate,
    slotPhotos: (PhotoItem | null)[],
    eventConfig: EventConfig,
    customText?: string,
    drawDataUrl?: string,
    targetWidth: number = 1800,
    targetHeight: number = 2700,
    options?: { allowSampleFallback?: boolean; debugScale?: number }
  ): Promise<{ master: string; share: string; print: string }> {
    const isProduction = process.env.NODE_ENV === 'production' || (typeof window !== 'undefined' && (window as any).isProductionMode);
    const allowFallback = options?.allowSampleFallback ?? !isProduction;

    // Unified authoritative composition engine (Shared with Large Preview)
    const compositionResult = await renderFrameComposition({
      frame,
      photos: slotPhotos,
      allowSampleFallback: allowFallback,
    });

    const canvas = compositionResult.canvas;
    const ctx = canvas.getContext('2d')!;
    const overlayUrl = frame.assets?.overlay || (frame as any).assetUrl;
    const hasOverlayImage = !!overlayUrl;

    // 4. Draw Branding Fallback Text ONLY if NO overlay image is present
    if (!hasOverlayImage) {
      const branding = frame.eventBranding || {
        text: eventConfig.eventName || '',
        subtext: eventConfig.customTagline || '',
        showDate: true,
      };

      const isLandscape = canvas.width > canvas.height;
      const isStrip = isStripTemplate(frame);
      const scale = canvas.height / 2700;

      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = frame.assets.textColor || '#1A1A1A';

      if (isLandscape) {
        // Landscape (height e.g. 7392px): branding area at bottom
        ctx.font = `italic ${Math.round(38 * scale)}px "Playfair Display", serif`;
        ctx.fillText(branding.text, canvas.width / 2, Math.round(1660 * (canvas.height / 1800)));

        if (branding.subtext) {
          ctx.font = `${Math.round(22 * scale)}px "Plus Jakarta Sans", sans-serif`;
          ctx.fillStyle = frame.assets.textColor ? `${frame.assets.textColor}cc` : '#4b5563';
          ctx.fillText(branding.subtext, canvas.width / 2, Math.round(1705 * (canvas.height / 1800)));
        }

        if (branding.showDate) {
          const dateStr = new Date().toLocaleDateString('vi-VN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          });
          ctx.font = `${Math.round(18 * scale)}px monospace`;
          ctx.fillStyle = frame.assets.textColor ? `${frame.assets.textColor}88` : '#9ca3af';
          ctx.fillText(dateStr, canvas.width / 2, Math.round(1745 * (canvas.height / 1800)));
        }
      } else if (isStrip) {
        // Strip (height e.g. 10944px)
        ctx.font = `italic ${Math.round(36 * scale)}px "Playfair Display", serif`;
        ctx.fillText(branding.text, canvas.width / 2, Math.round(2520 * scale));

        if (branding.subtext) {
          ctx.font = `${Math.round(22 * scale)}px "Plus Jakarta Sans", sans-serif`;
          ctx.fillStyle = frame.assets.textColor ? `${frame.assets.textColor}cc` : '#4b5563';
          ctx.fillText(branding.subtext, canvas.width / 2, Math.round(2570 * scale));
        }

        if (branding.showDate) {
          const dateStr = new Date().toLocaleDateString('vi-VN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          });
          ctx.font = `${Math.round(18 * scale)}px monospace`;
          ctx.fillStyle = frame.assets.textColor ? `${frame.assets.textColor}88` : '#9ca3af';
          ctx.fillText(dateStr, canvas.width / 2, Math.round(2620 * scale));
        }
      } else {
        // Portrait Sheet (height e.g. 10944px)
        ctx.font = `italic ${Math.round(52 * scale)}px "Playfair Display", serif`;
        ctx.fillText(branding.text, canvas.width / 2, Math.round(2500 * scale));

        if (branding.subtext) {
          ctx.font = `${Math.round(30 * scale)}px "Plus Jakarta Sans", sans-serif`;
          ctx.fillStyle = frame.assets.textColor ? `${frame.assets.textColor}cc` : '#4b5563';
          ctx.fillText(branding.subtext, canvas.width / 2, Math.round(2570 * scale));
        }

        if (branding.showDate) {
          const dateStr = new Date().toLocaleDateString('vi-VN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          });
          ctx.font = `${Math.round(24 * scale)}px monospace`;
          ctx.fillStyle = frame.assets.textColor ? `${frame.assets.textColor}88` : '#9ca3af';
          ctx.fillText(dateStr, canvas.width / 2, Math.round(2630 * scale));
        }
      }
      ctx.restore();
    }

    // 5. Draw Custom Drawing & Text Layer on top
    if (drawDataUrl) {
      try {
        const drawImg = await this.loadImage(drawDataUrl);
        ctx.drawImage(drawImg, 0, 0, canvas.width, canvas.height);
      } catch (err) {
        console.warn('Failed to draw overlay drawing layer:', err);
      }
    }

    // Generate Outputs (100% Maximum Quality - Lossless PNG & JPEG 1.0)
    const masterDataUrl = canvas.toDataURL('image/png');
    const shareDataUrl = canvas.toDataURL('image/jpeg', 1.0);

    // Render Print Data URL via authoritative CP1000 print master builder
    const isStrip = isStripTemplate(frame);
    const targetProduct = frame.targetProduct || (isStrip ? 'STRIP_4' : 'SHEET_4');
    const isLandscape = canvas.width > canvas.height;

    const printMasterResult = await buildPrintMaster({
      logicalProductImage: canvas,
      targetProduct,
      isLandscape,
    });
    const printDataUrl = printMasterResult.toDataURL('image/jpeg', 1.0);

    return {
      master: masterDataUrl,
      share: shareDataUrl,
      print: printDataUrl,
    };
  }

  private drawSlotPlaceholder(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    slotNumber: number
  ) {
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`SLOT ${slotNumber}`, x + w / 2, y + h / 2);
  }

  private drawImageFit(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    viewportX: number,
    viewportY: number,
    viewportW: number,
    viewportH: number
  ) {
    if (!img.width || !img.height || !viewportW || !viewportH) {
      ctx.drawImage(img, viewportX, viewportY, viewportW, viewportH);
      return;
    }

    // Scale-to-fit: scale photo to fit inside slot without crop or stretch, centered
    const scale = Math.min(viewportW / img.width, viewportH / img.height);
    const renderWidth = img.width * scale;
    const renderHeight = img.height * scale;
    const x = viewportX + (viewportW - renderWidth) / 2;
    const y = viewportY + (viewportH - renderHeight) / 2;

    ctx.save();
    ctx.beginPath();
    ctx.rect(viewportX, viewportY, viewportW, viewportH);
    ctx.clip();
    ctx.drawImage(img, x, y, renderWidth, renderHeight);
    ctx.restore();
  }

  private clipRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.clip();
  }

  private async renderDoubleStrip(
    stripCanvas: HTMLCanvasElement,
    paperWidth: number,
    paperHeight: number
  ): Promise<string> {
    const printCanvas = document.createElement('canvas');
    printCanvas.width = paperWidth; // 1800 px (4 inches at 300DPI)
    printCanvas.height = paperHeight; // 2700 px (6 inches at 300DPI)
    const pctx = printCanvas.getContext('2d')!;
    pctx.imageSmoothingEnabled = true;
    pctx.imageSmoothingQuality = 'high';

    // Background white paper
    pctx.fillStyle = '#ffffff';
    pctx.fillRect(0, 0, paperWidth, paperHeight);

    const halfW = paperWidth / 2; // 900 px

    // Draw Left 5x15 Strip (0 to 900)
    pctx.drawImage(stripCanvas, 0, 0, halfW, paperHeight);

    // Draw Right 5x15 Strip Duplicate (900 to 1800)
    pctx.drawImage(stripCanvas, halfW, 0, halfW, paperHeight);

    // Draw thin dashed cut line down exact center axis
    pctx.setLineDash([12, 12]);
    pctx.lineWidth = 2;
    pctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    pctx.beginPath();
    pctx.moveTo(halfW, 0);
    pctx.lineTo(halfW, paperHeight);
    pctx.stroke();

    return printCanvas.toDataURL('image/jpeg', 0.98);
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(e);
      img.src = src;
    });
  }
}

export const compositionEngine = new CompositionEngine();
