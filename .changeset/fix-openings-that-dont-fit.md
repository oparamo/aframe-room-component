---
"@oparamo/aframe-room-component": patch
---

Openings that can't fit their wall are now skipped and logged. Before, two overlapping openings cut a single hole, an opening wider than its wall cut none while its portal still built a tunnel into the wall, and an opening on a wall of no length produced invalid geometry. Now the later of two overlapping openings in markup, an opening wider than its wall and one on a wall of no length leave both walls solid, the portal builds nothing, and a `console.error` names the portal and says which end failed and why. Openings that don't overlap can still share a wall, so a high window can sit above a door.
