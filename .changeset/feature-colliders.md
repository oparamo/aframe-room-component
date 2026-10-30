---
"@oparamo/aframe-room-component": minor
---

New `passable` attribute on `a-wall` and `a-room`: with `passable="true"` the player walks through the wall, or through every wall of the room, whether it is visible or not. A hidden wall still stops the player, as before.

Walls now stop the player from both sides, so an inside room with no shell around it can't be entered from outside. Each built wall, floor and portal surface gets a hidden, double-sided `collider` that `room-collision` uses in place of its `mesh`. One side effect: an outside room's floor, which faces down, is now walkable from above.
