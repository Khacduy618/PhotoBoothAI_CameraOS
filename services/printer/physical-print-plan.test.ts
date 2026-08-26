import { describe, it, expect } from 'vitest';
import { resolvePhysicalPrintPlan } from './physical-print-plan';
import { CANON_CP1000_PROFILE } from '@momentai/printer-contract';

describe('resolvePhysicalPrintPlan', () => {
  it('A. PREMIUM_POSTCARD -> 2362x3496, 1 requested copy -> 1 sheet', () => {
    const plan = resolvePhysicalPrintPlan({
      product: 'PREMIUM_POSTCARD',
      requestedQuantity: 1,
    });
    expect(plan.productType).toBe('PREMIUM_POSTCARD');
    expect(plan.targetWidthPx).toBe(2362);
    expect(plan.targetHeightPx).toBe(3496);
    expect(plan.sheets).toBe(1);
    expect(plan.duplicatesPerSheet).toBe(1);
    expect(plan.physicalLayout).toBe('full-sheet');
    expect(plan.orientation).toBe('portrait');
  });

  it('B. SHEET_4 -> 2362x3496, 3 requested copies -> 3 sheets', () => {
    const plan = resolvePhysicalPrintPlan({
      product: 'SHEET_4',
      requestedQuantity: 3,
    });
    expect(plan.productType).toBe('SHEET_4');
    expect(plan.targetWidthPx).toBe(2362);
    expect(plan.targetHeightPx).toBe(3496);
    expect(plan.sheets).toBe(3);
    expect(plan.duplicatesPerSheet).toBe(1);
    expect(plan.physicalLayout).toBe('full-sheet');
  });

  it('C. SHEET_6 -> 2362x3496', () => {
    const plan = resolvePhysicalPrintPlan({
      product: 'SHEET_6',
      requestedQuantity: 1,
    });
    expect(plan.productType).toBe('SHEET_6');
    expect(plan.targetWidthPx).toBe(2362);
    expect(plan.targetHeightPx).toBe(3496);
    expect(plan.sheets).toBe(1);
  });

  it('D. STRIP_2: requested strips=2 -> 2362x3496 image, 2 duplicates per sheet, physical copies=1', () => {
    const plan = resolvePhysicalPrintPlan({
      product: 'STRIP_2',
      requestedQuantity: 2,
    });
    expect(plan.productType).toBe('STRIP_2');
    expect(plan.targetWidthPx).toBe(2362);
    expect(plan.targetHeightPx).toBe(3496);
    expect(plan.sheets).toBe(1);
    expect(plan.duplicatesPerSheet).toBe(2);
    expect(plan.physicalLayout).toBe('two-up-vertical');
  });

  it('E. STRIP_2: requested strips=6 -> physical copies=3', () => {
    const plan = resolvePhysicalPrintPlan({
      product: 'STRIP_2',
      requestedQuantity: 6,
    });
    expect(plan.productType).toBe('STRIP_2');
    expect(plan.sheets).toBe(3);
    expect(plan.duplicatesPerSheet).toBe(2);
  });

  it('F. STRIP_4: requested strips=4 -> physical copies=2', () => {
    const plan = resolvePhysicalPrintPlan({
      product: 'STRIP_4',
      requestedQuantity: 4,
    });
    expect(plan.productType).toBe('STRIP_4');
    expect(plan.sheets).toBe(2);
    expect(plan.duplicatesPerSheet).toBe(2);
  });

  it('I. Invalid odd strip quantity is rejected', () => {
    expect(() =>
      resolvePhysicalPrintPlan({
        product: 'STRIP_2',
        requestedQuantity: 3,
      }),
    ).toThrowError(/Invalid strip quantity/);

    expect(() =>
      resolvePhysicalPrintPlan({
        product: 'STRIP_4',
        requestedQuantity: 1,
      }),
    ).toThrowError(/Invalid strip quantity/);

    expect(() =>
      resolvePhysicalPrintPlan({
        product: 'STRIP_2',
        requestedQuantity: 0,
      }),
    ).toThrowError(/Invalid strip quantity/);
  });

  it('Handles landscape sheet orientation: 3496x2362', () => {
    const plan = resolvePhysicalPrintPlan({
      product: 'PREMIUM_POSTCARD',
      requestedQuantity: 2,
      isLandscape: true,
    });
    expect(plan.targetWidthPx).toBe(3496);
    expect(plan.targetHeightPx).toBe(2362);
    expect(plan.orientation).toBe('landscape');
    expect(plan.sheets).toBe(2);
  });
});
