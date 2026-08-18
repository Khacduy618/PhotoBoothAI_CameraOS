# Operator Imported Frame Recovery Evidence

Date: 2026-08-04
Scope: Imported Canva frame selection should not poison booth preview/rendering.

## Implementation summary

- Imported Canva `FrameDefinition` no longer contains `borderColor` or `borderWidth`.
- Imported frames are validated before registration.
- Imported frames default to `photoFit: contain`.
- Imported frames are sorted newest-first by `updatedAt` in the local registry/asset manager path.
- Frame selector no longer draws artificial inner borders for PNG overlays.
- Preview renderer records failed frame asset IDs and falls back without breaking bundled frame recovery.
- Cross-tab storage changes reload the local frame registry.

## Known constraints

- Imported frame assets are still stored by the operator registry as localStorage data URLs. Captured photos are now SQLite-backed local files. A later frame-asset storage adapter can move imported PNGs to the same local data directory if required.

## Evidence status

- `pnpm test` PASS.
- `pnpm tsc --noEmit` PASS.
- `pnpm lint` PASS with warnings.
- `pnpm build` PASS with Turbopack NFT warning.

## Hardware status

Not applicable for frame registry logic; camera/kiosk remains PARTIAL unless manually tested.
