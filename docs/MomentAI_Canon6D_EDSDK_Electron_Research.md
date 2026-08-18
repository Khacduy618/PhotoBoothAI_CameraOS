# MomentAI CameraOS — Canon EOS 6D + EDSDK + Electron Research

**Purpose:** Technical research reference for integrating the original Canon EOS 6D into MomentAI CameraOS.  
**Primary production target:** Windows 10 x64 PC  
**Development platform:** macOS  
**Desktop stack:** Electron + Vite + React + TypeScript  
**Camera:** Canon EOS 6D (original, not Mark II)

---

## 1. Executive Summary

The original Canon EOS 6D provides the core capabilities required by MomentAI CameraOS:

- USB connection to a computer.
- Remote Live View.
- Remote autofocus.
- Remote still capture.
- Still-image transfer to the computer.
- Camera-setting control.
- Remote movie recording through Canon's desktop tooling.
- Image download from camera media.
- Remote camera state/property monitoring.

For MomentAI, the important architectural constraint is that Canon's current EDSDK compatibility material must be treated as the source of truth for the exact architecture of the Canon bridge.

The Canon EDSDK RAW v13.19.0 compatibility matrix lists the original EOS 6D under the Windows 32-bit support column.

Therefore the recommended production architecture is:

```text
Windows 10 x64

Electron x64
    │
    │ IPC / Named Pipe / local process protocol
    ▼
CanonCameraBridge
    │
    │ architecture matching the validated EDSDK package
    ▼
Canon EDSDK
    │
    │ USB
    ▼
Canon EOS 6D
```

If the validated EOS 6D EDSDK package is x86-only:

```text
Electron x64
    │
    ▼
CanonCameraBridge x86
    │
    ▼
EDSDK x86
    │
    ▼
Canon EOS 6D
```

The Electron application itself does **not** need to become 32-bit.

---

## 2. Primary Official References

### 2.1 Canon EDSDK RAW Compatibility List

**Canon EDSDK RAW v13.19.0 Compatibility List**

https://developercommunity.usa.canon.com/resource/1670450894000/CDC_EDSDKRAW_Compat_List

Use this document to verify:

- EOS 6D support.
- Windows architecture support.
- Exact supported camera generation.
- Whether the EDSDK version being used still officially includes the original EOS 6D.

Important current finding:

```text
EOS 6D original

Windows 64-bit : not marked
Windows 32-bit : supported
```

This is the strongest reason for keeping Canon EDSDK outside the Electron process.

### 2.2 Canon EOS 6D Remote Live View / Remote Shooting

**Using the Remote Live View Function in EOS Utility to Shoot Still Photos and Movies Remotely — EOS 6D**

https://sg.canon/en/support/8201713600

This reference confirms the EOS 6D can support computer-controlled workflows including:

- Remote Live View.
- Still-photo capture.
- Autofocus from the computer.
- Movie recording.
- Transfer of captured still images to the computer.
- Camera/computer remote shooting workflow.

This reference is especially important because it is specific to the original EOS 6D.

### 2.3 Canon EOS 6D USB Connection Procedure

https://sg.canon/en/support/8201703400

Relevant production notes include:

- Camera connects through the EOS 6D `A/V OUT / DIGITAL` interface.
- USB communication is used for computer control.
- Auto Power Off should be disabled for long computer-controlled sessions.
- Canon recommends continuous-power options for long-running computer use.

MomentAI physical path:

```text
Canon EOS 6D
    │
    │ USB data cable
    ▼
Windows PC
```

The remote-control terminal is not the CameraOS data/control interface.

### 2.4 Canon EOS Utility Official Manual

https://cam.start.canon/en/S003/manual/html/index.html

Useful sections:

```text
Connecting the Camera and Computer

Transferring Images to a Computer

Configuring Camera Settings from a Computer

Remote Shooting from a Computer
    ├── Remote Live View Shooting
    ├── Remote Live View Window Functions
    ├── Still Shooting
    ├── Movie Recording
    ├── Timer-Controlled Shooting
    └── Troubleshooting
```

EOS Utility is useful as a capability reference and as a diagnostic application.

It should **not** run simultaneously with MomentAI's Canon integration in production.

### 2.5 Canon Remote Shooting Documentation

https://cam.start.canon/en/S003/manual/html/UG-03_RemoteCamera_0010.html

Useful for validating the general remote shooting feature set:

```text
Computer
    ↓
Camera remote control
    ↓
Live View
    ↓
Still capture
    ↓
Movie functions
    ↓
Camera setting control
```

### 2.6 Canon Remote Live View Documentation

https://cam.start.canon/tc/S003/manual/html/UG-03_RemoteCamera_0020.html

Useful for researching:

- Live View behavior.
- Focus behavior.
- Remote capture.
- Transfer of captured images to computer.
- Exposure / Live View controls.

### 2.7 Canon Remote Live View Window Reference

https://cam.start.canon/en/S003/manual/html/UG-06_Reference_0080.html

Useful for understanding the type of state exposed in Canon's own remote UI:

- AF points.
- Exposure simulation.
- Movie status.
- Recording time.
- Frame rate.
- Movie recording size.
- Movie compression.
- Focus-related information.
- Temperature warnings.
- Start/stop movie controls.

Not all of these capabilities should automatically be exposed by MomentAI.

The CameraAdapter should report only capabilities that have been validated on the actual EOS 6D.

---

## 3. Electron Official References

