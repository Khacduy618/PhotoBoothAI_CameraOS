# PhotoBoothAI Photo Frame Layout Engine and Frame Import Implementation Plan

Status: PM-approved product/implementation source of truth for frame layout, frame selection, rendering and frame import work
Date: 2026-07-23
Related source of truth: `docs/product/PHASE_1_DELIVERY_PLAN.md`
Related import pipeline reference: `docs/Frame_Import_Pipeline/`

## 1. Purpose

This plan is the current source of truth for PhotoBoothAI frame/layout work. It replaces the older frame metadata strategy note and combines:

- setup layout selection
- photo viewport orientation rules
- default frame/slot layout rules
- post-capture frame selection
- metadata slot resolution
- rendering/export behavior
- retake/reset behavior
- Frame Import Pipeline MVP planning

It exists so implementers, QA, reviewers and verifiers can execute in sequence without re-debating product direction.

## 2. Confirmed product decisions

1. Setup before capture must only choose shot count for the attendee flow.
2. Setup preview is a lightweight single sample viewport, not a full final-layout/frame/sticker/text/style preview.
3. Photo viewport orientation and base layout variant selection are deferred unless PM explicitly re-approves them for attendee setup.
4. `portrait` / `landscape` means the orientation of the photo viewport slots, not a fixed frame image orientation.
5. Frame selection happens after real photos are captured.
6. Captured originals must be preserved before frame rendering, drawing, customization or export.
7. Frame metadata slots are the runtime source of truth when a compatible frame has authored slots.
8. Default layout slots remain the fallback when a frame has no metadata slots or metadata is incompatible.
9. The `20/20/20/100` padding rule belongs to resolved photo slot geometry, not wrapper CSS padding.
10. Frame PNG overlays are flexible skins. They cover/scale to the resolved output surface and photo slots.
11. Frame image aspect ratio must never block, clamp or cap the height of photos inside resolved slots.
12. Frame import detection is allowed only in the operator/import pipeline, never in the PhotoBooth runtime.
13. Runtime must read approved `FrameDefinition`/`FrameConfig` metadata only.
14. Retake resets captured photos, selected layout/frame/customization state and returns to setup.
15. Phase 1 excludes print, cloud upload, email, SMS, social sharing, payment, gallery and admin dashboard unless PM explicitly expands scope.

## 3. Target user flow

```text
Open booth
→ Setup: choose shot count
→ Setup: view one lightweight sample viewport
→ Start capture
→ Capture required photos
→ Preserve originals locally
→ Post-capture review with default compatible frame or fallback
→ Post-capture: choose another compatible frame if desired
→ Preview real photos inside selected frame/default layout
→ Draw/customize
→ Export/download derivative
→ Retake/reset/finish
```

## 4. Frame and photo viewport rules

### 4.1 Orientation language

- Photo viewport orientation describes the inner photo slots.
- Frame orientation is flexible and must not be used to reject or constrain photo slots.
- A frame may be visually portrait, landscape or decorative, but compatibility is decided by shot count, slot metadata, viewport orientation and output surface metadata.

### 4.2 Global frame/slot padding rule

Default frame/layout slots must be generated inside this safe area:

```text
top padding:    20px
right padding:  20px
left padding:   20px
bottom padding: 100px
```

Rules:

- All default photo viewport slots must fit inside this padded area.
- The bottom 100px area is reserved for drawing/caption/design breathing room.
- The number of photo viewports is determined by `shotCount` and layout variant.
- Frame/PNG overlay covers/scales to the full output surface and resolved slots.
- Renderer must not use frame image aspect ratio to reduce photo slot height.

### 4.3 Target layout variants

Layout IDs must be stable and data-driven.

| Shot count | Portrait photo viewport layout | Landscape photo viewport layout |
|---:|---|---|
| 1 | `single-portrait-1200x1800` | `single-landscape-1800x1200` |
| 2 | `two-portrait-1x2` | `two-landscape-1x2` |
| 4 | `four-portrait-2x2` / `four-portrait-1x4` | `four-landscape-2x2` / `four-landscape-1x4` |
| 6 | `six-portrait-2x3` | `six-landscape-2x3` |
| 8 | `eight-portrait-2x4` | `eight-landscape-2x4` |

