import { FrameTemplate, PhotoItem, EventConfig, PaperSize } from '../types';
import { HOI_AN_SAMPLE_PHOTOS } from '../data/hoianSamplePhotos';
import { isStripTemplate } from '../components/UI/frame-previews/FramePreviewCard';

export class CompositionEngine {
  public async renderComposition(
    frame: FrameTemplate,
    slotPhotos: (PhotoItem | null)[],
    eventConfig: EventConfig,
    customText?: string,
    drawDataUrl?: string,
    targetWidth: number = 1800,
    targetHeight: number = 2700
  ): Promise<{ master: string; share: string; print: string }> {
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // 1. Draw Frame Background
    const bg = frame.assets.background;
    ctx.fillStyle = (bg && bg !== 'transparent') ? bg : '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Load and Draw Photos into Slots
    for (let i = 0; i < frame.slots.length; i++) {
      const slot = frame.slots[i];
      const photo = slotPhotos[i];

      const slotX = (slot.x / 100) * canvas.width;
      const slotY = (slot.y / 100) * canvas.height;
      const slotW = (slot.width / 100) * canvas.width;
      const slotH = (slot.height / 100) * canvas.height;

      ctx.save();
      if (slot.borderRadius) {
        this.clipRoundedRect(ctx, slotX, slotY, slotW, slotH, slot.borderRadius);
      } else {
        ctx.beginPath();
        ctx.rect(slotX, slotY, slotW, slotH);
      }

      const imgUrl = (photo && photo.dataUrl) ? photo.dataUrl : HOI_AN_SAMPLE_PHOTOS[i % HOI_AN_SAMPLE_PHOTOS.length];
      try {
        const img = await this.loadImage(imgUrl);
        // Scale-to-fit center photo inside viewport without cropping
        this.drawImageFit(ctx, img, slotX, slotY, slotW, slotH);
      } catch {
        // Fallback to sample photo if custom photo load failed
        try {
          const fallbackImg = await this.loadImage(HOI_AN_SAMPLE_PHOTOS[i % HOI_AN_SAMPLE_PHOTOS.length]);
          this.drawImageFit(ctx, fallbackImg, slotX, slotY, slotW, slotH);
        } catch {
          this.drawSlotPlaceholder(ctx, slotX, slotY, slotW, slotH, i + 1);
        }
      }
      ctx.restore();
    }

    // 3. Draw Frame Overlay Image if present (check all potential overlay property names)
    const overlayUrl = frame.assets?.overlay || (frame as any).assetUrl;
    let hasOverlayImage = false;

    if (overlayUrl) {
      try {
        const overlayImg = await this.loadImage(overlayUrl);
        ctx.drawImage(overlayImg, 0, 0, canvas.width, canvas.height);
        hasOverlayImage = true;
      } catch (err) {
        console.warn('Failed to load frame overlay image:', err);
      }
    }

    // 4. Draw Branding Fallback Text ONLY if NO overlay image is present
    if (!hasOverlayImage) {
      const branding = frame.eventBranding || {
        text: eventConfig.eventName || 'PHỐ CỔ HỘI AN',
        subtext: eventConfig.customTagline || 'Tiệm Ảnh Di Sản',
        showDate: true,
      };

      const isLandscape = canvas.width > canvas.height;
      const isStrip = isStripTemplate(frame);

      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = frame.assets.textColor || '#1A1A1A';

      if (isLandscape) {
        // Landscape (2700x1800, height 1800px): branding area at bottom 12%
        ctx.font = 'italic 38px "Playfair Display", serif';
        ctx.fillText(branding.text, canvas.width / 2, 1660);

        if (branding.subtext) {
          ctx.font = '22px "Plus Jakarta Sans", sans-serif';
          ctx.fillStyle = frame.assets.textColor ? `${frame.assets.textColor}cc` : '#4b5563';
          ctx.fillText(branding.subtext, canvas.width / 2, 1705);
        }

        if (branding.showDate) {
          const dateStr = new Date().toLocaleDateString('vi-VN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          });
          ctx.font = '18px monospace';
          ctx.fillStyle = frame.assets.textColor ? `${frame.assets.textColor}88` : '#9ca3af';
          ctx.fillText(dateStr, canvas.width / 2, 1745);
        }
      } else if (isStrip) {
        // Strip (900x2700, height 2700px)
        ctx.font = 'italic 36px "Playfair Display", serif';
        ctx.fillText(branding.text, canvas.width / 2, 2520);

        if (branding.subtext) {
          ctx.font = '22px "Plus Jakarta Sans", sans-serif';
          ctx.fillStyle = frame.assets.textColor ? `${frame.assets.textColor}cc` : '#4b5563';
          ctx.fillText(branding.subtext, canvas.width / 2, 2570);
        }

        if (branding.showDate) {
          const dateStr = new Date().toLocaleDateString('vi-VN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          });
          ctx.font = '18px monospace';
          ctx.fillStyle = frame.assets.textColor ? `${frame.assets.textColor}88` : '#9ca3af';
          ctx.fillText(dateStr, canvas.width / 2, 2620);
        }
      } else {
        // Portrait Sheet (1800x2700, height 2700px)
        ctx.font = 'italic 52px "Playfair Display", serif';
        ctx.fillText(branding.text, canvas.width / 2, 2500);

        if (branding.subtext) {
          ctx.font = '30px "Plus Jakarta Sans", sans-serif';
          ctx.fillStyle = frame.assets.textColor ? `${frame.assets.textColor}cc` : '#4b5563';
          ctx.fillText(branding.subtext, canvas.width / 2, 2570);
        }

        if (branding.showDate) {
          const dateStr = new Date().toLocaleDateString('vi-VN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          });
          ctx.font = '24px monospace';
          ctx.fillStyle = frame.assets.textColor ? `${frame.assets.textColor}88` : '#9ca3af';
          ctx.fillText(dateStr, canvas.width / 2, 2630);
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

    // Generate Outputs
    const masterDataUrl = canvas.toDataURL('image/png');
    const shareDataUrl = canvas.toDataURL('image/jpeg', 0.85);

    // Render Print Data URL (Handles 2x6 / 5x15 double-strip cut mode on 4x6 / 10x15 paper)
    let printDataUrl = masterDataUrl;
    const isStrip = isStripTemplate(frame);
    if (frame.renderMode === 'double-strip' || frame.preferredPaper === '2x6-double' || isStrip) {
      printDataUrl = await this.renderDoubleStrip(canvas, 1800, 2700);
    }

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

    // Cover scale: scale photo to cover full slot height and width, centered
    const scale = Math.max(viewportW / img.width, viewportH / img.height);
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