### 3.1 Electron Process Model

https://www.electronjs.org/docs/latest/tutorial/process-model

MomentAI should preserve a strict process boundary:

```text
React Renderer
    ↓
Preload
    ↓
Electron IPC
    ↓
Electron Main
    ↓
CameraService
    ↓
CameraAdapter
    ↓
CanonCameraBridge
```

React should never access Canon EDSDK, native DLLs, the filesystem, or Windows printing APIs directly.

### 3.2 Electron Native Code

https://www.electronjs.org/docs/latest/tutorial/native-code-and-electron

Electron supports integration with native code, but native components must match architecture/runtime constraints.

For EOS 6D, a direct native addon approach is not preferred because:

- the validated EDSDK package may be x86;
- Electron production is intended to remain x64;
- Canon crashes/errors should not crash Electron;
- camera SDK lifecycle is easier to isolate in a separate process.

Preferred approach:

```text
Electron x64
    ↓
IPC
    ↓
Canon Bridge process
    ↓
EDSDK
```

### 3.3 Electron Context Isolation

https://www.electronjs.org/docs/latest/tutorial/context-isolation

Renderer should receive a narrow application API such as:

```ts
window.momentai.camera.getStatus()
window.momentai.camera.startLiveView()
window.momentai.camera.stopLiveView()
window.momentai.camera.capture()
window.momentai.camera.autofocus()
```

Do not expose raw:

```ts
window.ipcRenderer
window.edsdk
window.nativeCamera
```

to React.

### 3.4 Electron Security Guidance

https://www.electronjs.org/docs/latest/tutorial/security

Relevant principles:

- context isolation enabled;
- sandbox renderer where practical;
- narrow preload API;
- validate IPC sender/input;
- renderer does not receive arbitrary filesystem/native execution access.

---

## 4. Canon EOS 6D Capability Matrix for MomentAI

| Capability | EOS 6D capability | MomentAI use |
|---|---|---|
| USB connection | Yes | Production camera transport |
| Remote Live View | Yes | Guest preview |
| Remote still capture | Yes | 1/2/4/6 shot flow |
| Remote autofocus | Yes | Optional focus policy |
| Still transfer to PC | Yes | Persist originals |
| Save to computer | Yes | Primary capture path |
| Save to camera card | Supported by Canon workflow | Backup strategy candidate |
| Camera settings | Yes, multiple settings | Admin/camera profile |
| Movie recording | Yes through Canon remote workflow | Future option |
| Movie download | Yes | Future option |
| State/property events | EDSDK feature area | Health/recovery |
| Live View frame download | EDSDK feature area | Electron preview |

Important:

> Capability on EOS Utility does not automatically prove exact EDSDK implementation behavior for the chosen SDK version.

Every production capability must be verified on:

```text
Windows 10 x64
+
exact Canon Bridge build
+
exact EDSDK package
+
physical EOS 6D
```

---

## 5. Recommended CameraAdapter Contract

```ts
interface CameraAdapter {
  initialize(): Promise<void>;
  dispose(): Promise<void>;

  getStatus(): Promise<CameraStatus>;
  getCapabilities(): Promise<CameraCapabilities>;

  startLiveView(): Promise<void>;
  stopLiveView(): Promise<void>;

  autofocus?(): Promise<void>;

  capture(context: CaptureContext): Promise<CapturedPhoto>;

  getProperties(): Promise<CameraProperties>;
  setProperty?<K extends keyof CameraProperties>(
    key: K,
    value: CameraProperties[K]
  ): Promise<void>;
}
```

Example capability model:

```ts
interface CameraCapabilities {
  liveView: boolean;
  stillCapture: boolean;
  autofocusControl: boolean;
  exposureControl: boolean;
  whiteBalanceControl: boolean;
  nativeStillDownload: boolean;
  movieRecording: boolean;
}
```

Do not assume all providers support all capabilities.

---

## 6. Canon Bridge Lifecycle

Target initialization flow:

```text
Bridge process starts
    ↓
Load EDSDK
    ↓
EdsInitializeSDK()
    ↓
EdsGetCameraList()
    ↓
Find EOS 6D
    ↓
EdsOpenSession()
    ↓
Register object event handler
    ↓
Register property event handler
    ↓
Register camera-state event handler
    ↓
Configure SaveTo / host capacity
    ↓
Read required properties
    ↓
Start EVF if requested
    ↓
CANON_READY
```

Shutdown:

```text
Stop EVF
    ↓
Unregister / release references
    ↓
EdsCloseSession()
    ↓
Release camera references
    ↓
EdsTerminateSDK()
    ↓
Bridge exits
```

---

## 7. Core EDSDK APIs to Research

The exact signatures and supported values must be taken from the EDSDK Programming Reference shipped with the official Canon SDK package.

### Initialization

```text
EdsInitializeSDK
EdsTerminateSDK
```

### Camera discovery

```text
EdsGetCameraList
EdsGetChildCount
EdsGetChildAtIndex
```

### Session

```text
EdsOpenSession
EdsCloseSession
```

### Reference lifecycle

```text
EdsRetain
EdsRelease
```

`EdsRelease` is especially important.

Leaking EDSDK references can create long-session instability.

---

## 8. Camera Property APIs

Research:

```text
EdsGetPropertySize
EdsGetPropertyData
EdsSetPropertyData
EdsGetPropertyDesc
```

Important property groups to validate:

