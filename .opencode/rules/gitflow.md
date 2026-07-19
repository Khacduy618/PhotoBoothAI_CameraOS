# GitFlow Rules

Long-lived branches:

- `main`
- `develop`

Feature branches start from latest `develop`.

Hotfix branches start from latest `main`.

Developer never merges their own feature unless explicitly acting as PM.

Required gates:

```text
PM scope review
→ QA
→ Reviewer
→ Verifier
→ PM merge approval
```

Prohibited:

- direct feature commits to main/develop
- force push shared branches
- hard reset without approval
- discarding unrelated changes
- committing secrets or customer media

See `docs/ai/GITFLOW.md`.
