# Architecture Rules

Maintain separation between:

- camera
- preview
- recognition
- capture
- processing
- session
- storage
- printing
- UI

Domain logic must not depend directly on React components.

Hardware implementations must sit behind adapter interfaces.

Core local flow must not depend on cloud availability.