```text
SaveTo
EVF output device
ISO
Aperture
Shutter speed
Exposure compensation
White balance
Drive mode
Image quality
AF mode
Available storage/capacity
```

Do not assume a property is writable merely because it can be read.

MomentAI should distinguish:

```ts
{
  readable: true,
  writable: false
}
```

when appropriate.

---

## 9. Save-to-Host / Capacity Research

Important keywords/API areas:

```text
kEdsPropID_SaveTo
EdsSetCapacity
kEdsCapacity
```

This area is critical when configuring the camera to transfer images to the host computer.

Research exact values for:

```text
SaveTo_Host
SaveTo_Camera
SaveTo_Both
```

if exposed by the validated EDSDK version.

Do not skip `EdsSetCapacity` when the SDK requires host capacity notification.

---

## 10. Live View / EVF Research

Core flow to validate:

```text
Set EVF output destination
    ↓
Create EVF stream
    ↓
Create EVF image reference
    ↓
EdsDownloadEvfImage()
    ↓
extract current EVF frame
    ↓
send newest frame to Electron
```

Important APIs / keywords:

```text
kEdsPropID_Evf_OutputDevice
EdsCreateMemoryStream
EdsCreateEvfImageRef
EdsDownloadEvfImage
```

Potential additional EVF properties:

```text
EVF zoom
EVF zoom position
EVF image position
EVF AF mode
EVF coordinate system
```

Only implement what the EOS 6D proves it supports.

---

## 11. Live View Transport Into Electron

Avoid:

```text
EVF JPEG
    ↓
Base64
    ↓
JSON
    ↓
IPC
```

for every frame.

Base64 increases memory footprint and serialization cost.

Preferred approach:

```text
EOS 6D EVF
    ↓
EDSDK
    ↓
CanonBridge
    ↓
binary frame
    ↓
Electron Main / preload boundary
    ↓
React preview
```

Production rules:

```text
queue size ≈ 1
newest frame wins
stale EVF frames may be dropped
still-image transfer must never be dropped
```

Live View must never be treated as the original captured photograph.

---

## 12. Autofocus Research

Important keywords:

```text
kEdsCameraCommand_DoEvfAf
kEdsCameraCommand_DriveLensEvf
```

The exact EOS 6D support and behavior must be verified.

MomentAI focus policy should remain configurable:

```text
AUTO_EVERY_SHOT
AUTO_FIRST_SHOT
MANUAL_LOCKED
```

A fixed photobooth may perform more reliably using a manually locked focus distance.

---

## 13. Still Capture Research

Important command:

```text
EdsSendCommand
kEdsCameraCommand_TakePicture
```

Potential alternative shutter-control path to research:

```text
kEdsCameraCommand_PressShutterButton
```

The final production implementation must be based on the official EDSDK documentation and EOS 6D validation.

Do not mark a shot complete after the shutter command alone.

---

## 14. Object Event / Image Transfer Research

This is one of the most important parts of the entire Canon integration.

Research:

```text
EdsSetObjectEventHandler
kEdsObjectEvent_DirItemRequestTransfer
```

Expected event-driven flow:

```text
capture request
    ↓
shutter command
    ↓
EOS 6D creates image
    ↓
object event
    ↓
directory item reference
    ↓
download
    ↓
persist
```

Do **not** implement:

```text
capture()
sleep(3000)
scan directory
```

as the primary capture strategy.

---

## 15. Still Image Download

Important APIs / keywords:

```text
EdsGetDirectoryItemInfo
EdsCreateFileStream
EdsCreateMemoryStream
EdsDownload
EdsDownloadComplete
EdsDownloadCancel
```

Recommended flow:

```text
DirItemRequestTransfer
    ↓
EdsGetDirectoryItemInfo()
    ↓
create temporary output
    ↓
EdsDownload()
    ↓
EdsDownloadComplete()
    ↓
validate JPEG
    ↓
fsync / close
    ↓
atomic rename
    ↓
sessions/<sessionId>/originals/shot_XX.jpg
```

If transfer fails:

```text
EdsDownloadCancel()
```

when required by the SDK lifecycle.

---

## 16. Production Capture Invariant

MomentAI must preserve:

```text
shotComplete =
  captureCommandAccepted
  AND imageObjectReceived
  AND imageDownloaded
  AND imageValidated
  AND imagePersisted
```

Never:

```text
TakePicture returned success
→ shotComplete = true
```

---

## 17. Canon State Events

Research:

```text
EdsSetCameraStateEventHandler
```

Important state event keywords:

```text
kEdsStateEvent_Shutdown
kEdsStateEvent_WillSoonShutDown
kEdsStateEvent_ShutDownTimerUpdate
```

Other state events and errors must be mapped from the exact EDSDK reference.

MomentAI needs typed states such as:

```text
CONNECTED
READY
BUSY
RECOVERING
DISCONNECTED
ERROR
```

---

## 18. Canon Property Events

Research:

```text
EdsSetPropertyEventHandler
```

Use property events to keep CameraOS synchronized when:

```text
ISO changes
Aperture changes
Shutter changes
White balance changes
Drive mode changes
Image quality changes
EVF state changes
```

Avoid polling all camera properties continuously.

---

## 19. Important EDSDK Error Research

Search and map the exact official error constants.

Important keywords:

