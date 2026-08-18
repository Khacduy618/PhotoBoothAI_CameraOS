# MomentAI CameraOS --- Guest Flow Refactor Brief

**Document type:** Production Refactor Brief\
**Scope:** Guest Application Flow\
**Purpose:** Source of truth for the team modifying the current Guest
Flow\
**Status:** Approved flow specification\
**Target runtime:** Guest UI / Electron application

------------------------------------------------------------------------

# 1. Objective

Refactor the current Guest Flow into a shorter, product-driven flow.

The new Guest Flow is:

``` text
START
→ SELECT PRODUCT
→ LIVE VIEW / CAPTURE
→ SELECT FRAME
→ PREMIUM CUSTOMIZE (Premium only)
→ RESULT + QR + CONFIRM PRINT
→ PRINTING
→ PRINT SUCCESS
→ RESET
→ START
```

Important:

-   Keep the existing **Start / "Chạm để chụp ảnh"** screen.
-   Remove the old standalone **quantity-selection** step from the Guest
    Flow.
-   Modify the existing print-quantity screen into the new **Product
    Selection** screen.
-   The product selected at the beginning determines the capture shot
    count and downstream behavior.
-   Premium is a special branch.
-   There is no separate Review screen and no separate final Preview
    screen in the new flow.
-   The Result screen itself is the final preview before printing.

------------------------------------------------------------------------

# 2. Screen Flow

## Final Guest Screens

``` text
[1] START
      ↓
[2] SELECT PRODUCT
      ↓
[3] LIVE VIEW / CAPTURE
      ↓
[4] SELECT FRAME
      ↓
     Premium?
      ├── YES → [5] PREMIUM CUSTOMIZE
      └── NO ──────────────────────┐
                                    ↓
[6] RESULT + QR + CONFIRM PRINT
      ↓
[7] PRINTING
      ↓
[8] PRINT SUCCESS
      ↓
RESET SESSION
      ↓
START
```

`PREMIUM CUSTOMIZE` is conditional and does not exist in normal product
flows.

------------------------------------------------------------------------

# 3. Screen 1 --- START

The current Start screen remains unchanged.

Example behavior:

``` text
CHẠM ĐỂ CHỤP ẢNH
```

On guest interaction:

``` text
START
→ SELECT PRODUCT
```

Do not replace or redesign this screen as part of this refactor unless
required for navigation compatibility.

------------------------------------------------------------------------

# 4. Screen 2 --- SELECT PRODUCT

## 4.1 Existing Screen to Modify

The current screen that was previously used for print quantity selection
must be modified in place.

Do not create a duplicate page unless the existing architecture makes
direct modification impossible.

Remove the old quantity behavior:

``` text
1 tấm
2 tấm
-/+
custom quantity
```

Remove:

-   increment button;
-   decrement button;
-   quantity stepper;
-   custom print quantity state;
-   quantity-based pricing logic associated with the old screen.

The screen becomes:

``` text
CHỌN LOẠI ẢNH
```

It contains **3 visual groups/cards** but **5 actual selectable
products**.

------------------------------------------------------------------------

# 5. Product Data --- Source of Truth

The following product definitions are authoritative for this Guest Flow.

  -----------------------------------------------------------------------------------------------
  Product ID           UI Group   Variant     Required      Price Physical        Print Premium
                                                 Shots            Output         Sheets 
  -------------------- ---------- --------- ---------- ---------- ---------- ---------- ---------
  `PREMIUM_POSTCARD`   Premium    3 shots            3 70,000 VNĐ 1 × 10×15           1 Yes
                       Postcard                                   postcard              

  `STRIP_2`            Photo      2 shots            2 70,000 VNĐ 2 × 5×15            1 No
                       Strip                                      strips on             
                                                                  one 10×15             
                                                                  print                 

  `STRIP_4`            Photo      4 shots            4 70,000 VNĐ 2 × 5×15            1 No
                       Strip                                      strips on             
                                                                  one 10×15             
                                                                  print                 

  `SHEET_4`            Photo      4 shots            4    80,000 1 × 10×15           1 No
                       Sheet                                  VNĐ sheets                

  `SHEET_6`            Photo      6 shots            6    80,000 1 × 10×15           1 No
                       Sheet                                  VNĐ sheets                
  -----------------------------------------------------------------------------------------------

