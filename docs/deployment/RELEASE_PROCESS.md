# Release Process

1. Create `release/<version>` from `develop`.
2. Freeze feature scope.
3. Run unit, integration and E2E checks.
4. Run required hardware verification.
5. Resolve blocking review findings.
6. Verifier returns `PASS` or accepted `PARTIAL`.
7. PM approves.
8. Merge into `main`.
9. Create tag.
10. Merge release back into `develop`.
