# Recommended Folder Structure

```text
app/
components/
hooks/
services/
  camera/
  capture/
  processing/
  session/
  storage/
  printing/
lib/
types/
tests/
docs/
.opencode/
```

Rules:

- hooks coordinate UI lifecycle
- services own domain operations
- adapters isolate hardware/runtime APIs
- types define stable contracts
- tests mirror critical services and state transitions