Recommended model:

``` ts
type GuestProductId =
  | "PREMIUM_POSTCARD"
  | "STRIP_2"
  | "STRIP_4"
  | "SHEET_4"
  | "SHEET_6";

type GuestProductConfig = {
  id: GuestProductId;
  requiredShots: number;
  price: number;
  outputType: "POSTCARD_10X15" | "STRIP_5X15" | "SHEET_10X15";
  printSheets: number;
  premium: boolean;
};

const GUEST_PRODUCTS: Record<GuestProductId, GuestProductConfig> = {
  PREMIUM_POSTCARD: {
    id: "PREMIUM_POSTCARD",
    requiredShots: 3,
    price: 70000,
    outputType: "POSTCARD_10X15",
    printSheets: 1,
    premium: true,
  },

  STRIP_2: {
    id: "STRIP_2",
    requiredShots: 2,
    price: 70000,
    outputType: "STRIP_5X15",
    printSheets: 1,
    premium: false,
  },

  STRIP_4: {
    id: "STRIP_4",
    requiredShots: 4,
    price: 70000,
    outputType: "STRIP_5X15",
    printSheets: 1,
    premium: false,
  },

  SHEET_4: {
    id: "SHEET_4",
    requiredShots: 4,
    price: 100000,
    outputType: "SHEET_10X15",
    printSheets: 1,
    premium: false,
  },

  SHEET_6: {
    id: "SHEET_6",
    requiredShots: 6,
    price: 100000,
    outputType: "SHEET_10X15",
    printSheets: 1,
    premium: false,
  },
};
```

------------------------------------------------------------------------

# 6. Product Selection UI

## Group 1 --- Premium Postcard

One selectable option.

``` text
PREMIUM POSTCARD
3 SHOTS
70.000 VNĐ
```

Illustration:

-   one 10×15 postcard;
-   visual placeholder/layout in the center;
-   this option represents the Premium experience.

Selection:

``` text
selectedProductId = PREMIUM_POSTCARD
requiredShots = 3
price = 70000
printSheets = 1
premium = true
```

------------------------------------------------------------------------

## Group 2 --- Photo Strip

Price:

``` text
70.000 VNĐ
```

Contains two independent selectable variants.

### STRIP_2

Illustration:

``` text
2 × 5×15 strips
2 viewports per strip
```

Selection:

``` text
selectedProductId = STRIP_2
requiredShots = 2
price = 70000
printSheets = 1
```

### STRIP_4

Illustration:

``` text
2 × 5×15 strips
4 viewports per strip
```

Selection:

``` text
selectedProductId = STRIP_4
requiredShots = 4
price = 70000
printSheets = 1
```

The two illustrations are separate buttons.

------------------------------------------------------------------------

## Group 3 --- Photo Sheet

Price:

``` text
80.000 VNĐ
```

Contains two independent selectable variants.

### SHEET_4

Illustration:

``` text
1 × 10×15 sheets
4 vertical viewports per sheet
```

Selection:

``` text
selectedProductId = SHEET_4
requiredShots = 4
price = 80000
printSheets = 1
```

### SHEET_6

Illustration:

``` text
1 × 10×15 sheets
6 horizontal viewports per sheet
```

Selection:

``` text
selectedProductId = SHEET_6
requiredShots = 6
price = 80000
printSheets = 1
```

The two illustrations are separate buttons.

------------------------------------------------------------------------

# 7. Product Selection Behavior

Only one of the five products may be selected.

Example:

``` text
STRIP_2 selected
→ click SHEET_6
→ STRIP_2 becomes unselected
→ SHEET_6 becomes selected
```

The selected option must update session state immediately.

The Continue button:

``` text
no selection → disabled
valid selection → enabled
```

On Continue:

``` text
persist selected product
→ navigate to LIVE VIEW
```

Do not derive `requiredShots` later from frame selection.

`requiredShots` comes from the selected product.

------------------------------------------------------------------------

# 8. Screen 3 --- LIVE VIEW / CAPTURE

Live View reads:

``` ts
session.product.requiredShots
```

