# aframe-room-component

[![Version](http://img.shields.io/npm/v/@oparamo%2faframe-room-component.svg?style=flat-square)](https://npmjs.org/package/@oparamo/aframe-room-component)
[![License](http://img.shields.io/npm/l/@oparamo%2faframe-room-component.svg?style=flat-square)](https://npmjs.org/package/@oparamo/aframe-room-component)

A set of [A-Frame](https://aframe.io) components for quickly creating rooms connected by doors.

[Click here to see an example](https://oparamo.github.io/aframe-room-component/)

## Installation

### Browser

```html
<head>
  <script src="https://aframe.io/releases/1.7.1/aframe.min.js"></script>
  <script src="https://cdn.jsdelivr.net/gh/oparamo/aframe-room-component@v2.0.0/dist/aframe-room-component.min.js"></script>
</head>

<body>
  <a-scene>
    <a-room position="-2 0 -2" material="color:#866">
      <a-wall position="4 0 0"></a-wall>
      <a-wall position="4 0 4"></a-wall>
      <a-wall position="0 0 4"></a-wall>
      <a-wall position="0 0 0">
        <a-opening id="holeA"></a-opening>
        <a-portal from="#holeA" to="#holeB" position="2.5 0 0"></a-portal>
      </a-wall>
    </a-room>
    <a-room position="0 0 -3">
      <a-wall position=" 1 0 -1" material="color:#787"></a-wall>
      <a-wall position=" 1 0  1" material="color:#877">
        <a-opening id="holeB"></a-opening>
      </a-wall>
      <a-wall position="-1 0  1" material="color:#878"></a-wall>
      <a-wall position="-1 0 -1" material="color:#778"></a-wall>
    </a-room>
  </a-scene>
</body>
```

### npm

```bash
npm install @oparamo/aframe-room-component
```

```js
import 'aframe';
import '@oparamo/aframe-room-component';
```

## Usage

### Overview

A set of primitives (also usable as components) for laying out rooms connected by doors in A-Frame. Attributes in *italics* are material/height shorthands inherited from the parent element.

| Primitive | Component | Purpose | Attributes |
| - | - | - | - |
| `a-room` | `room` | Contains a set of walls and other objects. | `position`, `outside`, `height`, `width`, `length`, *`material`* |
| `a-wall` | `wall` | Marks one corner of a wall, connecting to the next. | `position`, `height`, `uv-scale`, *`material`* |
| `a-opening` | `opening` | Marks a wall so a portal can connect to it. | (none) |
| `a-portal` | `portal` | Connects two openings and positions them along their walls. | `from`, `to`, `position`, `width`, `height`, `floor-height` |
| `a-floor`, `a-ceiling`, `a-sides` | `floor`, `ceiling`, `sides` | Attach materials to room/portal surfaces. | `uv-scale`, *`material`* |

### Hierarchy

An `a-scene` can contain multiple `a-room`s.

An `a-room` must contain at least three `a-wall`s. Set `outside="true"` on a room to make its walls describe the exterior of a building rather than an interior.

An `a-wall` can have any A-Frame entity as a child. Walls are oriented so their local `x` axis points toward the next wall — meaning a child entity's `x` coordinate is its distance along the wall, `y` is height off the ground, and `z` is distance from the wall surface.

An `a-opening` must be a child of an `a-wall`. It marks where a portal connection cuts through the wall. It can have any A-Frame entity as a child (e.g. a door model or window frame). Do **not** set a `position` on an `a-opening` — its position is controlled by the `a-portal` it is connected to.

An `a-portal` can be a child of an `a-scene` or of an `a-wall` (but **not** of an `a-opening`). Its world position is used to automatically place the two connected openings as close to it as possible on their respective walls. Whether to parent the portal to the scene or to one of the walls depends on your layout — it affects whether the doorway moves with a room or stays fixed. Set `floor-height` to raise the opening above the wall baseline to create a window.

An `a-floor` and `a-ceiling` must be a child of either an `a-room` or an `a-portal`. An `a-sides` is only used inside `a-portal`s. All three carry a `material` component for their surface and can be omitted if you prefer to handle surfaces manually.

### Shorthands

If an `a-wall` has no `material` component, it inherits from its parent `a-room`. If an `a-floor`, `a-ceiling`, or `a-sides` has no `material`, it inherits in order from: its parent `a-portal`, then the `from` opening's wall, then the `from` opening's room.

If an `a-wall` has no `height` attribute, it inherits from its parent `a-room`'s `height`. The default room height is `2.4m`.

If an `a-room` has both a `width` and a `length` attribute and contains exactly four `a-wall`s, wall `position`s can be omitted — they will be set automatically to form a rectangle from `(0,0)` to `(width, length)`.

`uv-scale` on `a-wall`, `a-floor`, `a-ceiling`, and `a-sides` controls how many times the texture tiles per world unit. The default is `1` (one repeat per meter). Use `uv-scale="0.5"` to tile once every two meters, or `uv-scale="2"` to tile twice per meter.

### Windows

Set `floor-height` on `a-portal` to raise the opening above the wall baseline. The section of wall below the opening remains solid.

```html
<!-- Inner room — opening on south wall (z=5) -->
<a-room width="5" length="5">
  <a-wall></a-wall>
  <a-wall></a-wall>
  <a-wall>
    <a-opening id="window-inside"></a-opening>
  </a-wall>
  <a-wall></a-wall>
  <a-floor></a-floor>
  <a-ceiling></a-ceiling>
</a-room>

<!-- Outer shell — south wall at z=6 carries the exterior side of the window -->
<a-room outside="true">
  <a-wall position="-1 0 -1"></a-wall>
  <a-wall position="6 0 -1"></a-wall>
  <a-wall position="6 0 6">
    <a-opening id="window-outside"></a-opening>
  </a-wall>
  <a-wall position="-1 0 6"></a-wall>
</a-room>

<!-- floor-height="1" raises the bottom of the opening 1m above the floor -->
<a-portal from="#window-inside" to="#window-outside"
          position="2.5 0 5" width="1.2" height="0.8" floor-height="1">
</a-portal>
```

A window still requires two `a-opening` elements and a connecting `a-portal` — one opening on each side of the wall. For a solid window with no tunnel, omit the `a-floor`, `a-ceiling`, and `a-sides` children from the portal so no geometry is generated for the passage itself.

Window portals (any portal with `floor-height > 0`) automatically block player movement — `room-collision` treats the opening as a solid surface. Door portals (`floor-height="0"`, the default) remain passable.

## Walking collision

Add `room-collision` to any entity that has a locomotion control to prevent the player from walking through walls. Because it reads the entity's position delta each tick rather than intercepting key events, it works alongside any control that modifies entity position — `wasd-controls`, gamepad controls, mobile joystick controls, VR thumbstick locomotion, and others.

**Direct pattern** — `room-collision` on the camera entity itself:

```html
<a-entity camera look-controls wasd-controls room-collision position="0 1.6 0"></a-entity>
```

**Rig pattern** — `room-collision` on a parent rig, camera as a child:

```html
<a-entity wasd-controls room-collision>
  <a-entity camera look-controls position="0 1.6 0"></a-entity>
</a-entity>
```

### Properties

| Property | Default | Description |
| - | - | - |
| `radius` | `0.4` | Collision buffer distance in meters. Increase to stop farther from walls. |

## How it works

### Building system

Geometry is generated by the `building` A-Frame system (`src/systems/building.js`) working together with pure geometry functions in `src/systems/buildingService.js`.

When a room or portal component initialises, its `update` hook calls `building.buildRoom` or `building.buildPortal`. These methods add the element to a dirty set and call `requestBuild`, which schedules a single `requestAnimationFrame` callback — multiple calls within the same frame are coalesced by a `buildPending` flag. Because `requestAnimationFrame` is asynchronous, the callback always runs after A-Frame's synchronous component initialisation has finished, so all wall and opening data is fully populated by the time the build executes.

The same path handles both the initial build on page load and runtime rebuilds triggered by position or transform changes.

Rooms are always built before portals because building a room populates the world-space vertices on its openings, and portals consume those vertices to construct the tunnel geometry connecting them. When a room is rebuilt at runtime, its connected portals are automatically added to the dirty set so their geometry stays in sync.

Floor and ceiling caps are triangulated using Three.js's earcut algorithm. For four-walled rooms, `buildingService` also evaluates the alternative quad diagonal and switches to it when its two triangles are more coplanar — this eliminates visible seams on non-planar ceilings (e.g. when opposite walls have different heights).

### Collision system

The `room-collision` component (`src/components/collision.js`) uses raycasting rather than a physics engine. Each tick it reads the entity's position delta since the last frame and casts a ray in the direction of movement. If a wall mesh is hit within `radius + moveLength`, the move is blocked and the component attempts to slide by projecting the movement vector onto the wall's XZ normal. After resolving horizontal movement, a second ray is cast straight down to snap the player's Y position to the nearest floor surface, which handles sloped floors and different floor heights between rooms.

`buildingService` stamps `.collidable` on wall meshes, portal-side meshes, and window-blocker meshes, and `.walkable` on room floor and portal floor meshes. The component maintains separate lists for each — wall rays only test `.collidable` meshes, floor rays only test `.walkable` meshes. Both lists are built at scene load and refreshed whenever the building system completes a runtime rebuild.

In the rig pattern the player entity sits at floor level, so floor snap sets Y directly to the hit point. In the direct camera pattern the camera's Y at scene load is snapshotted as the eye height and added to each floor-snap result.

## Tips

- Use a mixin for commonly repeated materials (e.g. a floor texture shared across rooms).
- To connect a room to the outside world, wrap your rooms in an `a-room outside="true"` and put one opening on one of its walls.
- Have a look at the [example source](https://github.com/oparamo/aframe-room-component/blob/master/example/index.html) for a walkthrough of the available features.