```text
EDS_ERR_NOT_READY
EDS_ERR_OBJECT_NOTREADY
EDS_ERR_DEVICE_BUSY
EDS_ERR_NOT_SUPPORTED
EDS_ERR_INVALID_PARAMETER
EDS_ERR_SESSION_NOT_OPEN
EDS_ERR_COMM_DISCONNECTED
```

Exact identifiers may vary by SDK version; always verify against the official header/reference.

MomentAI error mapping should produce domain errors:

```ts
type CameraErrorCode =
  | "CAMERA_NOT_FOUND"
  | "CAMERA_BUSY"
  | "CAMERA_DISCONNECTED"
  | "LIVEVIEW_NOT_READY"
  | "AUTOFOCUS_FAILED"
  | "CAPTURE_TIMEOUT"
  | "TRANSFER_TIMEOUT"
  | "IMAGE_DOWNLOAD_FAILED"
  | "PROPERTY_NOT_SUPPORTED"
  | "SDK_INITIALIZATION_FAILED"
  | "UNKNOWN_CANON_ERROR";
```

Preserve the original Canon/EDSDK result code in technical logs.

---

## 20. Canon Command Logging

Each production Canon command should produce:

```text
request
    ↓
dispatch
    ↓
event/result
    ↓
success/failure
```

Example:

```json
{
  "event": "camera.canon.command.request",
  "correlationId": "camcmd_001",
  "sessionId": "sess_001",
  "shotIndex": 2,
  "provider": "canon",
  "command": "CAPTURE_STILL",
  "sdkFunction": "EdsSendCommand"
}
```

The same `correlationId` should connect:

```text
capture request
shutter command
object event
download
persist
capture complete
```

---

## 21. macOS Development Fallback

macOS development should use:

```text
DeviceCameraAdapter
    ↓
macOS camera
```

This validates:

- Guest UI.
- Live View UI.
- Countdown.
- session orchestration.
- capture pool.
- composition.
- storage.
- QR/share flow.
- print orchestration.
- error UI.
- reset behavior.

It does **not** validate Canon EDSDK.

---

## 22. Canon Command Shadow Mode

While using the macOS camera, MomentAI should optionally emit simulated Canon intent logs:

```text
[DEVICE] LIVE_VIEW START
[CANON:SHADOW] START_LIVE_VIEW

[CANON:SHADOW] AUTOFOCUS
[DEVICE] STILL_CAPTURE

[CANON:SHADOW] CAPTURE_STILL
[DEVICE] STILL_ACQUIRED
```

Important invariants:

```text
shadowCommandSent != canonCommandSent
shadowSuccess     != canonSdkSuccess
deviceCapture     != canonCapture
```

Shadow mode is for:

- command ordering;
- diagnostics UI;
- correlation IDs;
- development logging;
- testing Guest/CaptureManager behavior.

It is never evidence of Canon compatibility.

---

## 23. EOS Utility as a Diagnostic Tool

EOS Utility is valuable before debugging MomentAI.

Suggested diagnostic procedure:

```text
Connect EOS 6D via USB
    ↓
Open EOS Utility
    ↓
Verify camera detected
    ↓
Verify Remote Live View
    ↓
Verify autofocus
    ↓
Verify remote capture
    ↓
Verify image transfer to PC
    ↓
Close EOS Utility completely
    ↓
Start MomentAI CanonBridge
```

Do not run EOS Utility at the same time as production CanonBridge.

Only one application should own the camera communication session.

---

## 24. Canon Power Requirements for Production

For long events:

```text
Canon EOS 6D
    ↓
continuous AC power / dummy battery solution
```

Avoid relying only on an LP-E6 battery for multi-hour events.

Production camera setup should validate:

```text
Auto Power Off: disabled
Wi-Fi: disabled if not needed
Image review: minimized/off if appropriate
Image quality: controlled
Exposure profile: controlled
White balance: controlled
Focus strategy: controlled
```

Exact settings must be tested on the real booth.

---

## 25. Still Image Storage Strategy

Recommended session path:

```text
MomentAIData/
└── sessions/
    └── YYYY-MM-DD/
        └── <sessionId>/
            ├── session.json
            ├── originals/
            │   ├── shot_01.jpg
            │   ├── shot_02.jpg
            │   └── ...
            ├── preview/
            ├── customization/
            └── output/
                ├── final-master.png
                ├── final-share.jpg
                ├── final-print.jpg
                └── timelapse-share.mp4
```

Canon originals must remain separate from:

- display preview;
- final print;
- share image;
- timelapse output.

---

## 26. Movie / Timelapse Research

EOS 6D supports remote movie workflows through Canon tooling.

However, MomentAI should evaluate two different approaches.

### Option A — Record movie on Canon

```text
START RECORD
    ↓
guest session
    ↓
STOP RECORD
    ↓
movie stored on camera media
    ↓
download
    ↓
process / speed up
    ↓
timelapse-share.mp4
```

Potential disadvantages:

- larger transfer;
- longer post-session latency;
- movie lives on camera media first;
- more camera state complexity.

### Option B — Build timelapse from Live View frames

```text
EVF stream
    ↓
sample frames
    ↓
local frame buffer
    ↓
FFmpeg
    ↓
timelapse-share.mp4
```

Potential advantages:

- no large movie transfer from camera;
- complete control over timelapse duration;
- easier background encoding.

This option requires benchmarking EOS 6D EVF:

```text
FPS
resolution
JPEG quality
latency
CPU usage
frame stability
6–8 hour stability
```

No final decision should be made until the hardware spike is complete.

