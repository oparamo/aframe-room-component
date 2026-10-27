---
"@oparamo/aframe-room-component": patch
---

More runtime edits rebuild the geometry: a wall's `height` or `uv-scale`, the `uv-scale` of a floor, ceiling or sides, moving a single wall, and adding or removing a portal. A removed portal's openings fill back in. `room-collision` added after the scene has loaded now collects the walls and floors.
