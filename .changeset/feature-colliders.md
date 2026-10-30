---
"@oparamo/aframe-room-component": minor
---

New `room-collidable` component: the player collides with the `mesh` of every element that has it, stopped when they walk into it and held up when they stand on it. Built walls, floors, and portal floors and sides carry it, and you can add it to your own entities, such as `<a-box room-collidable>`. `room-collidable="false"` switches collision off for the element and everything inside it.

New `collidable` attribute on `a-wall` and `a-room`, true by default, which sets `room-collidable`. `collidable="false"` on a wall lets the player walk through it and its windows, whether it is visible or not; on a room it covers everything inside, floor and portals included. A hidden wall still stops the player, as before.

Every collidable surface stops the player from both sides, so an inside room with no shell around it can't be entered from outside. One side effect: an outside room's floor, which faces down, is now walkable from above.
