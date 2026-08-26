/**
 * physical-print-plan.ts
 *
 * Authoritative Physical Print Plan Resolver for MomentAI CameraOS.
 * Maps logical guest product requests (e.g. 2, 4, 6 strips, or 1, 2, 3 sheets)
 * into physical printer media sheets and layout parameters for Canon SELPHY CP1000.
 */

import {
  CANON_CP1000_PROFILE,
  type PrinterProfile,
} from '@momentai/printer-contract';
import {
  isStripProduct,
  type CanonicalProduct,
} from '@/services/frame/resolveTargetProduct';

export interface ResolvePhysicalPrintPlanOptions {
  product: CanonicalProduct | string;
  requestedQuantity: number;
  printerProfile?: PrinterProfile;
  isLandscape?: boolean;
  sessionId?: string;
}

export interface PhysicalPrintPlan {
  productType: CanonicalProduct;
  printerProfile: PrinterProfile;
  physicalLayout: 'two-up-vertical' | 'full-sheet';
  requestedLogicalUnits: number;
  sheets: number;
  duplicatesPerSheet: number;
  orientation: 'portrait' | 'landscape';
  targetWidthPx: number;
  targetHeightPx: number;
  widthMm: number;
  heightMm: number;
  dpi: number;
}

export function resolvePhysicalPrintPlan(
  options: ResolvePhysicalPrintPlanOptions,
): PhysicalPrintPlan {
  const {
    product,
    requestedQuantity,
    printerProfile = CANON_CP1000_PROFILE,
    isLandscape = false,
    sessionId = 'unknown',
  } = options;

  const rawProduct = String(product || '').trim().toUpperCase();
  const validProducts: CanonicalProduct[] = [
    'PREMIUM_POSTCARD',
    'STRIP_2',
    'STRIP_4',
    'SHEET_4',
    'SHEET_6',
  ];

  const matchedProduct = validProducts.find((p) => p === rawProduct);
  if (!matchedProduct) {
    throw new Error(
      `[resolvePhysicalPrintPlan] Unsupported canonical product: "${product}". Expected one of: ${validProducts.join(', ')}`,
    );
  }

  const isStrip = isStripProduct(matchedProduct);

  let sheets: number;
  let duplicatesPerSheet: number;
  let physicalLayout: 'two-up-vertical' | 'full-sheet';
  let orientation: 'portrait' | 'landscape';

  if (isStrip) {
    if (
      !Number.isInteger(requestedQuantity) ||
      requestedQuantity <= 0 ||
      requestedQuantity % 2 !== 0
    ) {
      throw new Error(
        `[resolvePhysicalPrintPlan] Invalid strip quantity: ${requestedQuantity}. Strip products require an even positive integer count (2, 4, 6, etc.).`,
      );
    }

    sheets = Math.floor(requestedQuantity / 2);
    duplicatesPerSheet = 2;
    physicalLayout = 'two-up-vertical';
    // 5x15 double strip on 10x15 postcard is strictly portrait raster (1181x1748)
    orientation = 'portrait';
  } else {
    if (!Number.isInteger(requestedQuantity) || requestedQuantity <= 0) {
      throw new Error(
        `[resolvePhysicalPrintPlan] Invalid sheet quantity: ${requestedQuantity}. Full-sheet products require a positive integer count.`,
      );
    }

    sheets = requestedQuantity;
    duplicatesPerSheet = 1;
    physicalLayout = 'full-sheet';
    orientation = isLandscape ? 'landscape' : 'portrait';
  }

  const targetWidthPx =
    orientation === 'landscape'
      ? printerProfile.landscape.widthPx
      : printerProfile.portrait.widthPx;
  const targetHeightPx =
    orientation === 'landscape'
      ? printerProfile.landscape.heightPx
      : printerProfile.portrait.heightPx;

  const plan: PhysicalPrintPlan = {
    productType: matchedProduct,
    printerProfile,
    physicalLayout,
    requestedLogicalUnits: requestedQuantity,
    sheets,
    duplicatesPerSheet,
    orientation,
    targetWidthPx,
    targetHeightPx,
    widthMm: printerProfile.widthMm,
    heightMm: printerProfile.heightMm,
    dpi: printerProfile.dpi,
  };

  if (typeof console !== 'undefined' && console.log) {
    console.log(
      `[PRINT_PLAN]\nsessionId=${sessionId}\nproductType=${plan.productType}\nrequestedLogicalUnits=${plan.requestedLogicalUnits}\nphysicalSheetCopies=${plan.sheets}\nprinterProfile=${plan.printerProfile.id}\nlayout=${plan.physicalLayout}\norientation=${plan.orientation}\nraster=${plan.targetWidthPx}x${plan.targetHeightPx}`,
    );
  }

  return plan;
}
