/**
 * production-print-pipeline-test.service.ts
 *
 * Dedicated DEV tool to verify the EXACT production CP1000 print pipeline:
 *  1. Raw Canon 6D photo (5472x3648)
 *  2. Direct 1-pass crop & downscale (NO digital filters)
 *  3. M2 RGB Color Correction (R: 1.03, G: 0.96, B: 1.01) applied strictly to photo pixels
 *  4. Frame overlay PNG & text/drawings layered on top with 0% color modification
 *  5. Export 1800x2700 JPEG 1.0 (CP1000-production-pipeline-test.jpg)
 */

import type { FrameTemplate, PhotoItem } from '@/components/momentai-guest-flow/types';
import { renderFrameComposition } from '@/services/render/frame-compositor.service';
import { buildPrintMaster, type PrintMasterResult } from '@/services/render/print-master.service';
import { CP1000_PRINT_PROFILE } from '@momentai/printer-contract';

export async function generateProductionPipelineTest(
  sourceImage: HTMLImageElement | HTMLCanvasElement | string,
  options?: {
    frame?: FrameTemplate;
    targetCanvas?: HTMLCanvasElement;
  },
): Promise<{
  canvas: HTMLCanvasElement;
  dataUrl: string;
  blob: Blob;
  download(filename?: string): void;
}> {
  const photoUrl =
    typeof sourceImage === 'string'
      ? sourceImage
      : (sourceImage as HTMLImageElement).src ||
        (sourceImage as HTMLCanvasElement).toDataURL('image/jpeg', 1.0);

  const sampleFrame: FrameTemplate = options?.frame || {
    id: 'prod-test-frame',
    name: 'Production Print Pipeline Test Frame',
    orientation: 'portrait',
    aspectRatio: '2:3',
    outputWidth: 1800,
    outputHeight: 2700,
    slots: [
      {
        id: 'slot-1',
        x: 90,
        y: 90,
        width: 1620,
        height: 2420,
      },
    ],
    assets: {
      background: '#ffffff',
    },
  };

  const photoItem: PhotoItem = {
    id: 'prod-test-photo-1',
    dataUrl: photoUrl,
    timestamp: Date.now(),
    width: 5472,
    height: 3648,
  };

  // Run through authoritative production print compositor:
  const compResult = await renderFrameComposition({
    frame: sampleFrame,
    photos: [photoItem],
    streamMode: 'print',
    colorProfile: CP1000_PRINT_PROFILE,
    targetCanvas: options?.targetCanvas,
  });

  // Run through authoritative production print master builder:
  const printMaster: PrintMasterResult = await buildPrintMaster({
    logicalProductImage: compResult.canvas,
    targetProduct: 'PREMIUM_POSTCARD',
    targetCanvas: options?.targetCanvas,
  });

  const dataUrl = printMaster.toDataURL('image/jpeg', 1.0);
  const blob = await printMaster.toBlob('image/jpeg', 1.0);

  return {
    canvas: printMaster.canvas,
    dataUrl,
    blob,
    download(filename = 'CP1000-production-pipeline-test.jpg') {
      if (typeof document !== 'undefined') {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = filename;
        a.click();
      }
    },
  };
}