---

## 27. Recommended Canon Hardware / SDK Spike

Before implementing the full Canon subsystem:

```text
01. Start Windows 10 x64
02. Connect EOS 6D
03. Initialize validated EDSDK
04. Enumerate camera
05. Open session
06. Read camera metadata
07. Configure host save
08. Start Live View
09. Download EVF frames for >= 10 minutes
10. Run autofocus command
11. Trigger still capture
12. Receive object event
13. Download JPEG
14. Validate JPEG
15. Persist JPEG
16. Resume/continue Live View
17. Repeat 100 captures
18. Disconnect USB
19. Recover/reconnect
20. Power-cycle camera
21. Restart Canon bridge
22. Confirm Electron survives bridge failure
23. Run >= 60 minute Live View test
24. Run multi-hour soak test
```

This spike should be completed before heavy Canon-specific UI work.

---

## 28. Production Soak Tests

Recommended minimum:

```text
Live View:             >= 4 hours
Capture sequence:      >= 500 captures
USB reconnect:         >= 20 cycles
Camera power-cycle:    >= 20 cycles
Bridge restart:        >= 20 cycles
Electron restart:      >= 20 cycles
Storage near-full:     test
Canon busy state:      test
AF failure:            test
Image transfer fail:   test
```

Pass condition:

```text
0 silent data loss
0 false shotComplete
0 Electron crash caused by Canon bridge
0 unreleased/accumulating SDK resource leak
```

---

## 29. Recommended GitHub Research References

These sources are useful for implementation examples only.

They are **not** a replacement for Canon's official SDK documentation.

### Canon.Eos.Framework

https://github.com/esskar/Canon.Eos.Framework

Example SDK mapping file:

https://github.com/esskar/Canon.Eos.Framework/blob/master/Canon.Eos.Framework/Internal/SDK/EDSDK.cs

Useful to inspect how native functions/constants are represented in C#.

---

## 30. GitHub Code Searches

### EVF / Live View

https://github.com/search?q=EdsDownloadEvfImage&type=code

Search keyword:

```text
EdsDownloadEvfImage
```

### Still Capture

https://github.com/search?q=kEdsCameraCommand_TakePicture&type=code

Search:

```text
kEdsCameraCommand_TakePicture
```

### Autofocus

https://github.com/search?q=kEdsCameraCommand_DoEvfAf&type=code

Search:

```text
kEdsCameraCommand_DoEvfAf
kEdsCameraCommand_DriveLensEvf
```

### Image Download

https://github.com/search?q=EdsDownloadComplete&type=code

Search:

```text
EdsDownload
EdsDownloadComplete
EdsDownloadCancel
```

### Object Transfer Event

https://github.com/search?q=kEdsObjectEvent_DirItemRequestTransfer&type=code

Search:

```text
kEdsObjectEvent_DirItemRequestTransfer
```

### Camera State Events

https://github.com/search?q=EdsSetCameraStateEventHandler&type=code

Search:

```text
EdsSetCameraStateEventHandler
```

### Property Events

https://github.com/search?q=EdsSetPropertyEventHandler&type=code

Search:

```text
EdsSetPropertyEventHandler
```

---

## 31. Full Research Keyword Set

```text
Canon EOS 6D EDSDK

EOS 6D EDSDK 32 bit
EOS 6D EDSDK Windows 10
EOS 6D EDSDK compatibility

EdsInitializeSDK
EdsTerminateSDK

EdsGetCameraList
EdsGetChildCount
EdsGetChildAtIndex

EdsOpenSession
EdsCloseSession

EdsRetain
EdsRelease

EdsGetPropertySize
EdsGetPropertyData
EdsSetPropertyData
EdsGetPropertyDesc

kEdsPropID_SaveTo
EdsSetCapacity
kEdsCapacity

kEdsPropID_Evf_OutputDevice
EdsCreateMemoryStream
EdsCreateEvfImageRef
EdsDownloadEvfImage

EdsSendCommand
kEdsCameraCommand_TakePicture
kEdsCameraCommand_PressShutterButton

kEdsCameraCommand_DoEvfAf
kEdsCameraCommand_DriveLensEvf

EdsSetObjectEventHandler
kEdsObjectEvent_DirItemRequestTransfer

EdsGetDirectoryItemInfo
EdsCreateFileStream
EdsDownload
EdsDownloadComplete
EdsDownloadCancel

EdsSetPropertyEventHandler
EdsSetCameraStateEventHandler

EOS 6D EDSDK Live View
EOS 6D EDSDK autofocus
EOS 6D EDSDK image download
EOS 6D EDSDK save to host
EOS 6D EDSDK reconnect
EOS 6D EDSDK disconnect
EOS 6D EDSDK camera busy
EOS 6D EDSDK object event

EDS_ERR_NOT_READY
EDS_ERR_OBJECT_NOTREADY
EDS_ERR_DEVICE_BUSY
EDS_ERR_COMM_DISCONNECTED
```

---

## 32. Recommended Research Order for Codex / Claude / Kiro

```text
01 Compatibility
    ↓
02 SDK package + headers + samples
    ↓
03 Initialization
    ↓
04 Camera discovery
    ↓
05 Session lifecycle
    ↓
06 Property/capability discovery
    ↓
07 SaveTo / capacity
    ↓
08 Live View start
    ↓
09 EVF frame download
    ↓
10 Autofocus
    ↓
11 Still capture command
    ↓
12 Object event
    ↓
13 JPEG download
    ↓
14 Validation + persistence
    ↓
15 Live View recovery
    ↓
16 Property events
    ↓
17 Camera-state events
    ↓
18 USB disconnect/reconnect
    ↓
19 Error mapping
    ↓
20 Shutdown / reference release
```

