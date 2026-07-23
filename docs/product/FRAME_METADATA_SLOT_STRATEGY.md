# PhotoBoothAI Frame Metadata Slot Strategy

Status: Product decision draft approved for implementation planning
Date: 2026-07-23

## Purpose

This document defines the preferred long-term solution for custom frame support in PhotoBoothAI Phase 1+.
It confirms that custom frame PNGs should use explicit metadata slots instead of relying only on default layouts or automatic transparent-area detection.

The goal is to ensure captured photos are preserved, then placed accurately into frame openings, while keeping the booth flow simple for attendees and flexible for event frame design.

## Decision summary

PhotoBoothAI should use this flow:

```text
Open booth
→ choose shot count, orientation and base layout
→ capture required photos
→ preserve originals locally
→ choose frame after real photos exist
→ filter frames by shot count, orientation and layout family
→ preview captured photos inside the selected frame
→ draw/customize
→ export/download derivative
→ retake/reset when needed
```

Frame placement should resolve in this order:

1. If the selected frame has metadata slots, use the frame metadata slots.
2. If the selected frame has no metadata slots, use the default layout slots.
3. If the selected frame is incompatible with the captured layout/shot count, hide it or show it as unavailable.

## Why metadata slots are preferred

Using metadata slots takes more implementation effort than fixed default layouts, but it is the more correct and durable approach when PhotoBoothAI supports many custom event frames.

Benefits:

- photos align exactly with frame openings
- frame designers can create asymmetric or decorative layouts
- frame selection can be filtered safely by shot count and orientation
- rendering remains local-first and predictable
- no heavy editor dependency is required
- no unreliable image-processing auto-detection is required for the core flow
- tests can validate slot coordinates deterministically

## Why automatic PNG slot detection is not the default

Automatic detection can be investigated later, but it should not be the first production path.

Auto-detection would need to:

- load the PNG into canvas
- inspect alpha pixels
- find connected transparent regions
- filter out small decorative transparent areas
- handle semi-transparent shadows and soft masks
- sort slots into capture order
- expose manual correction when detection is wrong

This is more complex and more error-prone than explicit metadata. It may also create performance risk on kiosk hardware.

## Frame metadata model

A custom frame should include a stable ID, asset URL and slot metadata.

Example:

```ts
type FrameOrientation = "portrait" | "landscape";

type FrameLayoutFamily =
  | "single"
  | "1x2"
  | "2x1"
  | "2x2"
  | "1x4"
  | "2x3"
  | "3x2"
  | "2x4"
  | "4x2";

type FrameSlot = {
  id: string;
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

type FrameTemplate = {
  id: string;
  name: string;
  description?: string;
  assetUrl: string;
  thumbnailUrl?: string;
  shotCount: 1 | 2 | 4 | 6 | 8;
  orientation: FrameOrientation;
  layoutFamily: FrameLayoutFamily;
  outputWidth: 1200 | 1800;
  outputHeight: 1200 | 1800;
  slots: FrameSlot[];
  source: "bundled" | "canva" | "operator-upload";
};
```

Coordinate rules:

- `x`, `y`, `width`, `height` are in output pixel coordinates.
- Portrait output uses `1200 x 1800`.
- Landscape output uses `1800 x 1200`.
- Slots must leave at least 60px safe padding where the layout requires attendee drawing space.
- `slots.length` must equal `shotCount`.
- Slot order must match capture order.

## Default layout variants

Each supported shot count should have portrait and landscape variants where useful.

### 1 photo

```text
single-portrait-1200x1800
single-landscape-1800x1200
```

### 2 photos

```text
two-portrait-1x2        → 1200x1800
two-landscape-2x1       → 1800x1200
```

### 4 photos

```text
four-portrait-2x2       → 1200x1800
four-landscape-2x2      → 1800x1200
four-portrait-1x4       → 1200x1800
four-landscape-1x4      → 1800x1200
```

For `four-landscape-1x4`, the output canvas is landscape (`1800 x 1200`) while the photo slots can still be arranged vertically in one column when a frame design needs that composition.

### 6 photos

```text
six-portrait-2x3        → 1200x1800
six-landscape-3x2       → 1800x1200
```

### 8 photos

```text
eight-portrait-2x4      → 1200x1800
eight-landscape-4x2     → 1800x1200
```

