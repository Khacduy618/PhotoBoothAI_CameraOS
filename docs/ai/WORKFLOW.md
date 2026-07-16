# AI Delivery Workflow

## Goal

Coordinate AI agents as a software team while preserving human product ownership and merge authority.

## Discovery phase

```text
User/Product Owner
→ planning
→ @ba
→ @architect
→ @pm
→ approval-ready plan
```

Planning is read-only.

Required output:

- confirmed facts
- assumptions
- open questions
- scope
- acceptance criteria
- architecture impact
- tasks
- risks
- verification plan

## Delivery phase

```text
approved plan
→ delivery
→ @backend and/or @frontend
→ @qa
→ @reviewer
→ @verifier
→ PM approval
```

Delivery must not mark work complete while:

- QA reports `FAIL`
- Reviewer reports `REQUEST_CHANGES`
- Verifier reports `FAIL`
- required hardware evidence is missing without being marked `PARTIAL`

## Debate workflow

Use this before implementation:

```text
@ba defines user and business impact
@architect challenges technical feasibility
@pm challenges scope and sequencing
@reviewer challenges risk and maintainability
@verifier identifies missing evidence
```

No file modification is allowed during debate unless the user explicitly requests it.

## Handoff contract

Every handoff includes:

- goal
- approved scope
- acceptance criteria
- affected pipeline stages
- relevant files
- assumptions
- constraints
- expected output
