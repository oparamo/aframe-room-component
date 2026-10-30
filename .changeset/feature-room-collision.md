---
"@oparamo/aframe-room-component": minor
---

New `room-collision` component for walking inside rooms without a physics engine. Put it on the camera, or on a rig whose child is the camera; in VR, use the rig. It stops the player at walls, slides them along a wall they walk into at an angle, and keeps them on the floor, through portals included.

- `radius` (0.4 m) is how far from every wall the player stays, corners and shallow approaches included.
- `stepHeight` (0.3 m) is the highest step the player walks up onto. Walls taller than that stop them even below the waist, and higher ledges aren't climbed.
- It works in world space, so the rig can sit inside a moved, turned or scaled entity, and in a rig it pushes the player back when their head walks into a wall in room-scale VR.
