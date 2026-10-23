---
"@oparamo/aframe-room-component": minor
---

Rooms and portals rebuild automatically when anything moves them, including the `animation` component and code that sets `object3D` directly. For changes that detection can't see, such as moving a single wall's `object3D`, call `el.components.room.rebuild()` or `el.components.portal.rebuild()`.