The capture loop is therefore:

  Product              Capture Loop
  ------------------ --------------
  Premium Postcard          3 shots
  Strip 2                   2 shots
  Strip 4                   4 shots
  Sheet 4                   4 shots
  Sheet 6                   6 shots

Conceptual flow:

``` text
LIVE VIEW
→ COUNTDOWN
→ CAPTURE
→ RECEIVE / SAVE SHOT
→ increment completedShots
→ completedShots < requiredShots?
     ├── YES → next countdown/capture
     └── NO  → SELECT FRAME
```

Important invariant:

``` text
camera shutter command != completed shot
```

A shot is counted only after the image required by the application has
been successfully received/saved according to the camera layer contract.

------------------------------------------------------------------------

# 9. Capture Session Data

Recommended minimum data:

``` ts
type CapturedShot = {
  shotIndex: number;
  filePath: string;
  capturedAt: string;
};

type GuestSession = {
  id: string;

  product: GuestProductConfig;

  shots: CapturedShot[];

  selectedPhotoIndex?: number;
  selectedFrameId?: string;

  premiumCustomization?: {
    enabled: boolean;
    dataPath?: string;
  };

  finalOutput?: {
    printFile?: string;
    shareFile?: string;
  };

  printStatus?:
    | "IDLE"
    | "QUEUED"
    | "PRINTING"
    | "SUCCESS"
    | "FAILED";

  shareStatus?:
    | "IDLE"
    | "UPLOADING"
    | "READY"
    | "PENDING"
    | "FAILED";
};
```

------------------------------------------------------------------------

# 10. Screen 4 --- SELECT FRAME

After capture is complete:

``` text
→ SELECT FRAME
```

Templates/frames must be compatible with the selected product.

Examples:

``` text
STRIP_2
→ only 2-shot strip frames

STRIP_4
→ only 4-shot strip frames

SHEET_4
→ only 4-shot sheet frames

SHEET_6
→ only 6-shot sheet frames
```

Frame filters/styles may exist, but they must not expose incompatible
layouts.

------------------------------------------------------------------------

# 11. Premium Special Behavior

Premium is different from all other products.

The guest captures:

``` text
3 shots
```

but the Premium postcard uses:

``` text
1 selected photo
```

Therefore the Premium frame screen must also allow the guest to select
which captured photo will be used.

Example:

``` text
[SHOT 1] [SHOT 2] [SHOT 3]
            ↑
         selected
```

State:

``` ts
selectedPhotoIndex = 2;
selectedFrameId = "premium-frame-id";
```

The guest can change the selected Premium photo before continuing.

This is not required for the current non-Premium products.

Premium flow:

``` text
3 captured shots
→ choose 1 preferred photo
→ choose Premium frame
→ Premium Customize
```

------------------------------------------------------------------------

# 12. Screen 5 --- PREMIUM CUSTOMIZE

This screen is only entered when:

``` ts
session.product.premium === true
```

Current Premium customization requirement:

``` text
DRAW
+
TEXT
```

The implementation may reuse existing drawing/customization
capabilities.

Required minimum behavior:

-   draw on the Premium composition;
-   select/change drawing color if already supported;
-   erase if already supported;
-   add text;
-   edit/remove text if supported by the current editor;
-   preserve customization when navigating forward/back where supported.

The customization applies to:

``` text
selected Premium photo
+
selected Premium frame
```

Non-Premium:

``` text
SELECT FRAME
→ RESULT
```

Premium:

``` text
SELECT FRAME / PHOTO
→ DRAW + TEXT
→ RESULT
```

------------------------------------------------------------------------

# 13. Screen 6 --- RESULT + QR + CONFIRM PRINT

There is no separate Preview screen.

This screen is both:

1.  final result preview;
2.  QR delivery screen;
3.  print confirmation screen.

The system must compose the final output before presenting this screen.

## Non-Premium composition

``` text
captured shots
+
selected frame
→ final output
```

## Premium composition

``` text
selectedPhoto
+
selected Premium frame
+
draw/text customization
→ final output
```

Display:

``` text
FINAL RESULT

[final composition]

[QR CODE]

price

[BACK]
[CONFIRM PRINT]
```

The QR represents the digital session/result.

The QR/share flow may proceed independently from the physical printer
where the current architecture supports it.

------------------------------------------------------------------------

# 14. Confirm Print

