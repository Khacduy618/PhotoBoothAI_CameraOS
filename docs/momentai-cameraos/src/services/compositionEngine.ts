import { FrameTemplate, PhotoItem, EventConfig, PaperSize } from '../types';
import { HOI_AN_SAMPLE_PHOTOS } from '../data/hoianSamplePhotos';

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

    // 1. Draw Frame Background
    ctx.fillStyle = frame.assets.background || '#ffffff';
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
        // Object-fit cover cropping inside slot
        this.drawImageCover(ctx, img, slotX, slotY, slotW, slotH);
      } catch {
        // Fallback to sample photo if custom photo load failed
        try {
          const fallbackImg = await this.loadImage(HOI_AN_SAMPLE_PHOTOS[i % HOI_AN_SAMPLE_PHOTOS.length]);
          this.drawImageCover(ctx, fallbackImg, slotX, slotY, slotW, slotH);
        } catch {
          this.drawSlotPlaceholder(ctx, slotX, slotY, slotW, slotH, i + 1);
        }
      }
      ctx.restore();

      // Slot stroke/border
      if (frame.assets.borderWidth) {
        ctx.lineWidth = frame.assets.borderWidth;
        ctx.strokeStyle = frame.assets.overlayColor || '#000000';
        ctx.strokeRect(slotX, slotY, slotW, slotH);
      }
    }

    // 3. Draw Frame Overlay Image if present
    if (frame.assets.overlay) {
      try {
        const overlayImg = await this.loadImage(frame.assets.overlay);
        ctx.drawImage(overlayImg, 0, 0, canvas.width, canvas.height);
      } catch (err) {
        console.warn('Failed to load frame overlay image:', err);
      }
    }

    // 4. Draw Branding & Custom Text
    const branding = frame.eventBranding || {
      text: eventConfig.eventName || 'MOMENTAI PHOTOBOOTH',
      subtext: eventConfig.customTagline || 'Captured with Canon EOS 6D',
      showDate: true,
    };

    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = frame.assets.textColor || '#1A1A1A';

    const textY = canvas.height - 130;
    ctx.font = 'italic 52px "Playfair Display", serif';
    ctx.fillText(branding.text, canvas.width / 2, textY);

    if (customText) {
      ctx.font = 'bold 36px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = frame.assets.textColor ? `${frame.assets.textColor}` : '#1A1A1A';
      ctx.fillText(`"${customText}"`, canvas.width / 2, textY + 50);
    } else if (branding.subtext) {
      ctx.font = '30px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = frame.assets.textColor ? `${frame.assets.textColor}cc` : '#4b5563';
      ctx.fillText(branding.subtext, canvas.width / 2, textY + 50);
    }

    if (branding.showDate) {
      const dateStr = new Date().toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      ctx.font = '24px monospace';
      ctx.fillStyle = frame.assets.textColor ? `${frame.assets.textColor}88` : '#9ca3af';
      ctx.fillText(dateStr, canvas.width / 2, textY + 95);
    }
    ctx.restore();

    // 4. Draw Custom Drawing Layer on top if present
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

    // Render Print Data URL (Handles 2x6 double-strip cut mode on 4x6 paper)
    let printDataUrl = masterDataUrl;
    if (frame.renderMode === 'double-strip' || frame.preferredPaper === '2x6-double') {
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

  private drawImageCover(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    x: number,
    y: number,
    w: number,
    h: number
  ) {
    const imgRatio = img.width / img.height;
    const slotRatio = w / h;

    let renderW = w;
    let renderH = h;
    let offsetX = 0;
    let offsetY = 0;

    if (imgRatio > slotRatio) {
      renderW = h * imgRatio;
      offsetX = (w - renderW) / 2;
    } else {
      renderH = w / imgRatio;
      offsetY = (h - renderH) / 2;
    }

    ctx.drawImage(img, x + offsetX, y + offsetY, renderW, renderH);
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
    printCanvas.width = paperWidth; // e.g. 1800 (4 inches at 300DPI)
    printCanvas.height = paperHeight; // e.g. 2700 (6 inches at 300DPI)
    const pctx = printCanvas.getContext('2d')!;

    // Background white paper
    pctx.fillStyle = '#ffffff';
    pctx.fillRect(0, 0, paperWidth, paperHeight);

    // Draw Left Strip
    const stripWidth = paperWidth / 2 - 10;
    pctx.drawImage(stripCanvas, 0, 0, stripWidth, paperHeight);

    // Draw Right Duplicate Strip
    pctx.drawImage(stripCanvas, paperWidth / 2 + 10, 0, stripWidth, paperHeight);

    // Draw dashed cut line in center
    pctx.setLineDash([15, 15]);
    pctx.lineWidth = 2;
    pctx.strokeStyle = '#cbd5e1';
    pctx.beginPath();
    pctx.moveTo(paperWidth / 2, 0);
    pctx.lineTo(paperWidth / 2, paperHeight);
    pctx.stroke();

    return printCanvas.toDataURL('image/jpeg', 0.95);
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
