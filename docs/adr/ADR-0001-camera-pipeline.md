# ADR-0001: Camera Pipeline Boundary

Status: Proposed

Decision:

Separate camera discovery/stream lifecycle from preview UI, gesture recognition and capture orchestration.

Reason:

Hardware lifecycle and UI lifecycle fail differently and require independent recovery.