The printer must not start merely because the Result screen opened.

Printing starts only after:

``` text
CONFIRM PRINT
```

On confirmation:

``` text
freeze/finalize current result
→ create/use final print asset
→ create print job
→ navigate to PRINTING
```

After confirmation, do not allow the active print job to be silently
changed by editing the frame/photo/customization state.

------------------------------------------------------------------------

# 15. Physical Print Rules

These are the current agreed physical outputs.

## PREMIUM_POSTCARD

``` text
requiredShots = 3
selected photos used in final = 1
physical output = 1 × 10×15 postcard
printSheets = 1
price = 70.000 VNĐ
```

## STRIP_2

``` text
requiredShots = 2
physical output = 2 × 5×15 strips
printer source = 1 × 10×15 sheet containing both strips
printSheets = 1
price = 70.000 VNĐ
```

## STRIP_4

``` text
requiredShots = 4
physical output = 2 × 5×15 strips
printer source = 1 × 10×15 sheet containing both strips
printSheets = 1
price = 70.000 VNĐ
```

## SHEET_4

``` text
requiredShots = 4
physical output = 2 × 10×15 sheets
printSheets = 2
price = 100.000 VNĐ
```

## SHEET_6

``` text
requiredShots = 6
physical output = 2 × 10×15 sheets
printSheets = 2
price = 100.000 VNĐ
```

Important:

``` text
requiredShots != printSheets
```

Example:

``` text
SHEET_6
requiredShots = 6
printSheets = 2
```

------------------------------------------------------------------------

# 16. Screen 7 --- PRINTING

After Confirm Print:

``` text
→ PRINTING
```

Guest-facing UI should remain simple.

Example:

``` text
ĐANG IN...

Vui lòng chờ trong giây lát.
```

If print progress is available:

``` text
Premium / Strip:
Đang in lượt 1/1

Sheet 4 / Sheet 6:
Đang in lượt 1/2
→ Đang in lượt 2/2
```

Do not expose low-level printer implementation details to the guest.

------------------------------------------------------------------------

# 17. Print Failure

Minimum production behavior:

``` text
print failed
→ do not report SUCCESS
→ preserve session
→ preserve final print asset
→ expose retry/recovery path
→ log technical error
```

Do not reset to Start while a print failure still requires operator/user
handling unless the defined recovery policy explicitly decides to
abandon the job.

------------------------------------------------------------------------

# 18. Screen 8 --- PRINT SUCCESS

Only show success after the print layer reports successful completion.

Example:

``` text
IN THÀNH CÔNG

Vui lòng nhận ảnh.
```

The success screen may continue displaying the QR for a short configured
period.

Then:

``` text
success timeout
→ COMPLETE SESSION
→ RESET
→ START
```

------------------------------------------------------------------------

# 19. QR / Digital Result

The Result screen contains the QR before print confirmation.

The QR should represent the session/result rather than printer state.

Conceptually:

``` text
FINAL RESULT READY
        │
        ├── QR / DIGITAL SHARE
        │
        └── WAIT FOR CONFIRM PRINT
```

Therefore digital result generation and physical print confirmation are
separate concerns.

If network upload is temporarily unavailable:

``` text
preserve local final result
→ share status = PENDING
```

Do not destroy the local result.

Exact cloud retry behavior remains the responsibility of the
share/upload service.

------------------------------------------------------------------------

# 20. Back Navigation

Before Confirm Print, Back may be allowed according to the existing
Guest UX.

Expected conceptual paths:

## Premium

``` text
RESULT
→ PREMIUM CUSTOMIZE
→ FRAME / PHOTO
```

## Non-Premium

``` text
RESULT
→ FRAME
```

Do not accidentally clear already captured shots when navigating
backward.

After Confirm Print:

``` text
editing is locked for the active print job
```

------------------------------------------------------------------------

# 21. Session Reset

Reset occurs after successful completion or another explicitly defined
terminal session condition.

Reset Guest state:

``` text
selected product
shots
selected photo
selected frame
premium customization
result UI state
```

Preserve data required for:

``` text
logs
completed print records
digital delivery
pending upload/retry
```

Then:

``` text
→ START
```

Healthy hardware services do not need to be unnecessarily destroyed and
recreated solely because the Guest UI resets.

