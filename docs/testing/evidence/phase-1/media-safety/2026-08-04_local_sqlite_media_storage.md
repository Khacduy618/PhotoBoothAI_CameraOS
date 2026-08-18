# Local SQLite Media Storage Evidence

Date: 2026-08-04
Scope: Phase 1 media-safety fix for captured originals after imported Canva frame selection.

## Implementation summary

- Captured originals are uploaded to a local API route after browser capture.
- Files are written outside `public` under `.cameraos-data/sessions/{sessionId}/originals/{photoId}.jpg`.
- Metadata is stored in real SQLite at `.cameraos-data/media.sqlite` using `better-sqlite3`.
- UI receives opaque `/api/local-media/photos/{photoId}` URLs, not absolute local filesystem paths.
- Upload MIME types are allowlisted to `image/jpeg`, `image/png` and `image/webp`.
- TTL expiry is computed from server time, not client-supplied capture time.
- Session media lists return newest captures first.
- Session media listing is exposed through `/api/local-media/sessions/{sessionId}/photos`.
- Expired media is hidden/deleted by TTL cleanup after 10 minutes.

## Media-safety notes

- Original capture is still saved through existing `PhotoStorageService` before derivative rendering.
- A local SQLite-backed file copy is saved for session restore and cross-frame recovery.
- UI restores session media from SQLite records and safe media URLs.
- Runtime `blob:` URLs are no longer the only display path after local-media upload succeeds.

## Evidence status

- Unit/integration command: `pnpm test` PASS — 28 files, 188 tests.
- Type command: `pnpm tsc --noEmit` PASS.
- Lint: PASS with 73 existing warnings.
- Build: PASS with Turbopack NFT warning for local fs route tracing.
- Focused local media security/TTL tests: `services/storage/server/local-media-store.test.ts` PASS.

## Hardware status

PARTIAL — no named real camera/kiosk hardware tested in this implementation pass.
