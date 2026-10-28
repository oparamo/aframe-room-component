# aframe-room-component

[![Version](http://img.shields.io/npm/v/@oparamo%2faframe-room-component.svg?style=flat-square)](https://npmjs.org/package/@oparamo/aframe-room-component)
[![License](http://img.shields.io/npm/l/@oparamo%2faframe-room-component.svg?style=flat-square)](https://npmjs.org/package/@oparamo/aframe-room-component)

A set of [A-Frame](https://aframe.io) components for quickly creating rooms connected by doors.

This is a fork of Hazel Fraticelli's [aframe-room-component](https://github.com/omgitsraven/aframe-room-component), ported to TypeScript and extended with walking collision, windows and runtime rebuilds.

aframe-room-component is built with the help of AI coding tools; [AI_DISCLOSURE.md](AI_DISCLOSURE.md) says how.

## Demo

The [demo](https://oparamo.github.io/aframe-room-component/) shows every feature in one walkable scene. Move with WASD and drag to look. The signpost by the path explains the rest.

The [performance page](https://oparamo.github.io/aframe-room-component/perf.html) builds a grid of rooms joined by doorways and reports frame rate, draw calls and what this library costs per frame. Add `?rooms=N` to change the room count (100 by default).

## Installation

### Browser

```html
<head>
  <script src="https://aframe.io/releases/1.8.0/aframe.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@oparamo/aframe-room-component@2.0.0/dist/aframe-room-component.min.js"></script>
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
| `a-wall` | `wall` | Marks one corner of the room; the wall runs from it to a neighboring corner. | `position`, `height`, `uv-scale`, *`material`* |
| `a-opening` | `opening` | Marks a wall so a portal can connect to it. | (none) |
| `a-portal` | `portal` | Connects two openings and positions them along their walls. | `from`, `to`, `position`, `width`, `height`, `floor-height` |
| `a-floor`, `a-ceiling`, `a-sides` | `floor`, `ceiling`, `sides` | Attach materials to room/portal surfaces. | `uv-scale`, *`material`* |

### Hierarchy

An `a-scene` can contain multiple `a-room`s.

An `a-room` must contain at least three `a-wall`s. Set `outside="true"` on a room to make its walls describe the exterior of a building rather than an interior. Every surface of an outside room faces outward: its walls face away from the building, its `a-ceiling` is a roof facing up, and its `a-floor` faces down.

Each `a-wall` marks a corner of the room, and its wall runs from that corner to the corner of the wall before or after it. The room picks the direction that makes its walls face in, or out for an outside room, so in an outside room each wall usually runs to the corner listed before it. An `a-wall` can have any A-Frame entity as a child. Walls are rotated so their local `x` axis points along the wall, which means a child entity's `x` coordinate is its distance along the wall from the wall's own corner, `y` is height off the ground, and `z` is distance from the wall surface.

An `a-opening` must be a child of an `a-wall`. It marks where a portal connection cuts through the wall. It can have any A-Frame entity as a child (e.g. a door model or window frame). Do **not** set a `position` on an `a-opening`, because the `a-portal` it is connected to controls its position.

An `a-portal` can be a child of an `a-scene` or of an `a-wall` (but **not** of an `a-opening`). Its world position is used to automatically place the two connected openings as close to it as possible on their respective walls. Whether to parent the portal to the scene or to one of the walls depends on your layout: it affects whether the doorway moves with a room or stays fixed. Set `floor-height` to raise the opening above the wall baseline to create a window.

An `a-floor` and `a-ceiling` must be a child of either an `a-room` or an `a-portal`. An `a-sides` is only used inside `a-portal`s. All three carry a `material` component for their surface and can be omitted if you prefer to handle surfaces manually.

### Shorthands

If an `a-wall` has no `material` component, it inherits from its parent `a-room`. If an `a-floor`, `a-ceiling`, or `a-sides` has no `material`, it inherits in order from: its parent `a-portal`, then the `from` opening's wall, then the `from` opening's room.

If an `a-wall` has no `height` attribute, it inherits from its parent `a-room`'s `height`. The default room height is `2.4m`.

If an `a-room` has both a `width` and a `length` attribute and contains exactly four `a-wall`s, wall `position`s can be omitted. They will be set automatically to form a rectangle from `(0,0)` to `(width, length)`.

`uv-scale` on `a-wall`, `a-floor`, `a-ceiling`, and `a-sides` controls how many times the texture tiles per world unit. The default is `1` (one repeat per meter). Use `uv-scale="0.5"` to tile once every two meters, or `uv-scale="2"` to tile twice per meter. A-Frame only repeats a texture when the material's `repeat` is something other than `1 1`; otherwise the texture's edge pixels stretch past the first tile. To tile, set `repeat` on the material, for example `material="src: #bricks; repeat: 0.5 0.5"`, which multiplies with `uv-scale`.

### Windows

Set `floor-height` on `a-portal` to raise the opening above the wall baseline. The section of wall below the opening remains solid.

```html
<!-- Inner room, with the opening on its south wall (z=5) -->
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

<!-- Outer shell: its south wall (z=6) carries the exterior side of the window. In an outside room
     each wall runs to the corner listed before it, so the south wall is the one at -1 0 6. -->
<a-room outside="true">
  <a-wall position="-1 0 -1"></a-wall>
  <a-wall position="6 0 -1"></a-wall>
  <a-wall position="6 0 6"></a-wall>
  <a-wall position="-1 0 6">
    <a-opening id="window-outside"></a-opening>
  </a-wall>
</a-room>

<!-- floor-height="1" raises the bottom of the opening 1m above the floor -->
<a-portal from="#window-inside" to="#window-outside"
          position="2.5 0 5" width="1.2" height="0.8" floor-height="1">
</a-portal>
```

A window still requires two `a-opening` elements and a connecting `a-portal`, one opening on each side of the wall. For a solid window with no tunnel, omit the `a-floor`, `a-ceiling`, and `a-sides` children from the portal so no geometry is generated for the passage itself.

Window portals (any portal with `floor-height > 0`) automatically block player movement, because `room-collision` treats the opening as a solid surface. Door portals (`floor-height="0"`, the default) remain passable.

### Rebuilding at runtime

Rooms and portals rebuild their geometry when they change, with nothing to wire up:

- Attributes of a room, wall, portal, floor, ceiling or sides, and `position`, `rotation` or `scale` set through `setAttribute` (as the A-Frame inspector does), rebuild right away, even while the scene is paused.
- Movement that bypasses `setAttribute`, such as the `animation` component or code that sets `object3D` directly, is picked up on the next frame. This covers a room or portal moving, including when its parent entity moves, and a single wall moving within its room.
- A portal added to the scene cuts its openings on the next build, and removing a portal fills them back in.

Rebuilding a room also rebuilds the portals connected to it, and rebuilds in the same frame are batched into one pass.

A room's walls, and each wall's openings, are the ones it had when it was created. To change them, replace the `a-room` element.

To queue a rebuild by hand, call `rebuild()`:

```js
roomEl.components.room.rebuild();
```

`portalEl.components.portal.rebuild()` does the same for a portal and the rooms it cuts into.

## Walking collision

Add `room-collision` to any entity that has a locomotion control to prevent the player from walking through walls. It stops the player at walls, slides them along a wall they walk into at an angle, and keeps them on the floor, including through doorways and between floors at different heights. Because it reads the entity's position change each tick rather than intercepting key events, it works alongside any control that moves the entity: `wasd-controls`, gamepad controls, mobile joystick controls, VR thumbstick locomotion, and others.

**Direct pattern:** `room-collision` on the camera entity itself.

```html
<a-entity camera look-controls wasd-controls room-collision position="0 1.6 0"></a-entity>
```

**Rig pattern:** `room-collision` on a parent rig, with the camera as a child.

```html
<a-entity wasd-controls room-collision>
  <a-entity camera look-controls position="0 1.6 0"></a-entity>
</a-entity>
```

### Properties

| Property | Default | Description |
| - | - | - |
| `radius` | `0.4` | Collision buffer distance in meters. Increase to stop farther from walls. |

## Performance

Each room, wall and portal checks once a frame whether it has moved, and geometry rebuilds only when something changes. On the performance page, pausing those checks made no measurable difference to the frame rate.

The usual limit is fill rate: on a high-DPI screen with a weaker GPU, the browser shades four pixels for every one a standard screen would. If frame rate matters more than sharpness, cap the canvas size with A-Frame's `renderer` component (`maxCanvasWidth` and `maxCanvasHeight`) or lower the renderer's pixel ratio. On a 2x-display i5 Mac, a pixel ratio of 1 took 100 rooms from 46 to 60 fps. Unlit materials help a little where many surfaces overlap on screen. These are settings for your scene; the components don't change them.

## Tips

- Use a mixin for commonly repeated materials (e.g. a floor texture shared across rooms).
- To connect a room to the outside world, wrap your rooms in an `a-room outside="true"` and put one opening on one of its walls.
- Have a look at the [example source](https://github.com/oparamo/aframe-room-component/blob/main/example/index.html) for a walkthrough of the available features.

## Contributing

[CONTRIBUTING.md](CONTRIBUTING.md) covers setup, tests, the demo and performance pages, and how releases work. [ARCHITECTURE.md](ARCHITECTURE.md) explains how the code is put together.
