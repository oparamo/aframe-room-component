---
"@oparamo/aframe-room-component": patch
---

Builds hold up better at runtime:

- A room or portal whose build throws is logged and skipped, and every other room and portal still builds and shows.
- Adding or removing an `a-wall`, `a-opening`, `a-floor`, `a-ceiling` or `a-sides` rebuilds its room or portal, and removed elements free their geometry.
- Changing a portal's `from` or `to` fills in the openings it left.
- A removed room stops blocking `room-collision`.
- A room with `visible="false"` stays hidden when it rebuilds.
- A room only uses its own walls, floor and ceiling, never those of a room nested in a wall or of a portal on one of its walls.
- Rebuilds keep running in WebXR, where browsers may pause the page's animation frames.
- A portal parented to a wall no longer rebuilds once more right after the scene loads.
