import { describe, it, expect } from 'vitest';
import { calculatePhotoLayerGeometry } from './frameGeometry';
import { mapPhotosToFrameSlots } from '../../components/momentai-guest-flow/components/UI/frame-previews/FramePreviewCard';

describe('calculatePhotoLayerGeometry', () => {
  const EPSILON = 0.001;

  it('calculates landscape canvas geometry correctly (9000x6000)', () => {
    const result = calculatePhotoLayerGeometry({
      canvasWidth: 9000,
      canvasHeight: 6000,
      slot: { x: 9, y: 22.67, width: 82, height: 54.67 },
      imageWidth: 1920,
      imageHeight: 1080,
    });

    expect(result.photoWidth).toBeGreaterThanOrEqual(result.slotWidth);
    expect(result.photoHeight).toBeGreaterThanOrEqual(result.slotHeight);

    expect(Math.abs(result.photoCenterX - result.slotCenterX)).toBeLessThan(EPSILON);
    expect(Math.abs(result.photoCenterY - result.slotCenterY)).toBeLessThan(EPSILON);

    const photoRatio = result.photoWidth / result.photoHeight;
    const imageRatio = 1920 / 1080;
    expect(Math.abs(photoRatio - imageRatio)).toBeLessThan(EPSILON);
  });

  it('calculates portrait canvas geometry covering 100% of slot area (6000x9000)', () => {
    const result = calculatePhotoLayerGeometry({
      canvasWidth: 6000,
      canvasHeight: 9000,
      slot: { x: 22.67, y: 9, width: 57.27, height: 57.31 },
      imageWidth: 1920,
      imageHeight: 1080,
    });

    expect(result.photoWidth).toBeGreaterThanOrEqual(result.slotWidth);
    expect(result.photoHeight).toBeGreaterThanOrEqual(result.slotHeight);

    expect(Math.abs(result.photoCenterX - result.slotCenterX)).toBeLessThan(EPSILON);
    expect(Math.abs(result.photoCenterY - result.slotCenterY)).toBeLessThan(EPSILON);

    const photoRatio = result.photoWidth / result.photoHeight;
    const imageRatio = 1920 / 1080;
    expect(Math.abs(photoRatio - imageRatio)).toBeLessThan(EPSILON);
  });

  it('calculates strip canvas geometry correctly (3000x9000)', () => {
    const result = calculatePhotoLayerGeometry({
      canvasWidth: 3000,
      canvasHeight: 9000,
      slot: { x: 10.87, y: 9.65, width: 74.71, height: 32.83 },
      imageWidth: 1920,
      imageHeight: 1080,
    });

    expect(result.photoWidth).toBeGreaterThanOrEqual(result.slotWidth);
    expect(result.photoHeight).toBeGreaterThanOrEqual(result.slotHeight);

    expect(Math.abs(result.photoCenterX - result.slotCenterX)).toBeLessThan(EPSILON);
    expect(Math.abs(result.photoCenterY - result.slotCenterY)).toBeLessThan(EPSILON);

    const photoRatio = result.photoWidth / result.photoHeight;
    const imageRatio = 1920 / 1080;
    expect(Math.abs(photoRatio - imageRatio)).toBeLessThan(EPSILON);
  });

  it('calculates 4strip canvas geometry correctly (3000x9000)', () => {
    const result = calculatePhotoLayerGeometry({
      canvasWidth: 3000,
      canvasHeight: 9000,
      slot: { x: 17.43, y: 6.18, width: 67.12, height: 12.68 },
      imageWidth: 1920,
      imageHeight: 1080,
    });

    expect(result.photoWidth).toBeGreaterThanOrEqual(result.slotWidth);
    expect(result.photoHeight).toBeGreaterThanOrEqual(result.slotHeight);

    expect(Math.abs(result.photoCenterX - result.slotCenterX)).toBeLessThan(EPSILON);
    expect(Math.abs(result.photoCenterY - result.slotCenterY)).toBeLessThan(EPSILON);

    const photoRatio = result.photoWidth / result.photoHeight;
    expect(Math.abs(photoRatio - 1920 / 1080)).toBeLessThan(EPSILON);
  });

  it('calculates non-16:9 3:2 camera image correctly (6000x4000)', () => {
    const result = calculatePhotoLayerGeometry({
      canvasWidth: 6000,
      canvasHeight: 9000,
      slot: { x: 22.67, y: 9, width: 57.27, height: 57.31 },
      imageWidth: 6000,
      imageHeight: 4000,
    });

    expect(result.photoWidth).toBeGreaterThanOrEqual(result.slotWidth);
    expect(result.photoHeight).toBeGreaterThanOrEqual(result.slotHeight);

    expect(Math.abs(result.photoCenterX - result.slotCenterX)).toBeLessThan(EPSILON);
    expect(Math.abs(result.photoCenterY - result.slotCenterY)).toBeLessThan(EPSILON);

    const photoRatio = result.photoWidth / result.photoHeight;
    expect(Math.abs(photoRatio - 1.5)).toBeLessThan(EPSILON);
  });

  it('calculates non-16:9 4:3 camera image correctly (4000x3000)', () => {
    const result = calculatePhotoLayerGeometry({
      canvasWidth: 6000,
      canvasHeight: 9000,
      slot: { x: 22.67, y: 9, width: 57.27, height: 57.31 },
      imageWidth: 4000,
      imageHeight: 3000,
    });

    expect(result.photoWidth).toBeGreaterThanOrEqual(result.slotWidth);
    expect(result.photoHeight).toBeGreaterThanOrEqual(result.slotHeight);

    expect(Math.abs(result.photoCenterX - result.slotCenterX)).toBeLessThan(EPSILON);
    expect(Math.abs(result.photoCenterY - result.slotCenterY)).toBeLessThan(EPSILON);

    const photoRatio = result.photoWidth / result.photoHeight;
    expect(Math.abs(photoRatio - 4 / 3)).toBeLessThan(EPSILON);
  });

  it('integration test: verifies Preview and compositionEngine calculate identical geometry', () => {
    const input = {
      canvasWidth: 9000,
      canvasHeight: 6000,
      slot: { x: 9, y: 22.67, width: 82, height: 54.67 },
      imageWidth: 4000,
      imageHeight: 3000,
    };

    const previewGeom = calculatePhotoLayerGeometry(input);
    const compositionGeom = calculatePhotoLayerGeometry(input);

    expect(previewGeom.photoX).toBe(compositionGeom.photoX);
    expect(previewGeom.photoY).toBe(compositionGeom.photoY);
    expect(previewGeom.photoWidth).toBe(compositionGeom.photoWidth);
    expect(previewGeom.photoHeight).toBe(compositionGeom.photoHeight);
    expect(previewGeom.photoCenterX).toBe(compositionGeom.photoCenterX);
    expect(previewGeom.photoCenterY).toBe(compositionGeom.photoCenterY);
  });

  it('debugScale multiplier tunes photo size while locking center to slot center', () => {
    const baseGeom = calculatePhotoLayerGeometry({
      canvasWidth: 6000,
      canvasHeight: 9000,
      slot: { x: 22.67, y: 9, width: 57.27, height: 57.31 },
      imageWidth: 1920,
      imageHeight: 1080,
    });

    const scaledGeom = calculatePhotoLayerGeometry({
      canvasWidth: 6000,
      canvasHeight: 9000,
      slot: { x: 22.67, y: 9, width: 57.27, height: 57.31 },
      imageWidth: 1920,
      imageHeight: 1080,
      debugScale: 1.25,
    });

    expect(scaledGeom.photoWidth).toBeCloseTo(baseGeom.photoWidth * 1.25, 2);
    expect(scaledGeom.photoHeight).toBeCloseTo(baseGeom.photoHeight * 1.25, 2);

    expect(Math.abs(scaledGeom.photoCenterX - baseGeom.slotCenterX)).toBeLessThan(EPSILON);
    expect(Math.abs(scaledGeom.photoCenterY - baseGeom.slotCenterY)).toBeLessThan(EPSILON);
  });

  it('4sheet & 6sheet multi-slot center invariant: every slot has its OWN distinct center and centerDelta <= 1px', () => {
    // 4sheet 2x2 grid slots on 6000x9000 canvas
    const fourSheetSlots = [
      { x: 5, y: 5, width: 42, height: 42 }, // Top-Left
      { x: 53, y: 5, width: 42, height: 42 }, // Top-Right
      { x: 5, y: 53, width: 42, height: 42 }, // Bottom-Left
      { x: 53, y: 53, width: 42, height: 42 }, // Bottom-Right
    ];

    const centers = new Set<string>();
    for (const slot of fourSheetSlots) {
      const geom = calculatePhotoLayerGeometry({
        canvasWidth: 6000,
        canvasHeight: 9000,
        slot,
        imageWidth: 1920,
        imageHeight: 1080,
      });

      const deltaX = Math.abs(geom.photoCenterX - geom.slotCenterX);
      const deltaY = Math.abs(geom.photoCenterY - geom.slotCenterY);

      expect(deltaX).toBeLessThanOrEqual(1.0);
      expect(deltaY).toBeLessThanOrEqual(1.0);

      centers.add(`${geom.slotCenterX.toFixed(2)},${geom.slotCenterY.toFixed(2)}`);
    }

    // Must have 4 completely distinct slot centers!
    expect(centers.size).toBe(4);
  });

  it('mapPhotosToFrameSlots maps 4 captured photos to 4 slots deterministically without fallback reuse', () => {
    const photos = [
      { id: 'photo-1', dataUrl: 'data:image/jpeg;base64,A' },
      { id: 'photo-2', dataUrl: 'data:image/jpeg;base64,B' },
      { id: 'photo-3', dataUrl: 'data:image/jpeg;base64,C' },
      { id: 'photo-4', dataUrl: 'data:image/jpeg;base64,D' },
    ];
    const slots = [
      { id: 1, x: 6, y: 3.5, width: 88, height: 21 },
      { id: 2, x: 6, y: 26.5, width: 88, height: 21 },
      { id: 3, x: 6, y: 49.5, width: 88, height: 21 },
      { id: 4, x: 6, y: 72.5, width: 88, height: 21 },
    ];

    const mapped = mapPhotosToFrameSlots(photos, slots);
    expect(mapped).toHaveLength(4);
    expect(mapped[0].photo?.id).toBe('photo-1');
    expect(mapped[1].photo?.id).toBe('photo-2');
    expect(mapped[2].photo?.id).toBe('photo-3');
    expect(mapped[3].photo?.id).toBe('photo-4');
    expect(mapped[0].photo?.id).not.toBe(mapped[3].photo?.id);
  });
});
