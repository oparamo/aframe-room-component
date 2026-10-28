# Architecture

aframe-room-component is a browser library built with Vite in library mode. It registers A-Frame components and primitives that describe rooms, walls and the doorways between them in HTML, then generates the meshes.

## Layers

The code under `src/` is split into layers. Each one imports only from the layers below it, and `import-x/no-restricted-paths` in `eslint.config.js` fails lint on an import that goes the wrong way.

| Layer | Path | Holds |
| - | - | - |
| Markup | `primitives/` | `a-room`, `a-wall`, `a-opening`, `a-portal`, `a-floor`, `a-ceiling`, `a-sides`, mapping HTML attributes to component properties |
| Controllers | `components/` | the A-Frame components: lifecycle, parent checks, change detection, and `room-collision` |
| Orchestration | `systems/building.ts` | the `building` system: dirty sets, build order, one pass per frame |
| Shell | `builders/` | `room.ts` and `portal.ts`: read element data and transforms, then write meshes, positions, opening vertices and classes |
| Core | `geometry/` | `walls.ts`, `caps.ts`, `surfaces.ts`: pure functions from numbers and three.js values to geometry |
| Utils | `utils/` | `assertDefined` and the surface class names; imports nothing else from `src` |
| Data | `types/` | `aframe.ts` and `elements.ts` (A-Frame and element shapes), `geometry.ts` (the core's shapes) |

Two more rules keep the bottom layers honest. `geometry/` can't import `types/aframe.ts` or `types/elements.ts`, so it never sees an element. `AFRAME` is a restricted global in `builders/`, `geometry/` and `utils/`, since only components, primitives and systems register with A-Frame.

In each layer, the layer's own units sit at the top level, and the helpers they share live in a `helpers/` subdirectory: `components/helpers/` (`hierarchy.ts`, `transforms.ts`), `builders/helpers/mesh.ts`, and `geometry/helpers/` (`uvs.ts`, `quads.ts`).

## Building

1. On `init`, `room` collects its `a-wall` children into `walls` and keeps references to its `a-floor` and `a-ceiling`. It also hides itself until its first build, so a room never shows with missing walls. `wall` collects its `a-opening` children into `openings` and adds `getHeight()`, which falls back to the room's height. `opening` adds `getPortal()`, which finds the `a-portal` whose `from` or `to` is this opening.
2. On `update`, `room` and `portal` call the system's `buildRoom` or `buildPortal`. Walls, floors, ceilings and sides call their parent's `rebuild()` instead.
3. The system adds the element to a dirty set. A room also marks the portals in its openings, because rebuilding the room moves the openings. A portal also marks the rooms it cuts into, because its size and position shape their walls. Then `requestBuild` schedules one `requestAnimationFrame` callback; further calls in the same frame find it already pending.
4. The callback builds every dirty room, then every dirty portal, and emits `room-building-complete` on the scene. Rooms go first because a room build records each opening's four world-space corners in `vertices`, and the portal build joins those corners. Because the callback runs after A-Frame's synchronous initialization, every component's data is ready by then, so the first build and every later rebuild take the same path.

### What triggers a rebuild

- `update`, whenever a component's attributes change.
- A `componentchanged` listener on rooms, portals and walls, for `position`, `rotation` and `scale`. The inspector changes those through `setAttribute` and pauses the scene, which stops `tick`, so the listener is what catches its edits.
- `tick` on rooms and portals compares `object3D.matrixWorld` with a snapshot taken at the last `rebuild()`. That catches movement that bypasses `setAttribute`, such as the `animation` component (which sets `object3D` directly since A-Frame 1.7) or a parent entity moving.
- `tick` on walls compares `object3D.position` with `builtPosition`, the position recorded at the wall's last build. Only position counts, because the build sets each wall's rotation itself.
- `rebuild()`, which consumers can call. Removing a portal rebuilds its rooms, so the openings fill back in.

## Geometry

- **Wall order.** Walls are built in a loop, each running from its own corner to the next wall's corner. `wallsInBuildOrder` checks the winding of the authored corners with the shoelace formula and reverses a copy of the list when needed, so inside rooms' walls face in and outside rooms' walls face out. `roomEl.walls` stays in authored order, which a `width`/`length` room uses to place its corners on every build.
- **Walls.** Each wall is a `THREE.ShapeGeometry` in its local XY plane, rotated about y to run along its span. Openings are cut as holes in the shape, which handles doors (`floorHeight` 0) and windows (`floorHeight` above 0) alike and leaves the wall solid below a sill. An opening's top is clamped to the wall's height, and the opening is clamped to stay on its wall.
- **`HAIR`** (`0.0001`) keeps opening edges off the wall's own edges and ceiling, which prevents z-fighting.
- **Caps.** The floor and ceiling take one vertex per wall corner and are triangulated with earcut (`THREE.ShapeUtils.triangulateShape`) in the XZ plane, so concave rooms work. Each corner keeps its own wall's height, so a ceiling follows walls of different heights. `flipGeometry` sets the facing: into an inside room, out of an outside one.
- **Portal surfaces.** `a-floor`, `a-ceiling` and `a-sides` in a portal are quads between the two openings' recorded corners, built in the child element's local space.
- **UVs** are in meters, times `uv-scale`. Walls project their local x and y, caps project the room's x and z, and portal surfaces scale a unit quad by the lengths of its edges.
- **Materials.** A mesh takes the material of its own element, then of its parent, then a fallback. For portal surfaces the fallback is the `from` opening's wall, then that wall's room. Meshes are reused across rebuilds, and the replaced geometry is disposed.
- **Window blockers.** For a portal with `floorHeight` above 0, the room build adds an invisible quad across each opening, with a `MeshBasicMaterial` on both sides (`Mesh.raycast` skips meshes without a material), so `room-collision` stops the player at the window. The next build removes it and disposes its geometry and material.

## Collision

`room-collision` (`src/components/collision.ts`) uses raycasting instead of a physics engine. The builders put the `collidable` class on walls, portal sides and window blockers, and `walkable` on room and portal floors, using the names in `utils/surfaceClasses.ts`. Those classes are the only link between building and collision. The component collects both sets of meshes when the scene loads and again on every `room-building-complete`.

Each tick it reads how far the entity moved since the last frame, puts it back, and casts a ray along the move from the previous position at torso height (0.6 m below the camera). If a wall is closer than `radius` plus the move's length, the move is blocked and the component tries again along the wall, projecting the move onto the plane of the wall's horizontal normal. Then a ray cast straight down from 1.5 m above the new position snaps y to the nearest walkable surface, which handles slopes and floors at different heights.

With `room-collision` on a rig whose child is the camera, the rig stands on the floor, so the snap sets y to the hit point. With it on the camera itself, the camera's y when the scene loads is kept as the eye height and added to each snap.

## Tests and the demo

[CONTRIBUTING.md](CONTRIBUTING.md) covers the test layout, the mocks, and the demo page that serves as the manual test bench.
