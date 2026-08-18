# Automation & Git Hooks Rules

## Pre-commit Verifications
1. **Privacy & Secret Scan (`scripts/pre-commit-privacy-scan.sh`)**:
   - Must prevent commit if API keys, tokens, sensitive local paths, or actual customer photo files are detected in staged changes.
2. **State Machine Verification (`scripts/pre-commit-state-machine-check.sh`)**:
   - Must run Vitest state machine tests to guarantee core event transitions remain unbroken.
3. **TypeScript & Code Quality**:
   - Must pass `tsc --noEmit` cleanly before code is committed.