Important corrections:

```text
2 landscape photo viewport = 1 column x 2 rows, not 2x1
6 landscape photo viewport = 2 columns x 3 rows, not 3x2
8 landscape photo viewport = 2 columns x 4 rows, not 4x2
8 portrait photo viewport = 2 columns x 4 rows
```

Legacy IDs may remain as aliases for old sessions, but they must not be shown as active target layout choices.

## 5. Target domain model

```ts
type PhotoViewportOrientation = "portrait" | "landscape";

type BoothLayoutFamily =
  | "single"
  | "1x2"
  | "2x2"
  | "1x4"
  | "2x3"
  | "2x4";

type BoothLayoutConfig = {
  id: BoothLayoutId;
  name: string;
  description: string;
  shotCount: 1 | 2 | 4 | 6 | 8;
  photoViewportOrientation: PhotoViewportOrientation;
  layoutFamily: BoothLayoutFamily;
  columns: number;
  rows: number;
  outputWidth: 1200 | 1800;
  outputHeight: 1200 | 1800;
  padding: {
    top: 20;
    right: 20;
    bottom: 100;
    left: 20;
  };
};

type FrameSlot = {
  id: string;
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  photoViewportOrientation?: PhotoViewportOrientation;
};

type FrameTemplate = {
  id: string;
  name: string;
  description?: string;
  kind: "none" | "solid" | "png-overlay";
  source: "bundled" | "canva" | "operator-upload";
  assetUrl?: string;
  thumbnailUrl?: string;
  borderColor: string;
  borderWidth: number;
  shotCount?: 1 | 2 | 4 | 6 | 8;
  photoViewportOrientation?: PhotoViewportOrientation;
  layoutFamily?: BoothLayoutFamily;
  outputWidth?: 1200 | 1800;
  outputHeight?: 1200 | 1800;
  slots?: readonly FrameSlot[];
};
```

Implementation compatibility note: existing code may temporarily keep a field named `orientation`, but it must mean photo viewport orientation, not frame image orientation.

## 6. Frame compatibility and slot resolution

Compatibility uses optional constraints. A generic no-slot frame may still be selectable and use default layout slots.

```ts
frame.shotCount === undefined || frame.shotCount === layout.shotCount
frame.photoViewportOrientation === undefined || frame.photoViewportOrientation === layout.photoViewportOrientation
frame.layoutFamily === undefined || frame.layoutFamily === layout.layoutFamily
frame.outputWidth === undefined || frame.outputWidth === layout.outputWidth
frame.outputHeight === undefined || frame.outputHeight === layout.outputHeight
```

Metadata slots override defaults only when:

```ts
frame.slots !== undefined
frame.slots.length === layout.shotCount
frame is compatible with layout
```

Resolution order:

```text
compatible frame metadata slots
→ default layout slots inside 20/20/20/100 padding
→ no-frame/simple-border fallback
```

## 7. Frame Import Pipeline integration

The existing reference pipeline lives under:

```text
docs/Frame_Import_Pipeline/
```

Approved integration direction:

```text
Canva PNG with transparent photo slots
→ Operator import tool
→ Alpha/mask analysis
→ Connected components
→ Candidate filtering
→ Slot ordering
→ Confidence scoring
→ Preview validation
→ auto-approved / needs-review / rejected
→ FrameDefinition
→ Frame registry
→ PhotoBooth runtime reads metadata only
```

Rules:

