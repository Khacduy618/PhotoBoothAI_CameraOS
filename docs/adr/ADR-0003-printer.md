# ADR-0003: Print Job Identity

Status: Proposed

Decision:

Every print request uses a stable logical job ID with bounded retry attempts.

Reason:

Prevent duplicate prints and preserve traceability.
