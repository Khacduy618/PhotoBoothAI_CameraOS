# Prompt Guide

## Planning prompt

```text
Inspect the repository in read-only mode.
Delegate requirement ambiguity to @ba, technical design to @architect,
and sequencing/risk to @pm.
Do not modify files.
Return an approval-ready plan with acceptance criteria and hardware assumptions.
```

## Delivery prompt

```text
Execute the approved plan only.
Delegate implementation, QA, review and verification.
Do not mark complete until blocking findings are resolved.
Report real hardware tested and not tested.
```

## Review prompt

```text
@reviewer review the current scoped diff.
Do not modify files.
Focus on preview performance, duplicate capture, media preservation,
hardware recovery, security and missing tests.
```

## Verification prompt

```text
@verifier map every acceptance criterion to implementation and test evidence.
Return PASS, PARTIAL or FAIL.
Do not infer hardware success from mocks.
```
