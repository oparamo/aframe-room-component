---
"@oparamo/aframe-room-component": minor
---

Rooms and portals have a `rebuild()` method (`el.components.room.rebuild()`, `el.components.portal.rebuild()`) for changes that don't go through `setAttribute`, such as the `animation` component moving a room. Calls in the same frame are batched into one build. Emitting a `room-rebuild` event on a room or portal, or on any element inside one, does the same.