- Runtime PhotoBooth must not run detection.
- Detection runs only during frame import/operator workflow.
- Primary path is PNG transparent photo slots.
- Companion mask is the fallback for frames that cannot follow alpha contract.
- No AI/ML/OpenCV dependency in MVP.
- Do not add Zod/Ajv/Sharp/OpenCV unless PM and Architect approve.
- MVP service code can use pure TypeScript and synthetic RGBA fixtures.
- FrameDefinition stores normalized `0..1` slots.
- Runtime adapter converts normalized slots to pixel `FrameSlot` values before rendering.
- Import pipeline should support `1 | 2 | 4 | 6 | 8` shot counts for alignment with current layout targets.

## 8. Target architecture

### 8.1 Source-of-truth modules

```text
config/layout.config.ts
config/frame.config.ts
services/layout/layout-engine.ts
services/frame/frame-compatibility.service.ts
services/render/photo-slot-resolver.service.ts
services/render/render-plan.service.ts
services/frame-import/frame-import.types.ts
services/frame-import/alpha-mask.service.ts
services/frame-import/connected-components.service.ts
services/frame-import/slot-candidate-filter.service.ts
services/frame-import/slot-ordering.service.ts
services/frame-import/confidence.service.ts
services/frame-import/frame-import-analyzer.service.ts
services/frame-import/frame-definition.adapter.ts
```

### 8.2 UI modules

```text
components/setup/ShotCountSelector.tsx
components/setup/OrientationSelector.tsx
components/setup/LayoutVariantSelector.tsx
components/setup/SetupSummary.tsx
components/setup/SetupFlow.tsx
components/frame/FrameSelector.tsx
components/frame/FrameCard.tsx
components/frame/FrameCompatibilityBadge.tsx
components/frame-import/FrameImportPanel.tsx        # later phase
components/frame-import/FrameImportResultCard.tsx   # later phase
components/frame-import/FrameSlotDebugPreview.tsx   # later phase
```

## 9. Implementation phases

### Phase A — Stabilize gates and docs cleanup

Owner: Implementer  
Supporting: Reviewer, Verifier

Tasks:

1. Remove obsolete/misaligned product docs.
2. Remove stale references to deleted docs.
3. Clean existing Phase A lint blockers:
   - remove unused `sessionService` prop
   - do not read refs during render
   - fix `react-hooks/set-state-in-effect`
   - remove `any` from touched files
   - replace `require()` in tests with imports
   - escape JSX quotes
4. Required gate:

```text
pnpm tsc --noEmit
pnpm test
pnpm lint
pnpm build
```

### Phase B — Layout viewport rules

Owner: Implementer  
Supporting: Architect, QA

Tasks:

1. Update layout IDs and aliases:
   - add `two-landscape-1x2`
   - add `six-landscape-2x3`
   - add `eight-landscape-2x4`
   - keep old IDs only as legacy aliases if needed
2. Remove old target layout choices from UI:
   - `two-landscape-2x1`
   - `six-landscape-3x2`
   - `eight-landscape-4x2`
3. Implement default slot generation with padding:
   - top/right/left `20px`
   - bottom `100px`
4. Ensure slots respect photo viewport orientation and do not depend on frame aspect ratio.
5. Add tests:
   - all active layout IDs resolve
   - legacy aliases resolve safely
   - corrected landscape layouts use `1x2`, `2x3`, `2x4`
   - all slots fit inside padding
   - frame cover/scaling does not reduce slot height

### Phase C — Frame config and resolver boundaries

Owner: Implementer  
Supporting: Architect, Reviewer

Tasks:

1. Keep `config/frame.config.ts` as frame source of truth.
2. Stop duplicating frame definitions in `theme.config.ts` and `AssetManager`.
3. Ensure `frame-compatibility.service.ts` supports:
   - metadata frames
   - generic no-slot frames
   - optional constraints
4. Ensure `photo-slot-resolver.service.ts` returns metadata slots only when compatible.
5. Ensure compositor return metadata uses resolved slots, not default geometry when metadata slots apply.

### Phase D — Simplified setup and post-capture frame selector

Owner: Implementer  
Supporting: BA, Architect, Frontend, QA, Reviewer

Phase D simplifies the attendee setup flow and moves frame selection fully after real photos are captured.

#### Phase D product decisions