------------------------------------------------------------------------

# 22. Updated State Machine

Recommended logical states:

``` text
START
PRODUCT_SELECTION
LIVE_VIEW
COUNTDOWN
CAPTURING
SHOT_PROCESSING
FRAME_SELECTION
PREMIUM_CUSTOMIZE
RESULT
PRINTING
PRINT_SUCCESS
RESETTING
```

Supporting/error states may include:

``` text
CAMERA_RECOVERING
CAPTURE_ERROR
PRINT_ERROR
UPLOAD_PENDING
```

The UI flow should not be implemented as a blind:

``` ts
currentStep++;
```

because Premium contains an extra conditional branch.

Preferred transition logic:

``` text
FRAME_SELECTION
      ↓
isPremium?
├── YES → PREMIUM_CUSTOMIZE → RESULT
└── NO  → RESULT
```

------------------------------------------------------------------------

# 23. Complete Product Flows

## PREMIUM_POSTCARD

``` text
START
→ SELECT PREMIUM POSTCARD
→ requiredShots = 3
→ LIVE VIEW
→ CAPTURE ×3
→ SELECT 1 OF 3 PHOTOS + PREMIUM FRAME
→ DRAW + TEXT
→ RESULT + QR
→ CONFIRM PRINT
→ PRINT 1 × 10×15
→ PRINT SUCCESS
→ RESET
→ START
```

## STRIP_2

``` text
START
→ SELECT STRIP 2
→ requiredShots = 2
→ LIVE VIEW
→ CAPTURE ×2
→ SELECT COMPATIBLE FRAME
→ RESULT + QR
→ CONFIRM PRINT
→ PRINT 1 × 10×15 containing 2 strips
→ PRINT SUCCESS
→ RESET
→ START
```

## STRIP_4

``` text
START
→ SELECT STRIP 4
→ requiredShots = 4
→ LIVE VIEW
→ CAPTURE ×4
→ SELECT COMPATIBLE FRAME
→ RESULT + QR
→ CONFIRM PRINT
→ PRINT 1 × 10×15 containing 2 strips
→ PRINT SUCCESS
→ RESET
→ START
```

## SHEET_4

``` text
START
→ SELECT SHEET 4
→ requiredShots = 4
→ LIVE VIEW
→ CAPTURE ×4
→ SELECT COMPATIBLE FRAME
→ RESULT + QR
→ CONFIRM PRINT
→ PRINT 2 × 10×15
→ PRINT SUCCESS
→ RESET
→ START
```

## SHEET_6

``` text
START
→ SELECT SHEET 6
→ requiredShots = 6
→ LIVE VIEW
→ CAPTURE ×6
→ SELECT COMPATIBLE FRAME
→ RESULT + QR
→ CONFIRM PRINT
→ PRINT 2 × 10×15
→ PRINT SUCCESS
→ RESET
→ START
```

------------------------------------------------------------------------

# 24. Required Refactor Scope

The team should first inspect the existing Guest routes/components and
map old screens to the new flow.

Required changes:

1.  Keep Start screen.
2.  Remove the old standalone quantity-selection step from navigation.
3.  Modify the existing print-quantity UI into Product Selection.
4.  Remove old +/- quantity behavior.
5.  Implement the five product options.
6.  Persist selected product configuration in the Guest session.
7.  Make Live View capture loop consume `requiredShots`.
8.  Filter frames by selected product.
9.  Add Premium photo selection to the Premium frame flow.
10. Route Premium to Draw + Text customization.
11. Route non-Premium directly from Frame to Result.
12. Merge final Preview behavior into Result.
13. Put QR on Result.
14. Start printing only after Confirm Print.
15. Show Printing state.
16. Show Print Success only after actual successful printer completion.
17. Reset to Start after completion.

Avoid unrelated refactors unless required for these changes.

------------------------------------------------------------------------

# 25. Data Invariants

The following rules must remain true throughout the implementation.

### Invariant 1

``` text
selectedProductId
```

is the authoritative identifier for the selected product.

### Invariant 2

``` text
requiredShots
```

comes from product configuration, not from UI text or selected frame.

### Invariant 3

Premium always captures:

``` text
3 shots
```

and currently uses:

``` text
1 selected shot
```

