# PhotoBoothAI CameraOS — Project Agent Rules

## Product vision

MomentAI CameraOS is a local-first platform for camera-powered applications.
PhotoBoothAI is the first application running on the platform.

The product strategy is:

- ship to real users early
- accept controlled imperfections
- learn from real sessions
- protect captured media
- keep hardware recovery explicit
- avoid premature platform complexity

## Required source of truth

Before acting, agents must read the relevant files:

### Global rules

- `.opencode/rules/gitflow.md`
- `.opencode/rules/coding.md`
- `.opencode/rules/architecture.md`
- `.opencode/rules/state-machine.md`
- `.opencode/rules/error-handling.md`
- `.opencode/rules/security.md`
- `.opencode/rules/testing.md`
- `.opencode/rules/review.md`
- `.opencode/rules/documentation.md`
- `.opencode/rules/photobooth.md`
- `.opencode/rules/backlog-execution.md`

### CameraOS rules

- `.opencode/rules/camera.md`
- `.opencode/rules/capture.md`
- `.opencode/rules/mediapipe.md`
- `.opencode/rules/printer.md`
- `.opencode/rules/storage.md`
- `.opencode/rules/performance.md`
- `.opencode/rules/logging.md`
- `.opencode/rules/mcp-integrations.md`
- `.opencode/rules/hooks.md`

### Technical documentation

Currently required:

- `docs/ai/WORKFLOW.md`
- `docs/ai/GITFLOW.md`
- `docs/ai/AGENT_TEAM.md`
- `docs/architecture/MomentAI_Guest_Internal_System_Design.md`
- `docs/product/GUEST_FLOW_V3_BACKLOG.md`
- `docs/product/GUEST_FLOW_V3_DELIVERY_PLAN.md`
- `docs/product/GUEST_FLOW_V3_ROLE_TASK_MATRIX.md`
- `docs/product/GUEST_FLOW_V3_VIETNAMESE_SUMMARY.md`
- `docs/testing/GUEST_FLOW_V3_ACCEPTANCE_EVIDENCE_MATRIX.md`

Architecture-specific required reading will be added after the architecture documentation branch lands. When present, contributors should read:

- `docs/architecture/SYSTEM.md`
- `docs/architecture/CAMERA_PIPELINE.md`
- `docs/architecture/STATE_MACHINE.md`
- `docs/architecture/EVENT_FLOW.md`
- `docs/architecture/FOLDER_STRUCTURE.md`
- `docs/architecture/PHOTOBOOTH_COMPLETE_ARCHITECTURE.md`

## Execution discipline

After PM approval, agents must execute tasks in the order defined by the current Guest Flow V3 delivery plan and backlog. Use:

1. `docs/architecture/MomentAI_Guest_Internal_System_Design.md`
2. `docs/product/GUEST_FLOW_V3_DELIVERY_PLAN.md`
3. `docs/product/GUEST_FLOW_V3_ROLE_TASK_MATRIX.md`
4. `docs/testing/GUEST_FLOW_V3_ACCEPTANCE_EVIDENCE_MATRIX.md`
5. `docs/product/GUEST_FLOW_V3_BACKLOG.md`

Do not skip ahead to later-milestone features or alter role ownership without PM approval.

Frontend implementation must apply the local Design Taste Frontend guidance (`.opencode/skills/design-taste-frontend/SKILL.md`) for UI/UX quality while preserving accessibility, preview performance and recovery clarity. This is a project guidance reference, not a runtime skill-tool requirement unless the current environment exposes it.

## Critical invariants

- Never lose captured media silently.
- Never let MediaPipe inference block the live preview.
- Never allow one sustained gesture to trigger unlimited captures.
- Never let printer failure invalidate captured media.
- Never hardcode production camera device IDs or printer names.
- Never claim hardware support without real-device evidence.
- Never merge into `develop` or `main` without the required gates.
- Never change files during debate, planning, review or verification unless explicitly authorized.
- Never expose API keys, tokens, customer photos or sensitive local paths.

## Required workflow

```text
Planning
→ BA
→ Architect
→ PM approval
→ Delivery
→ QA
→ Reviewer
→ Verifier
→ PM final approval
→ Merge
```

## Agent model mapping

| Agent | Mode | Model |
|---|---|---|
| planning | primary | `9router/Analysis` |
| delivery | primary | `9router/Implementation` |
| pm | subagent | `9router/Analysis` |
| ba | subagent | `9router/Analysis` |
| architect | subagent | `9router/Analysis` |
| backend | subagent | `9router/Implementation` |
| frontend | subagent | `9router/Implementation` |
| qa | subagent | `9router/Quality` |
| hardware-qa | subagent | `9router/Quality` |
| performance-auditor | subagent | `9router/Quality` |
| reviewer | subagent | `9router/Quality` |
| verifier | subagent | `9router/Verification` |

## Completion evidence

Every implementation response must include:

- summary
- files changed
- commands run
- test results
- pipeline impact
- hardware tested
- hardware not tested
- fallback behavior
- acceptance-criteria status
- remaining risks

Hardware-dependent work must end with one of:

- `PASS`
- `PARTIAL`
- `FAIL`

<!-- CODEGRAPH_START -->
## CodeGraph

In repositories indexed by CodeGraph (a `.codegraph/` directory exists at the repo root), reach for it BEFORE grep/find or reading files when you need to understand or locate code:

- **MCP tool** (when available): `codegraph_explore` answers most code questions in one call — the relevant symbols' verbatim source plus the call paths between them, including dynamic-dispatch hops grep can't follow. Name a file or symbol in the query to read its current line-numbered source. If it's listed but deferred, load it by name via tool search.
- **Shell** (always works): `codegraph explore "<symbol names or question>"` prints the same output.

If there is no `.codegraph/` directory, skip CodeGraph entirely — indexing is the user's decision.
<!-- CODEGRAPH_END -->
