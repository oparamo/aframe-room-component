---
"@oparamo/aframe-room-component": minor
---

Markup mistakes log instead of stopping the scene. A room with too few walls, or with `width` and `length` but not four walls, an element under the wrong parent, and a portal whose `from` or `to` matches nothing or something other than an `a-opening` each log a `console.error` naming the element and are skipped, and the rest of the scene builds. A `width`/`length` room warns about wall `position`s it ignores. An `a-portal` can now be a child of any entity except an `a-opening`.
