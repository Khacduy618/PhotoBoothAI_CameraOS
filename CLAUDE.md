# PhotoBoothAI CameraOS — Technical Quick Context

## Product

MomentAI CameraOS is a local-first camera application platform.
PhotoBoothAI is the first application.

## Main pipeline

```text
camera source
→ live preview
→ touch or gesture input
→ countdown
→ capture
→ processing
→ session storage
→ selection
→ printing
→ completion or recovery
```

## Key principles

- preview has the highest real-time priority
- gesture recognition is optional
- touch/operator control remains available
- original captures should be preserved
- hardware errors must be recoverable where possible
- local capture and printing should not depend on cloud availability

## Agent workflow

Use `planning` for read-only analysis and approval-ready plans.

Use `delivery` only after scope is approved.

Specialist agents:

- `@ba`
- `@pm`
- `@architect`
- `@backend`
- `@frontend`
- `@qa`
- `@reviewer`
- `@verifier`

## Global provider

OpenCode provider configuration is global:

```text
~/.config/opencode/opencode.json
```

Do not add provider credentials to this repository.
