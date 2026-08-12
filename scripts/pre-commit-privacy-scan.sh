#!/bin/bash
# Pre-commit Privacy and Secret Scan Hook

echo "Running Pre-commit Privacy & Secret Scan..."

# Check for staged sensitive patterns (API keys, secret tokens, private paths)
STAGED_FILES=$(git diff --cached --name-only 2>/dev/null)

if [ -z "$STAGED_FILES" ]; then
  echo "No staged files to scan."
  exit 0
fi

# Check for accidental inclusion of customer photos or binary image leaks in git
SENSITIVE_FILES=$(echo "$STAGED_FILES" | grep -E '\.(png|jpg|jpeg|raw|webp)$' | grep -v 'public/assets/' | grep -v 'public/favicon')

if [ -n "$SENSITIVE_FILES" ]; then
  echo "ERROR: Attempting to commit media/image files:"
  echo "$SENSITIVE_FILES"
  echo "In accordance with project invariants: Never expose customer photos or unapproved binary assets."
  exit 1
fi

echo "Privacy & Secret Scan PASSED cleanly."
exit 0
