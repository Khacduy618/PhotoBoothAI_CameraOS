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
## Scoped specialist task access

PM may grant scoped, temporary task access to additional specialist roles, including QA, Reviewer, Verifier, Backend, and Frontend, when the task is low-risk, non-production-impacting, and does not involve secrets, customer media, hardware claims, protected branches, or release authority.

The PM grant must explicitly state:

- the role being granted access
- the task scope
- allowed actions
- prohibited actions
- expected evidence/output
- whether file modification is allowed
- expiration condition

This access does not grant commit, push, merge, release, deployment, or protected-branch authority unless separately and explicitly approved.

For high-risk tasks, hardware-dependent work, security-sensitive work, customer-media handling, production configuration, main/develop merge activity, or release decisions, the normal workflow gates remain mandatory and may not be bypassed.

Required grant format:

```text
PM grants @<role> temporary task access for:

Scope:
Allowed actions:
Prohibited actions:
Expected output:
File modification:
Git authority:
Expires:
```
