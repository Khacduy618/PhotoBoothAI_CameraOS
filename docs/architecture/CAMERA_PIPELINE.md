# Camera Pipeline

```text
device discovery
→ permission
→ stream open
→ preview ready
→ recognition sampling
→ capture readiness
→ countdown
→ capture
→ preserve original
→ process derivative
→ persist session
→ print-ready output
```

## Invariants

- one active preview stream per session unless explicitly supported
- no overlapping recognition call
- no duplicate capture in one capture transition
- original capture preserved
- failed print does not delete media
- camera disconnect creates explicit recoverable state