---

## 33. Suggested Repository Documentation Layout

```text
docs/
├── production/
│   └── MomentAI_CameraOS_Production_Brief_v3.1.md
│
├── camera/
│   ├── MomentAI_Canon6D_EDSDK_Electron_Research.md
│   ├── canon6d-capability-matrix.md
│   ├── canon-bridge-protocol.md
│   ├── canon-error-map.md
│   └── canon-hardware-spike-results.md
│
└── references/
    └── README.md
```

This file is intended to become:

```text
docs/camera/MomentAI_Canon6D_EDSDK_Electron_Research.md
```

---

## 34. Final Architectural Recommendation

```text
                        MOMENTAI CAMERAOS

                              React
                                │
                              Preload
                                │
                         Electron Main x64
                                │
                           CameraService
                                │
                    ┌───────────┴───────────┐
                    │                       │
              DeviceCameraAdapter    CanonCameraAdapter
                    │                       │
               macOS camera          CanonCameraBridge
                                            │
                                            │
                                   validated EDSDK
                                            │
                                           USB
                                            │
                                       Canon EOS 6D
```

Development:

```text
macOS camera
+
Canon Command Shadow logs
```

Production:

```text
Windows 10 x64
+
Electron x64
+
Canon Bridge architecture matching EDSDK
+
physical EOS 6D
```

The Guest Flow must remain independent of the physical camera provider.

---

## 35. Key Production Rules

1. React never calls EDSDK directly.
2. Electron x64 should not directly load an incompatible x86 EDSDK DLL.
3. Canon SDK lifecycle belongs to CanonCameraBridge.
4. Still capture completes only after image transfer and persistence.
5. Live View frames may be dropped; captured still images may not.
6. Every Canon command/event must have a correlation ID.
7. Canon bridge failure must not crash Electron.
8. USB disconnect must become a recoverable typed state.
9. EOS Utility must not compete with MomentAI for the camera.
10. Production must use continuous camera power.
11. Canon integration is validated only on the physical Windows + EOS 6D environment.
12. macOS fallback and Canon Shadow Mode are development tools, not Canon validation.
13. EDSDK headers, Programming Reference, samples, and compatibility matrix from the exact SDK package are the final implementation source of truth.
14. GitHub wrappers are implementation examples only.
15. Run long-duration soak tests before event production.

---

## 36. Required Canon Service Inventory

Current repository status:

```text
Implemented:
- CameraAdapter contract
- FakeCameraAdapter
- CaptureLoopManager software/fake-contract foundation
- Electron camera IPC skeleton
- Canon Shadow command logging skeleton

Not implemented:
- real Canon EDSDK adapter
- CanonCameraBridge process
- real EOS 6D discovery/session lifecycle
- real Remote Live View frame download
- real still capture/object-event transfer/download/persist
- real Canon property read/write service
- real Canon error mapper from EDSDK constants
- real Windows + EOS 6D hardware evidence
```

Production Canon support requires the following services.

### 36.1 CanonBridgeProcessManager

Runs in Electron main and owns the external bridge process.

Responsibilities:

```text
start bridge
stop bridge
restart bridge after crash
heartbeat / health check
command timeout
bridge stderr/stdout log capture
crash isolation so Electron survives Canon SDK faults
```

Recommended interface:

```ts
interface CanonBridgeProcessManager {
  start(): Promise<Result<void>>;
  stop(): Promise<Result<void>>;
  restart(): Promise<Result<void>>;
  request<TResponse>(request: CanonBridgeRequest): Promise<Result<TResponse>>;
  getStatus(): CanonBridgeProcessStatus;
}
```

### 36.2 CanonBridgeProtocol

Defines the stable protocol between Electron main and CanonCameraBridge.

Recommended split:

```text
Control channel:
  JSON-RPC over stdio or named pipe

Live View frame channel:
  binary named pipe / local WebSocket / shared memory or file-backed ring buffer
```

Do not stream every EVF frame as base64 JSON.

Minimum command set:

```text
bridge.ping
camera.discover
camera.openSession
camera.closeSession
camera.getStatus
camera.getCapabilities
camera.startLiveView
camera.stopLiveView
camera.captureStill
camera.autofocus
camera.getProperties
camera.setProperty
camera.shutdown
```

Minimum event set:

```text
bridge.ready
bridge.error
camera.connected
camera.disconnected
camera.busy
camera.ready
camera.propertyChanged
camera.stateChanged
liveView.frame
capture.objectEvent
capture.downloadStarted
capture.downloadCompleted
capture.persisted
capture.failed
```

Every request/event must carry:

```text
requestId
correlationId
sessionId when applicable
shotIndex when applicable
timestamp
provider
```

### 36.3 CanonEdsdkLifecycleService

Runs inside CanonCameraBridge.

Responsibilities:

```text
load EDSDK runtime
EdsInitializeSDK
EdsGetCameraList
find original EOS 6D
EdsOpenSession
register object/property/state handlers
configure SaveTo / capacity
read initial properties
EdsCloseSession
EdsTerminateSDK
release every EDSDK reference
```