The corrected 8-photo portrait default is `2 columns x 4 rows`: four vertical photos on the left and four vertical photos on the right.

## UX flow decision

The setup screen should not preview or choose final frames before capture.

Before capture, the attendee/operator should choose only:

- shot count
- orientation
- base layout variant

After capture, the attendee/operator should choose:

- compatible frame
- drawing/customization
- export/download

Reasoning:

- frame preview before capture is hypothetical because real photos do not exist yet
- after capture, the user can see real photos inside frames
- choosing frames after capture reduces setup complexity
- frame filtering becomes more accurate because shot count and orientation are already known
- the output preview is more truthful

## Frame filtering rules

After capture, frame selector should filter frames by:

```ts
frame.shotCount === selection.shotCount
frame.orientation === selection.orientation
frame.layoutFamily === selection.layoutFamily
frame.outputWidth === selection.outputWidth
frame.outputHeight === selection.outputHeight
```

If no compatible frame exists:

- show default no-frame or simple border frame
- keep photo export available
- do not block download

If a frame is selected but missing its asset:

- show recoverable frame asset error
- fallback to default slots/no-frame
- preserve captured originals

## Rendering order

Renderer should draw in this order:

```text
1. background/theme
2. captured photos inside resolved slots
3. selected frame PNG overlay
4. drawing strokes and attendee customization
5. export derivative
```

Original captures must already be preserved before this rendering step.

## Slot resolution algorithm

```ts
function resolvePhotoSlots(selection, selectedFrame) {
  if (
    selectedFrame &&
    selectedFrame.slots.length === selection.shotCount &&
    selectedFrame.shotCount === selection.shotCount &&
    selectedFrame.orientation === selection.orientation &&
    selectedFrame.layoutFamily === selection.layoutFamily
  ) {
    return selectedFrame.slots;
  }

  return getDefaultLayoutSlots(selection.layoutId);
}
```

## Retake behavior

Retake must reset the attendee flow unless a later PM decision introduces partial-retake behavior.

Current decision:

```text
Retake
→ clear captured photos
→ reset selected layout/frame/customization
→ return to shot/layout/orientation setup
→ do not keep stale frame selections
```

This prevents old frame choices from silently applying to a new session with a different layout.

## Implementation plan

Recommended order:

1. Update layout model to include:
   - `shotCount`
   - `orientation`
   - `layoutFamily`
   - `outputWidth`
   - `outputHeight`
2. Add default portrait/landscape layout variants.
3. Simplify setup UI to choose only shot count, orientation and base layout.
4. Ensure capture preserves originals before frame selection.
5. Move frame selector to post-capture/customizer UI.
6. Add `FrameTemplate` and `FrameSlot` metadata model.
7. Filter frames by shot count, orientation and layout family.
8. Renderer resolves frame metadata slots first, default layout slots second.
9. Add tests for default slots, metadata slots, incompatible frames and missing frame asset fallback.
10. Run gates:
    - `pnpm tsc --noEmit`
    - `pnpm test`
    - `pnpm lint`
    - `pnpm build`

## Acceptance criteria

- Setup no longer requires final frame selection before capture.
- Each supported shot count has portrait/landscape variants where product requires them.
- Captured originals are preserved before frame rendering.
- Frame selector appears after capture and uses real captured photos.
- Frame metadata slots override default layout slots only when compatible.
- Incompatible frames are hidden or unavailable.
- Missing frame assets do not delete or invalidate captured photos.
- Retake resets captured photos and previous selection state.
- Mock/browser evidence is reported as PARTIAL, not hardware PASS.

## Open decisions

- Whether `1 photo portrait` is required immediately or can remain optional.
- Whether `four-landscape-1x4` should visually use a narrow vertical column or a horizontally distributed variant for most frames.
- Whether operator-uploaded frames initially require manual JSON metadata, or whether a lightweight slot editor should be added.
- Whether automatic transparent-area detection should be researched after metadata slots are stable.

## Product conclusion

The approved direction is:

- use default layout slots for fast baseline behavior
- use explicit frame metadata slots for accurate custom frames
- choose shot count/orientation/layout before capture
- choose frame only after real photos are captured
- filter frames by compatibility
- preserve originals before all frame/render/customization work

This is more implementation work than fixed layouts only, but it is the correct foundation for reliable custom event frames.
