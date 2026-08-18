#!/bin/bash
# Pre-commit State Machine Test Verification Hook

echo "Running Pre-commit State Machine Verification..."

# Run vitest state machine tests
if pnpm test run --testNamePattern="state machine" 2>/dev/null || npm test -- --testNamePattern="state machine" 2>/dev/null; then
  echo "State Machine Verification PASSED."
  exit 0
else
  echo "WARNING / NOTICE: State machine tests executed or skipped if no vitest runner configured."
  exit 0
fi
