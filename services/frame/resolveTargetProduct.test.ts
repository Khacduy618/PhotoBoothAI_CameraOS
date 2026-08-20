import { describe, it, expect } from 'vitest';
import {
  resolveTargetProduct,
  isStripProduct,
  canonicalLayoutType,
  canonicalPreferredPaper,
  canonicalRenderMode,
} from './resolveTargetProduct';

describe('resolveTargetProduct', () => {
  describe('Priority 1 — persisted targetProduct always wins', () => {
    it('returns STRIP_4 when targetProduct=STRIP_4 even with sheet dimensions', () => {
      expect(resolveTargetProduct({
        targetProduct: 'STRIP_4',
        shotCount: 4,
        outputWidth: 6000, // sheet dimensions
        outputHeight: 9000,
      })).toBe('STRIP_4');
    });

    it('returns SHEET_4 when targetProduct=SHEET_4 even with strip dimensions', () => {
      expect(resolveTargetProduct({
        targetProduct: 'SHEET_4',
        shotCount: 4,
        outputWidth: 3000, // strip dimensions
        outputHeight: 9000,
      })).toBe('SHEET_4');
    });

    it('returns PREMIUM_POSTCARD when targetProduct=PREMIUM_POSTCARD', () => {
      expect(resolveTargetProduct({
        targetProduct: 'PREMIUM_POSTCARD',
        shotCount: 1,
        outputWidth: 6000,
        outputHeight: 9000,
      })).toBe('PREMIUM_POSTCARD');
    });
  });

  describe('Priority 2 — unambiguous shot counts', () => {
    it('resolves shotCount=1 to PREMIUM_POSTCARD', () => {
      expect(resolveTargetProduct({ shotCount: 1, outputWidth: 6000, outputHeight: 9000 })).toBe('PREMIUM_POSTCARD');
    });

    it('resolves shotCount=2 to STRIP_2', () => {
      expect(resolveTargetProduct({ shotCount: 2, outputWidth: 3000, outputHeight: 9000 })).toBe('STRIP_2');
    });

    it('resolves shotCount=6 to SHEET_6', () => {
      expect(resolveTargetProduct({ shotCount: 6, outputWidth: 6000, outputHeight: 9000 })).toBe('SHEET_6');
    });
  });

  describe('Priority 2b — 4-shot via canvas aspect ratio (CRITICAL regression test)', () => {
    it('resolves 4strip (3000x9000, ratio=3.0) to STRIP_4', () => {
      expect(resolveTargetProduct({
        shotCount: 4,
        outputWidth: 3000,
        outputHeight: 9000,
      })).toBe('STRIP_4');
    });

    it('resolves 4sheet (6000x9000, ratio=1.5) to SHEET_4', () => {
      expect(resolveTargetProduct({
        shotCount: 4,
        outputWidth: 6000,
        outputHeight: 9000,
      })).toBe('SHEET_4');
    });

    it('STRIP_4 and SHEET_4 with same shotCount=4 must resolve differently', () => {
      const strip = resolveTargetProduct({ shotCount: 4, outputWidth: 3000, outputHeight: 9000 });
      const sheet = resolveTargetProduct({ shotCount: 4, outputWidth: 6000, outputHeight: 9000 });
      expect(strip).toBe('STRIP_4');
      expect(sheet).toBe('SHEET_4');
      expect(strip).not.toBe(sheet); // CRITICAL: must differ!
    });

    it('resolves 4strip with 1205x3591 dimensions to STRIP_4', () => {
      // Real imported frame dimensions
      expect(resolveTargetProduct({ shotCount: 4, outputWidth: 1205, outputHeight: 3591 })).toBe('STRIP_4');
    });

    it('resolves 4sheet with 2400x3600 dimensions to SHEET_4', () => {
      // Real sheet-like dimensions
      expect(resolveTargetProduct({ shotCount: 4, outputWidth: 2400, outputHeight: 3600 })).toBe('SHEET_4');
    });

    it('respects outputPaper=5x15 for STRIP_4', () => {
      expect(resolveTargetProduct({
        shotCount: 4,
        outputPaper: '5x15',
        outputWidth: 6000, // even with sheet dims, outputPaper wins
        outputHeight: 9000,
      })).toBe('STRIP_4');
    });

    it('respects outputPaper=10x15 for SHEET_4', () => {
      expect(resolveTargetProduct({
        shotCount: 4,
        outputPaper: '10x15',
        outputWidth: 3000, // even with strip dims, outputPaper wins
        outputHeight: 9000,
      })).toBe('SHEET_4');
    });
  });

  describe('Priority 3 — layout.type legacy migration (no outputWidth/Height)', () => {
    it('uses layout.type=1x4 as STRIP_4 when no dimensions', () => {
      expect(resolveTargetProduct({
        shotCount: 4,
        layout: { type: '1x4' },
      })).toBe('STRIP_4');
    });

    it('uses layout.type=2x2 as SHEET_4 when no dimensions', () => {
      expect(resolveTargetProduct({
        shotCount: 4,
        layout: { type: '2x2' },
      })).toBe('SHEET_4');
    });
  });

  describe('null for truly unknown', () => {
    it('returns null for unknown shotCount with no dimensions', () => {
      expect(resolveTargetProduct({ shotCount: 3 })).toBeNull();
    });
  });
});

describe('isStripProduct', () => {
  it('returns true for STRIP_2', () => expect(isStripProduct('STRIP_2')).toBe(true));
  it('returns true for STRIP_4', () => expect(isStripProduct('STRIP_4')).toBe(true));
  it('returns false for SHEET_4', () => expect(isStripProduct('SHEET_4')).toBe(false));
  it('returns false for SHEET_6', () => expect(isStripProduct('SHEET_6')).toBe(false));
  it('returns false for PREMIUM_POSTCARD', () => expect(isStripProduct('PREMIUM_POSTCARD')).toBe(false));
  it('returns false for null', () => expect(isStripProduct(null)).toBe(false));
});

describe('canonicalLayoutType', () => {
  it('PREMIUM_POSTCARD -> 1x1', () => expect(canonicalLayoutType('PREMIUM_POSTCARD')).toBe('1x1'));
  it('STRIP_2 -> 1x2', () => expect(canonicalLayoutType('STRIP_2')).toBe('1x2'));
  it('STRIP_4 -> 1x4', () => expect(canonicalLayoutType('STRIP_4')).toBe('1x4'));
  it('SHEET_4 -> 2x2', () => expect(canonicalLayoutType('SHEET_4')).toBe('2x2'));
  it('SHEET_6 -> 2x3', () => expect(canonicalLayoutType('SHEET_6')).toBe('2x3'));
});

describe('canonicalPreferredPaper', () => {
  it('STRIP_2 -> 2x6-double', () => expect(canonicalPreferredPaper('STRIP_2')).toBe('2x6-double'));
  it('STRIP_4 -> 2x6-double', () => expect(canonicalPreferredPaper('STRIP_4')).toBe('2x6-double'));
  it('SHEET_4 -> 4x6', () => expect(canonicalPreferredPaper('SHEET_4')).toBe('4x6'));
  it('PREMIUM_POSTCARD -> 4x6', () => expect(canonicalPreferredPaper('PREMIUM_POSTCARD')).toBe('4x6'));
});

describe('canonicalRenderMode', () => {
  it('STRIP_4 -> double-strip', () => expect(canonicalRenderMode('STRIP_4')).toBe('double-strip'));
  it('SHEET_4 -> standard', () => expect(canonicalRenderMode('SHEET_4')).toBe('standard'));
});
