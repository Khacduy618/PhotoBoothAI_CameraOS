# Testing Rules

Required categories:

- unit
- integration
- E2E
- real hardware

Always test:

- duplicate capture
- duplicate print
- camera disconnect
- AI failure
- processing failure
- storage failure
- printer offline
- restart recovery

Do not claim hardware PASS from mocks.

## PhotoBoothAI acceptance evidence

Every hardware-dependent change must end with one of:

- `PASS` - tested on the claimed real device
- `PARTIAL` - tested by mock/simulation or incomplete hardware coverage
- `FAIL` - attempted and failed

Software tests must distinguish:

- pure state transition evidence
- browser API mock evidence
- manual browser evidence
- real camera evidence
- real printer evidence

## Required PhotoBoothAI test flows

- attract/start to QR output
- countdown cancellation without capture
- original capture preserved before processing
- processing failure fallback
- QR missing/expired photo route
- camera permission denied recovery
- camera track-ended recovery
- MediaPipe unavailable touch fallback
- storage quota/write failure
- duplicate print prevention
- printer offline retry/skip
- session restore after reload
