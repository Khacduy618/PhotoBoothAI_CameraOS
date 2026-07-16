# System Architecture

## Platform and app

MomentAI CameraOS provides reusable camera application infrastructure.

PhotoBoothAI provides the first product experience.

Reusable platform concerns:

- camera adapter
- preview lifecycle
- recognition scheduling
- capture service
- processing service
- session service
- storage
- print service
- observability

PhotoBooth-specific concerns:

- booth templates
- countdown UX
- photo selection
- customer flow
- kiosk experience
- operator controls

## Required boundaries

UI depends on application services.

Application services depend on adapter interfaces.

Adapters depend on browser, OS or device APIs.

Domain state must not depend directly on React components.