1. Initial setup must only expose shot count selection.
2. Initial setup must show one simple sample viewport/preview for the selected shot count.
3. Initial setup must not expose:
   - frame selection
   - sticker controls
   - text controls
   - style/filter controls
   - complex full final-layout preview
   - print/cloud actions
4. Initial setup must not run heavy canvas/compositor preview work.
5. Frame selection happens after required photos are captured and originals are preserved.
6. Post-capture review opens with a default compatible frame or a no-frame/simple-border fallback.
7. User may choose other compatible frames after capture.
8. Frame filtering must respect the initially selected shot count and frame metadata constraints.
9. Incompatible frames must not be shown in attendee UI.
10. No-frame/simple-border fallback must always be available.

#### Setup shot-count mapping

Setup chooses only `shotCount`. The system maps shot count to a default layout ID:

| Shot count | Default layout ID |
|---:|---|
| 1 | `single-portrait-1200x1800` |
| 2 | `two-portrait-1x2` |
| 4 | `four-portrait-2x2` |
| 6 | `six-portrait-2x3` |
| 8 | `eight-portrait-2x4` |

Rules:

- Mapping must live in a single config/helper source.
- Mapping must not be duplicated across UI components.
- Invalid or missing shot count must fall back safely to the approved default.
- Selected shot count/default layout metadata must survive capture and be used by post-capture review/frame filtering.
- Initial defaults are portrait-oriented unless PM later approves exposing orientation/layout variant choices.

#### Layout padding rule

The preview/render sheet may use:

```tsx
<div className="absolute inset-0">
```

Rules:

- Keep `absolute inset-0` as the full output sheet coordinate layer.
- Do not add wrapper CSS padding to define final photo slot placement.
- Padding must come from resolved slot geometry.
- `getPhotoCellRects()` / slot resolver owns the `20/20/20/100` rule:
  - top: `20px`
  - right: `20px`
  - left: `20px`
  - bottom: `100px`
- The padding rule applies to photo slots inside the output surface, not to the wrapper div.
- Frame image aspect ratio must not cap, clamp or reduce photo slot height.
- Frame overlay must cover/scale to the full output surface.

#### Post-capture frame selection flow

```text
Captured photos ready
→ preserve originals
→ resolve default layout from selected shot count
→ show review with default compatible frame or fallback
→ FrameSelector
→ resolve compatible frames
→ PreviewRenderer with resolved slots
→ customize/export derivative
```

Rules:

- Frame selector appears only after capture.
- Compatible frame filtering must use:
  - initially selected shot count
  - frame shot count constraint when present
  - photo viewport orientation constraint when present
  - layout family constraint when present
  - output width/height constraints when present
  - compatible metadata slot count when slots exist
- Metadata slots override default slots only when the frame is compatible.
- Generic no-slot frames remain selectable and use default layout slots.
- Missing/broken frame asset falls back to default/no-frame behavior without invalidating captured originals.
- Changing frames must reuse preserved originals and update only derivative/review output.
- Unavailable or incompatible frame reasons belong only in operator/debug UI, not attendee UI.

#### Phase D tasks

1. Update setup UI to expose shot count only.
2. Remove/defer pre-capture frame/sticker/text/style controls from attendee setup.
3. Replace complex full-layout setup preview with one lightweight sample viewport preview.
4. Add a single source for `shotCount → defaultLayoutId` mapping.
5. Ensure capture required photo count follows selected shot count.
6. Carry selected shot count/default layout metadata through capture into review.
7. Move frame selector fully after capture.
8. Show post-capture review with default compatible frame or no-frame/simple-border fallback.
9. Filter frame options by selected shot count and metadata compatibility.
10. Ensure `PreviewRenderer` consumes resolved slots and does not rely on wrapper CSS padding.
11. Add tests for setup simplification, mapping, frame filtering, resolved slot usage and fallback behavior.

#### Phase D acceptance criteria

Setup:

- Setup exposes shot count selection only.
- Supported shot counts are exactly `1 | 2 | 4 | 6 | 8`.
- Setup shows one simple sample viewport preview.
- Setup does not expose frame/sticker/text/style controls.
- Setup does not render complex full final-layout preview.
- Setup does not show print/cloud actions.

Mapping:

- `1` maps to `single-portrait-1200x1800`.
- `2` maps to `two-portrait-1x2`.
- `4` maps to `four-portrait-2x2`.
- `6` maps to `six-portrait-2x3`.
- `8` maps to `eight-portrait-2x4`.
- Mapping is tested.
- Mapping is centralized and not duplicated across UI components.

Capture and review:

- Selected shot count controls required capture count.
- Captured originals are preserved before review/rendering.
- Review appears only after required photos are captured.
- Review opens with a default compatible frame or no-frame/simple-border fallback.
- Frame selector appears only after capture.
- Compatible frames are filtered by selected shot count and metadata.
- Incompatible frames are hidden from attendee UI.
- Frame switching does not delete or invalidate originals.

Slot/rendering:

- `absolute inset-0` remains the full sheet coordinate layer.
- No wrapper CSS padding is used to define output slot padding.
- `getPhotoCellRects()` / resolver owns `20/20/20/100`.
- Renderer consumes resolved slots.
- Frame aspect ratio does not reduce photo slot height.
- Frame overlay covers/scales to the full output surface.

Required evidence:

```text
pnpm tsc --noEmit
pnpm test
pnpm lint
pnpm build
```

Required automated evidence:

- shot-count-to-layout mapping tests
- setup shot-count-only rendering tests
- tests proving pre-capture frame/sticker/text/style controls are absent
- required capture count follows selected shot count
- frame selector is absent before capture and present after capture
- frame compatibility filtering tests
- default/no-frame fallback tests
- resolved slot padding tests
- renderer does not rely on wrapper CSS padding
- frame aspect ratio does not reduce resolved photo cell height

Required manual/browser evidence:

- select each supported shot count
- verify one simple sample viewport preview updates
- complete at least one capture flow
- verify review opens after capture with default compatible frame/fallback
- verify compatible frame switching post-capture
- verify no pre-capture frame/sticker/text/style controls appear
- verify no print/cloud actions appear
- verify retake/reset behavior remains safe

Hardware evidence:

- `PARTIAL` unless tested on named real camera/kiosk hardware.
- Printer is `Not applicable` unless PM expands print scope.

### Phase E — Renderer/export integration

Owner: Implementer  
Supporting: Architect, Reviewer, QA

Tasks:

1. Renderer consumes resolved slots only.
2. Draw order:

```text
background/theme
→ captured photos in resolved slots
→ frame PNG overlay covering/scaling to output surface
→ drawing/customization
→ export derivative
```

3. Missing frame asset falls back to default/no-frame behavior.
4. Original photos remain preserved before and after rendering failures.
5. Add tests for render fallback/order and missing asset safety.

### Phase F — Retake/reset

Owner: Implementer  
Supporting: QA, Reviewer

Tasks:

1. Retake clears current captured photos.
2. Retake resets selected layout, frame and customization.
3. Retake returns to setup.
4. Retake does not delete preserved originals outside explicit cleanup policy.

### Phase G — Frame Import Pipeline MVP services

Owner: Implementer  
Supporting: Architect, QA

Tasks:

1. Port pure TypeScript analyzer services from `docs/Frame_Import_Pipeline/src/frame-import` into `services/frame-import/`.
2. Support synthetic RGBA input first; no UI/storage required in this phase.
3. Implement:
   - alpha mask builder
   - companion mask input contract
   - connected components
   - candidate filtering
   - slot ordering
   - confidence scoring
   - analyzer result classification
   - FrameDefinition adapter to runtime `FrameConfig`
4. Support shot counts `1 | 2 | 4 | 6 | 8`.
5. Use normalized `0..1` slots in FrameDefinition and pixel slots in runtime FrameConfig.
6. Add unit tests with synthetic fixtures.
7. Runtime must not import or execute analyzer services.

