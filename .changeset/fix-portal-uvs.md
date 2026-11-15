---
"@oparamo/aframe-room-component": patch
---

Textures on portal floors, ceilings and sides are no longer skewed, and they tile per meter like walls and room floors do. A portal's floor and ceiling now map their texture the way the `from` room's own floor and ceiling do, so the pattern carries on through the doorway, and into the `to` room too when both rooms face the same way. `uv-scale` and the material's `repeat` still scale them.