for the final Premium postcard.

### Invariant 4

``` text
STRIP_2  → 2 shots
STRIP_4  → 4 shots
SHEET_4  → 4 shots
SHEET_6  → 6 shots
```

### Invariant 5

``` text
requiredShots != physical print quantity
```

### Invariant 6

Printing starts only after explicit:

``` text
CONFIRM PRINT
```

### Invariant 7

Print Success is shown only after the printer layer reports success.

### Invariant 8

Session reset must not delete data still required by
QR/upload/logging/print history.

------------------------------------------------------------------------

# 26. Acceptance Tests

## Navigation

-   Start screen still opens first.
-   Touch Start navigates to Product Selection.
-   Old standalone quantity screen is no longer part of the flow.
-   Product Selection navigates to Live View only after a valid
    selection.

## Premium

-   Selecting Premium sets `requiredShots = 3`.
-   Live View completes exactly 3 valid shots.
-   Premium Frame screen allows selecting one of the three shots.
-   Premium frame can be selected.
-   Premium routes to Draw + Text.
-   Final Result uses the selected shot, selected frame and Premium
    customization.
-   Confirm Print creates one 10×15 print job.

## Strip 2

-   Selecting `STRIP_2` sets `requiredShots = 2`.
-   Exactly two valid shots are required.
-   Only compatible frames are displayed.
-   Premium customization is skipped.
-   Final print source is one 10×15 sheet containing two 5×15 strips.

## Strip 4

-   Selecting `STRIP_4` sets `requiredShots = 4`.
-   Exactly four valid shots are required.
-   Only compatible frames are displayed.
-   Premium customization is skipped.
-   Final print source is one 10×15 sheet containing two strips.

## Sheet 4

-   Selecting `SHEET_4` sets `requiredShots = 4`.
-   Price is 100,000 VNĐ.
-   Print requires two 10×15 sheets.

## Sheet 6

-   Selecting `SHEET_6` sets `requiredShots = 6`.
-   Price is 100,000 VNĐ.
-   Print requires two 10×15 sheets.

## Result / QR

-   Result contains final composition.
-   Result contains QR.
-   Opening Result does not automatically start printing.
-   Confirm Print starts the print flow.

## Printing

-   Printing screen appears after confirmation.
-   One-sheet products complete after their required single physical
    print.
-   Two-sheet products do not report success after only the first sheet.
-   Printer failure does not report success.

## Reset

-   Successful print routes to Print Success.
-   Completion timeout resets Guest state.
-   Guest returns to Start.
-   The next session does not inherit the previous product, shots, frame
    or customization.

------------------------------------------------------------------------

# 27. Final Source of Truth

``` text
START
  ↓
SELECT PRODUCT
  │
  ├── PREMIUM_POSTCARD
  │      3 shots
  │      70K
  │      1 × 10×15
  │
  ├── STRIP_2
  │      2 shots
  │      70K
  │      2 × 5×15 on 1 print
  │
  ├── STRIP_4
  │      4 shots
  │      70K
  │      2 × 5×15 on 1 print
  │
  ├── SHEET_4
  │      4 shots
  │      100K
  │      2 × 10×15
  │
  └── SHEET_6
         6 shots
         100K
         2 × 10×15

  ↓
LIVE VIEW
  ↓
CAPTURE × requiredShots
  ↓
SELECT FRAME
  ↓
PREMIUM?
  ├── YES
  │     ↓
  │  SELECT 1 OF 3 PHOTOS
  │     ↓
  │  DRAW + TEXT
  │
  └── NO
        ↓
      SKIP CUSTOMIZE

  ↓
RESULT + QR
  ↓
CONFIRM PRINT
  ↓
PRINTING
  ↓
PRINT SUCCESS
  ↓
RESET
  ↓
START
```

------------------------------------------------------------------------

# 28. Implementation Principle

Keep the Guest experience simple while keeping technical rules explicit
in the data layer.

The UI should feel like:

``` text
Choose
→ Shoot
→ Style
→ Confirm
→ Print
→ Done
```

The application internally must still preserve:

``` text
product identity
required shot count
captured files
Premium selected photo
frame identity
customization data
final print asset
final share asset
print state
share state
session identity
```

Do not encode these business rules only in page labels or visual
components.