### Phase H — Operator import UI and local registry

Owner: Implementer  
Supporting: Frontend, QA, PM

Tasks:

1. Add operator-only frame import panel after PM confirms route/access control.
2. Support batch PNG selection with MVP limit `10–25` files.
3. Show analysis status:
   - auto-approved
   - needs-review
   - rejected
4. Show sample preview with slot outlines and order numbers.
5. Publish approved frames to local registry.
6. Imported frames appear in post-capture selector.
7. Manual drag/resize fine-tune is deferred unless PM explicitly approves.

## 10. Acceptance criteria

Implementation is not complete until all required or PM-approved-deferred criteria are satisfied:

- `pnpm tsc --noEmit` passes.
- `pnpm test` passes.
- `pnpm lint` passes.
- `pnpm build` passes.
- setup does not expose frame/sticker/text before capture.
- active layout IDs match this plan.
- corrected landscape layouts exist and resolve:
  - `two-landscape-1x2`
  - `six-landscape-2x3`
  - `eight-landscape-2x4`
- old landscape IDs are not shown as active choices:
  - `two-landscape-2x1`
  - `six-landscape-3x2`
  - `eight-landscape-4x2`
- all default slots stay within top/right/left `20px` and bottom `100px` padding.
- frame selector appears after capture.
- frame filtering respects shot count/photo viewport orientation/layout family/output dimensions.
- frame metadata slots override default slots only when compatible.
- frame without metadata falls back to default layout slots.
- frame cover/scaling does not block, clamp or cap resolved photo slot height.
- retake resets current flow selection state.
- captured originals are preserved before rendering/export.
- frame import analyzer is not executed in runtime capture/render flow.
- FrameDefinition adapter converts normalized slots to runtime pixel FrameSlot values.
- no print/cloud dependency is introduced.
- hardware status is reported honestly as PASS/PARTIAL/FAIL/Not applicable.

## 11. Evidence required

Commands:

```text
pnpm tsc --noEmit
pnpm test
pnpm lint
pnpm build
```

Automated evidence:

- layout resolution tests
- viewport orientation tests
- padding tests for 20/20/20/100 rule
- frame compatibility tests
- metadata slot resolver tests
- frame cover/scaling tests
- render order/fallback tests
- retake/reset tests
- frame import analyzer tests
- FrameDefinition adapter tests

Manual/browser evidence:

- setup selection flow
- capture flow
- post-capture frame selection
- preview with real captured photos
- export/download derivative
- retake/reset
- operator import UI only when Phase H is implemented

Hardware evidence:

- `PARTIAL` unless tested on named real camera/kiosk hardware.
- printer is Not applicable unless PM expands scope.

## 12. Known risks

- Existing worktree has lint blockers that must be addressed before acceptance.
- Layout IDs and aliases must be migrated carefully to avoid breaking old sessions.
- Frame import alpha detection can misread transparent decorations unless Canva contract is followed.
- Companion mask and manual review are required for complex frames.
- Operator import UI can become a large editor; keep fine-tune deferred unless PM approves.
- Runtime must never run heavy detection or block live preview.

## 13. PM decision

Approved direction:

```text
layout first
→ capture second
→ frame after capture
→ metadata slots/default slots
→ frame cover with 20/20/20/100 padding rule
→ frame import analyzer only in operator/import tool
→ runtime reads approved metadata only
→ retake resets current flow
```

Approved implementation sequence:

```text
Phase A: Stabilize gates and docs cleanup
→ Phase B: Layout viewport rules
→ Phase C: Frame config and resolver boundaries
→ Phase D: Post-capture frame selector
→ Phase E: Renderer/export integration
→ Phase F: Retake/reset
→ Phase G: Frame Import Pipeline MVP services
→ Phase H: Operator import UI and local registry
→ QA
→ Reviewer
→ Verifier
→ PM final acceptance
```

Do not mark complete until gates and role reviews pass.
