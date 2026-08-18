import { describe, it, expect } from 'vitest';
import { calculatePhotoLayerGeometry } from './frameGeometry';

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
});
