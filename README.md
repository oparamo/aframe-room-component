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
  <script src="https://cdn.jsdelivr.net/gh/oparamo/aframe-room-component@v1.0.0/dist/aframe-room-component.min.js"></script>
</head>

<body>
  <a-scene>
    <a-room position="-2 0 -2" material="color:#866">
      <a-wall position="4 0 0"></a-wall>
      <a-wall position="4 0 4"></a-wall>
      <a-wall position="0 0 4"></a-wall>
      <a-wall position="0 0 0">
        <a-doorhole id="holeA"></a-doorhole>
        <a-doorlink from="#holeA" to="#holeB" position="2.5 0 0"></a-doorlink>
      </a-wall>
    </a-room>
    <a-room position="0 0 -3">
      <a-wall position=" 1 0 -1" material="color:#787"></a-wall>
      <a-wall position=" 1 0  1" material="color:#877">
        <a-doorhole id="holeB"></a-doorhole>
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
| `a-wall` | `wall` | Marks one corner of a wall, connecting to the next. | `position`, `height`, *`material`* |
| `a-doorhole` | `doorhole` | Marks a wall so a doorlink can connect to it. | (none) |
| `a-doorlink` | `doorlink` | Connects two doorholes and positions them along their walls. | `from`, `to`, `position`, `width`, `height` |
| `a-floor`, `a-ceiling`, `a-sides` | `floor`, `ceiling`, `sides` | Attach materials to room/doorlink surfaces. | *`material`* |

### Hierarchy

An `a-scene` can contain multiple `a-room`s.

An `a-room` must contain at least three `a-wall`s. Set `outside="true"` on a room to make its walls describe the exterior of a building rather than an interior.

An `a-wall` can have any A-Frame entity as a child. Walls are oriented so their local `x` axis points toward the next wall — meaning a child entity's `x` coordinate is its distance along the wall, `y` is height off the ground, and `z` is distance from the wall surface.

An `a-doorhole` must be a child of an `a-wall`. It marks where a door connection exists. It can have any A-Frame entity as a child (e.g. a door model). Do **not** set a `position` on an `a-doorhole` — its position is controlled by the `a-doorlink` it is connected to.

An `a-doorlink` can be a child of an `a-scene` or of an `a-wall` (but **not** of an `a-doorhole`). Its world position is used to automatically place the two connected doorholes as close to it as possible on their respective walls. Whether to parent the doorlink to the scene or to one of the walls depends on your layout — it affects whether the doorway moves with a room or stays fixed.

An `a-floor` and `a-ceiling` must be a child of either an `a-room` or an `a-doorlink`. An `a-sides` is only used inside `a-doorlink`s. All three exist solely to carry a `material` component for their surface. They can be omitted if you prefer to handle surfaces manually.

### Shorthands

If an `a-wall` has no `material` component, it inherits from its parent `a-room`. If an `a-floor`, `a-ceiling`, or `a-sides` has no `material`, it inherits from its parent `a-doorlink` or `a-room`.

If an `a-wall` has no `height` attribute, it inherits from its parent `a-room`'s `height`. The default room height is `2.4m`.

If an `a-room` has both a `width` and a `length` attribute and contains exactly four `a-wall`s, wall `position`s can be omitted — they will be set automatically to form a rectangle from `(0,0)` to `(width, length)`.

## Tips

- Use a mixin for commonly repeated materials (e.g. a floor texture shared across rooms).
- To connect a room to the outside world, wrap your rooms in an `a-room outside="true"` and put one doorhole on one of its walls.
- Have a look at the [example source](https://github.com/oparamo/aframe-room-component/blob/master/example/index.html) for a walkthrough of the available features.
