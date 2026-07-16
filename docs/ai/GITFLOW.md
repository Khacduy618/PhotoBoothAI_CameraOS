# GitFlow for Developer and PM

## Long-lived branches

- `main`: production-ready code
- `develop`: integrated development code

## Feature branch

```fish
git checkout develop
git pull --ff-only origin develop
git checkout -b feature/<ticket>-<slug>
```

## Review sequence

```text
Developer implements
→ Developer self-review
→ Developer pushes feature branch
→ Draft PR into develop
→ PM reviews scope and asks questions
→ Developer answers or fixes
→ Reviewer performs technical review
→ QA validates
→ Verifier checks acceptance evidence
→ PM approves merge
→ Merge into develop
```

## PM questions

PM should ask:

- Why this approach?
- What alternatives were considered?
- What can fail?
- What is the rollback?
- What hardware was tested?
- What remains unverified?
- Is scope larger than approved?
- Are tests meaningful?

## Release

```fish
git checkout develop
git pull --ff-only origin develop
git checkout -b release/<version>
```

Release branch allows only:

- versioning
- release notes
- final bug fixes
- release configuration
- test stabilization

Then:

```text
release/*
→ QA
→ Reviewer
→ Verifier
→ PM approval
→ main
→ tag
→ merge back to develop
```

## Hotfix

```fish
git checkout main
git pull --ff-only origin main
git checkout -b hotfix/<ticket>-<slug>
```

Hotfix merges into both `main` and `develop`.