Do not leak `EdsBaseRef` references. Every retained or returned SDK reference must have a clear release owner.

### 36.4 CanonLiveViewService

Responsibilities:

```text
set EVF output device
create EVF memory stream
create EVF image reference
run bounded EVF frame loop
EdsDownloadEvfImage
publish newest frame only
drop stale frames
stop EVF cleanly before shutdown when required
```

Rules:

```text
Live View frames are preview only.
Live View frames are never originals.
Preview frames may be dropped.
Still image transfer may never be dropped silently.
Live View must not block still capture completion.
```

### 36.5 CanonCaptureService

Owns still capture transactions.

Required invariant:

```text
shotComplete =
  shutterCommandAccepted
  AND objectEventReceived
  AND imageDownloaded
  AND imageValidated
  AND imagePersisted
```

Never mark a shot complete from `EdsSendCommand(TakePicture)` alone.

Transaction flow:

```text
acquire capture lock
validate camera READY
optional autofocus
send shutter command
wait for DirItemRequestTransfer
resolve object ref for the pending shot
download to temp path
EdsDownloadComplete
validate JPEG
fsync/close if possible
atomic rename to originals/shot_XX.jpg
return persisted media ref
release capture lock
```

Timeouts required:

```text
autofocus timeout
shutter command timeout
object event timeout
download timeout
persist timeout
```

### 36.6 CanonObjectTransferService

Responsibilities:

```text
receive kEdsObjectEvent_DirItemRequestTransfer
match object event to pending capture transaction
ignore or quarantine unexpected objects
download via EdsDownload
call EdsDownloadComplete on success
call EdsDownloadCancel when required on failure
release directory item references
```

Primary strategy must be object-event-driven, not `sleep + scan folder`.

### 36.7 CanonPropertyService

Responsibilities:

```text
read property size/data
read property descriptors
write only validated writable properties
cache capabilities
emit property changed events
```

Properties to validate on physical EOS 6D:

```text
SaveTo
EVF output device
ISO
aperture
shutter speed
exposure compensation
white balance
drive mode
image quality
AF mode
battery level
storage/capacity
```

Represent capability as:

```ts
interface CameraPropertyCapability<T> {
  readable: boolean;
  writable: boolean;
  current?: T;
  allowedValues?: readonly T[];
}
```

### 36.8 CanonAutofocusService

Research exact EOS 6D behavior for:

```text
kEdsCameraCommand_DoEvfAf
kEdsCameraCommand_DriveLensEvf
```

Supported focus policies:

```text
MANUAL_LOCKED
AUTO_FIRST_SHOT
AUTO_EVERY_SHOT
```

Photobooth production should prefer `MANUAL_LOCKED` when the booth distance is fixed and validated.

### 36.9 CanonErrorMapper

Maps raw EDSDK errors to CameraOS typed errors.

Required behavior:

```text
preserve raw EDSDK code in technical logs
show guest-safe copy in guest UI
show operator-readable action in admin UI
classify recoverable vs blocking
```

Initial mapping targets:

```text
EDS_ERR_NOT_READY           -> CAMERA_NOT_READY
EDS_ERR_OBJECT_NOTREADY     -> IMAGE_OBJECT_NOT_READY
EDS_ERR_DEVICE_BUSY         -> CAMERA_BUSY
EDS_ERR_NOT_SUPPORTED       -> PROPERTY_NOT_SUPPORTED
EDS_ERR_INVALID_PARAMETER   -> CANON_INVALID_PARAMETER
EDS_ERR_SESSION_NOT_OPEN    -> CAMERA_SESSION_NOT_OPEN
EDS_ERR_COMM_DISCONNECTED   -> CAMERA_DISCONNECTED
unknown                    -> UNKNOWN_CANON_ERROR
```

Exact constants must be verified against the official SDK headers for the selected EDSDK package.

### 36.10 CanonCommandLogger

Every command should log four phases:

```text
request
dispatch
event/result
success/failure
```

The same `correlationId` must connect:

```text
capture request
optional autofocus
shutter command
object event
download
validation
persistence
capture complete
```

### 36.11 CanonEdsdkAdapter

The adapter exposed to CameraOS should implement the repository camera contract while delegating native work to the bridge.

```ts
class CanonEdsdkAdapter implements CameraAdapter {
  initialize(): Promise<Result<void>>;
  getStatus(): Promise<CameraStatus>;
  startLiveView(): Promise<Result<void>>;
  stopLiveView(): Promise<Result<void>>;
  capture(context: CaptureContext): Promise<Result<CapturedPhoto>>;
  dispose(): Promise<Result<void>>;
}
```

The adapter must never claim `provider: canon_edsdk` ready unless the bridge is connected to a validated physical EOS 6D session.

---

## 37. Canon Bridge State Machine

Recommended canonical states:

```text
BRIDGE_OFFLINE
BRIDGE_STARTING
SDK_INITIALIZING
SDK_READY
NO_CAMERA
CAMERA_FOUND
SESSION_OPENING
SESSION_OPEN
CONFIGURING_CAMERA
READY
LIVE_VIEW_STARTING
LIVE_VIEW_RUNNING
CAPTURE_LOCKED
CAPTURING
TRANSFERRING
PERSISTING
RECOVERING
DISCONNECTED
ERROR
SHUTTING_DOWN
```

Rules:

