# Uncropped Contain Render Evidence

Date: 2026-08-04
Scope: Captured photos should remain fully visible in frame slots by default.

## Implementation summary

- Added `PhotoFitMode = "contain" | "cover"`.
- Imported Canva frames default to `contain`.
- Canvas renderer now uses `calculateObjectFitRect` instead of hardcoded cover crop.
- Preview cells now render captured photos with `object-contain`.
- Added object-fit unit coverage for Canon-like 3:2 landscape image in portrait slots.

## Evidence status

- `services/render/object-fit.service.test.ts` included in `pnpm test` PASS.
- `pnpm tsc --noEmit` PASS.

## Hardware status

PARTIAL — Canon-like behavior covered by software dimensions, not named real Canon 6D hardware.
