# Architecture

aframe-room-component is a browser library built with Vite in library mode. It registers A-Frame components and primitives that describe rooms, walls and the doorways between them in HTML, then generates the meshes.

## Layers

The code under `src/` is split into layers. Each one imports only from the layers below it, and `import-x/no-restricted-paths` in `eslint.config.js` fails lint on an import that goes the wrong way.

| Layer | Path | Holds |
| - | - | - |
| Markup | `primitives/` | `a-room`, `a-wall`, `a-opening`, `a-portal`, `a-floor`, `a-ceiling`, `a-sides`, mapping HTML attributes to component properties |
| Controllers | `components/` | the A-Frame components: lifecycle, parent checks, change detection, and `room-collision` |
| Orchestration | `systems/building.ts` | the `room-building` system: dirty sets, build order, one pass per frame, the build state and the snapshots ticks compare against |
| Shell | `builders/` | `room.ts` and `portal.ts`: read the structure, element data and transforms, then write meshes, positions, classes and opening corners |
| Core | `geometry/` | `walls.ts`, `caps.ts`, `surfaces.ts`: pure functions from numbers and three.js values to geometry |
| Utils | `utils/` | `assertDefined` and the surface class names; imports nothing else from `src` |
| Data | `types/` | `aframe.ts` and `elements.ts` (A-Frame and element shapes), `geometry.ts` (the core's shapes) |

Two more rules keep the bottom layers honest. `geometry/` can't import `types/aframe.ts` or `types/elements.ts`, so it never sees an element. `AFRAME` is a restricted global in `builders/`, `geometry/` and `utils/`, since only components, primitives and systems register with A-Frame.

In each layer, the layer's own units sit at the top level, and the helpers they share live in a `helpers/` subdirectory: `components/helpers/` (`hierarchy.ts`, `surface.ts` for the floor, ceiling and sides components, `transforms.ts`), `builders/helpers/` (`mesh.ts`, `structure.ts`), and `geometry/helpers/` (`uvs.ts`, `quads.ts`).

## Building

The components keep no build state on the elements. The structure is read from the DOM on every build, and what has to last between builds lives in the system.

- **Structure.** `builders/helpers/structure.ts` finds a room's walls, floor and ceiling, and a wall's openings, among the element's own children, so a nested room's walls or a floor inside a portal on a wall never count. `wallHeight` falls back to the room's height.
- **Build state.** The system holds a `BuildState` that it passes to the builders. `portalOf` maps each opening to the portal that uses it. The portal component's `update` keeps it current through the system's `linkPortal`, which gets A-Frame's `oldData`, so a retargeted portal releases its old openings. `cornersOf` holds each opening's four world-space corners as of its room's last build. Both are `WeakMap`s, so removed elements don't linger.
- **Meshes** live in A-Frame's `object3DMap`, set with `setObject3D` and read back with `getObject3D`. Every built surface uses A-Frame's own `mesh` key, so the `material` component swaps a new material onto it. A surface that collision uses also gets a `collider`: an invisible mesh on the same geometry with one shared double-sided material, so walls block from both sides whatever the render material's side, and without a second buffer. A window blocker is the opening's `collider`, with geometry of its own.

1. On `init`, `room` checks its shape. A room that can't be built logs why and never queues itself. Otherwise, if it is visible, it asks the system to hide it until its first build, so it never shows with missing walls; a room whose markup hides it is left alone, because A-Frame applies `visible` before other components initialize.
2. On `update`, `room` and `portal` call the system's `buildRoom` or `buildPortal`; the portal links its openings first. Walls, floors, ceilings and sides call their parent's `rebuild()` instead.
3. The system adds the element to a dirty set. A room also marks the portals in its openings, because rebuilding the room moves the openings. A portal also marks the rooms it cuts into, because its size and position shape their walls. Then `requestBuild` marks a pass pending.
4. The system's `tick` runs a pending pass inside the scene's render loop, which in WebXR is the session's frame loop. `requestBuild` also schedules a `requestAnimationFrame` callback for when the scene is paused, as in the inspector, and whichever comes first takes the pass. Both run after A-Frame's synchronous initialization, so every component's data is ready, and the first build and every later rebuild take the same path.
5. The pass copies and clears the dirty sets, then drops elements that have left the document or lost their component. It builds every room, then every portal, each inside its own `try` so a failure logs and the rest still build. Rooms go first because a room build records each opening's corners in `cornersOf`, and the portal build joins those corners. The pass shows the rooms it hid that built, records snapshots of what it built, and emits `room-building-complete` on the scene, with the rooms and portals that built in its `detail`. The snapshots come after the whole pass, so a portal on a wall is measured after its room build turned the wall.

### Markup errors and removal

Components never throw. An element under the wrong parent, a room with the wrong number of walls, and a portal whose ends aren't openings with built rooms each log a `console.error` naming the element, and are skipped. A portal that can't join its openings also takes down the surfaces of its last build.

A-Frame calls a component's `remove` when its element leaves the document. Walls, floors, ceilings and sides free their mesh's geometry (materials belong to the material component) and rebuild their parent. An opening frees its blocker, tells the system to forget its corners and rebuild its portal, and rebuilds its room. A removed room asks for a pass, whose `room-building-complete` lets `room-collision` drop its meshes. A portal's update releases the openings it no longer joins and rebuilds their rooms, so the old holes fill in.

Removing an element's `material` component swaps a plain default material onto its `mesh` and disposes the old one, which surfaces inheriting it still point at. So rooms, walls, portals and surfaces listen for `componentremoved` on themselves and queue a rebuild when it names `material`, and the build hands each mesh the material it inherits.

### What triggers a rebuild

- `update`, whenever a component's attributes change.
- A `componentchanged` listener on rooms, portals and walls, for `position`, `rotation` and `scale`. The inspector changes those through `setAttribute` and pauses the scene, which stops `tick`, so the listener is what catches its edits.
- `tick` on rooms and portals asks the system's `hasMoved`, which compares `object3D.matrixWorld` with the snapshot from the element's last build. That catches movement that bypasses `setAttribute`, such as the `animation` component (which sets `object3D` directly since A-Frame 1.7) or a parent entity moving. Before the first build nothing has moved.
- `tick` on walls asks `hasWallMoved`, which compares `object3D.position` with the position recorded at the room's last build. Only position counts, because the build sets each wall's rotation itself.
- `rebuild()`, which consumers can call. Removing a portal rebuilds its rooms, so the openings fill back in.

## Geometry

- **Wall order.** Walls are built in a loop, each running from its own corner to the next wall's corner. `wallsInBuildOrder` checks the winding of the authored corners with the shoelace formula and reverses a copy of the list when needed, so inside rooms' walls face in and outside rooms' walls face out. A `width`/`length` room places its corners in document order, so the reversal never feeds back into the next build.
- **Walls.** Each wall is a `THREE.ShapeGeometry` in its local XY plane, rotated about y to run along its span. Openings are cut as holes in the shape, which handles doors (`floorHeight` 0) and windows (`floorHeight` above 0) alike and leaves the wall solid below a sill. An opening's top is clamped to the wall's height, and the opening is clamped to stay on its wall.
- **`HAIR`** (`0.0001`) keeps opening edges off the wall's own edges and ceiling, which prevents z-fighting.
- **Caps.** The floor and ceiling take one vertex per wall corner and are triangulated with earcut (`THREE.ShapeUtils.triangulateShape`) in the XZ plane, so concave rooms work. Each corner keeps its own wall's height, so a ceiling follows walls of different heights. `flipGeometry` sets the facing: into an inside room, out of an outside one.
- **Portal surfaces.** `a-floor`, `a-ceiling` and `a-sides` in a portal are quads between the two openings' recorded corners, built in the child element's local space.
- **UVs** are in meters, times `uv-scale`. Walls project their local x and y, caps project the room's x and z, and portal surfaces scale a unit quad by the lengths of its edges.
- **Materials.** A mesh takes the material of its own element, then of its parent, then a fallback. For portal surfaces the fallback is the `from` opening's wall, then that wall's room. Meshes are reused across rebuilds, and the replaced geometry is disposed.
- **Window blockers.** For a portal with `floorHeight` above 0, the room build adds an invisible quad across each opening, with a `MeshBasicMaterial` on both sides (`Mesh.raycast` skips meshes without a material), so `room-collision` stops the player at the window. It is the opening's `blocker` object; its geometry is in the wall's space, so the mesh is offset by the opening's position. The next build removes it and disposes its geometry and material.

## Collision

`room-collision` (`src/components/collision.ts`) uses raycasting instead of a physics engine. The builders put the `room-collidable` class on walls, portal sides and window blockers, and `room-walkable` on room and portal floors, using the names in `utils/surfaceClasses.ts`. A passable wall, or a wall in a passable room, gets neither the class nor a collider, and its openings get no blocker; the build toggles both each time, since `passable` can change at runtime. Those classes are the only link between building and collision. The component takes each classed element's `collider`, or its `mesh` when it has none, when the scene loads and again on every `room-building-complete`.

Each tick it reads how far the entity moved since the last frame, puts it back, and casts a ray along the move from the previous position at torso height (0.6 m below the camera). If a wall is closer than `radius` plus the move's length, the move is blocked and the component tries again along the wall, projecting the move onto the plane of the wall's horizontal normal. Then a ray cast straight down from 1.5 m above the new position snaps y to the nearest walkable surface, which handles slopes and floors at different heights.

With `room-collision` on a rig whose child is the camera, the rig stands on the floor, so the snap sets y to the hit point. With it on the camera itself, the camera's y when the scene loads is kept as the eye height and added to each snap.

## Tests and the demo

[CONTRIBUTING.md](CONTRIBUTING.md) covers the test layout, the mocks, and the demo page that serves as the manual test bench.
