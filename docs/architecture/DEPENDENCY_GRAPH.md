# Dependency Graph

```text
UI / Components
      ↓
Hooks / Controllers
      ↓
Application Services
      ↓
Domain Types and State Machine
      ↓
Adapter Interfaces
      ↓
Browser / OS / Device Implementations
```

Avoid reverse dependencies.
Do not let printer or camera adapters import UI components.