```text
Only READY or LIVE_VIEW_RUNNING may accept a new still capture.
CAPTURE_LOCKED/CAPTURING/TRANSFERRING/PERSISTING reject provider switch and admin test capture.
DISCONNECTED/ERROR must surface as BLOCKED readiness for new sessions.
RECOVERING must have bounded retries and operator-visible status.
Resetting a guest session must not close a healthy Canon session.
```

---

## 38. Capture Transaction Contract

Canonical request:

```ts
interface CanonCaptureStillRequest {
  requestId: string;
  correlationId: string;
  sessionId: string;
  shotIndex: number;
  formatId: string;
  focusPolicy: 'MANUAL_LOCKED' | 'AUTO_FIRST_SHOT' | 'AUTO_EVERY_SHOT';
  timeoutMs: number;
}
```

Canonical success:

```ts
interface CanonCaptureStillSuccess {
  provider: 'canon_edsdk';
  cameraModel: 'Canon EOS 6D';
  correlationId: string;
  sessionId: string;
  shotIndex: number;
  original: PersistedMediaRef;
  timings: {
    shutterCommandMs: number;
    objectEventMs: number;
    downloadMs: number;
    persistMs: number;
    totalMs: number;
  };
}
```

Canonical failure:

```ts
interface CanonCaptureStillFailure {
  provider: 'canon_edsdk';
  correlationId: string;
  sessionId: string;
  shotIndex: number;
  code: CameraErrorCode;
  rawCanonCode?: string | number;
  phase:
    | 'autofocus'
    | 'shutter-command'
    | 'object-event'
    | 'download'
    | 'validation'
    | 'persist'
    | 'unknown';
  recoverable: boolean;
  partialOriginals: PersistedMediaRef[];
}
```

---

## 39. Electron Runtime Control Surface

Renderer API should stay narrow:

```ts
window.momentai.guest.camera.status()
window.momentai.guest.camera.startLiveView()
window.momentai.guest.camera.stopLiveView()
window.momentai.guest.camera.capture(context)
window.momentai.guest.camera.onLiveViewFrame(callback)
window.momentai.guest.camera.offLiveViewFrame(callback)
```

Never expose:

```text
ipcRenderer
EDSDK raw functions
native pointers
absolute filesystem paths
shell execution
bridge process handles
```

Electron main should validate:

```text
sender origin / window role
session/capture ownership
shotIndex bounds
formatId validity
capture lock state
maintenance mode
```

---

## 40. Implementation Roadmap

Required order:

```text
1. Finish fake/device CaptureManager integration.
2. Add DeviceCameraAdapter evidence for development only.
3. Implement Canon Command Shadow Mode with correlation IDs.
4. Obtain exact official EDSDK package and validate x86/x64 support.
5. Build CanonCameraBridge proof-of-life on Windows.
6. Implement lifecycle/session discovery.
7. Implement Live View frame download and transport.
8. Implement event-driven still capture/download/persist.
9. Implement property/capability service.
10. Implement disconnect/reconnect recovery.
11. Run Canon hardware spike checklist.
12. Only then claim Canon PASS if evidence names the real hardware/environment.
```

Do not implement Canon UI claims before hardware confirms the underlying capability.

---

## 41. Hardware Validation Evidence Template

```text
Date:
Operator:
Windows machine:
Windows version:
CPU architecture:
Electron version:
Canon bridge build architecture:
EDSDK version:
EOS 6D body identifier/serial:
USB cable/port:
Power source:
EOS Utility diagnostic result:

Tests:
- enumerate camera:
- open session:
- read metadata:
- start live view:
- EVF duration:
- autofocus:
- capture one still:
- download JPEG:
- validate JPEG:
- persist original:
- 1/2/4/6 capture loop:
- USB disconnect recovery:
- bridge crash recovery:
- soak duration:

Result:
PASS | PARTIAL | FAIL

Notes:
```

---

## 42. Primary Source Index

Canon EDSDK compatibility:

https://developercommunity.usa.canon.com/resource/1670450894000/CDC_EDSDKRAW_Compat_List

Canon EOS 6D Remote Live View / still/movie:

https://sg.canon/en/support/8201713600

Canon EOS 6D USB connection:

https://sg.canon/en/support/8201703400

Canon EOS Utility manual:

https://cam.start.canon/en/S003/manual/html/index.html

Canon remote shooting:

https://cam.start.canon/en/S003/manual/html/UG-03_RemoteCamera_0010.html

Canon Remote Live View:

https://cam.start.canon/tc/S003/manual/html/UG-03_RemoteCamera_0020.html

Canon Remote Live View Window reference:

https://cam.start.canon/en/S003/manual/html/UG-06_Reference_0080.html

Electron Process Model:

https://www.electronjs.org/docs/latest/tutorial/process-model

Electron native code:

https://www.electronjs.org/docs/latest/tutorial/native-code-and-electron

Electron Context Isolation:

https://www.electronjs.org/docs/latest/tutorial/context-isolation

Electron Security:

https://www.electronjs.org/docs/latest/tutorial/security

Community implementation reference:

https://github.com/esskar/Canon.Eos.Framework

---

## 43. Research Status

This document separates:

**Officially supported/capability-backed**
from
**implementation details that still require validation on physical hardware**.

The next authoritative input should be the exact Canon EDSDK package obtained from Canon Developer Community, including:

```text
EDSDK headers
Programming Reference
API documentation
sample applications
redistribution/runtime files
compatibility notes
```

Those files should be treated as the definitive reference when implementing the CanonCameraBridge.
