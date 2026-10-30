---
"@oparamo/aframe-room-component": major
---

The README now has a Public API section listing what a minor release won't change. Anything outside it is internal. Breaking changes:

- Every wall, floor, ceiling and sides element keeps its mesh at `el.getObject3D('mesh')`. Walls used `wallMesh`, and the others used their own names. Because of the `mesh` key, A-Frame's `material` component now updates a built surface when its material changes at runtime. Removing a `material` from a room, wall, portal or surface rebuilds it, so the surfaces that inherited it show the inherited material again.
- The properties the components used to put on elements are gone: `el.mesh`, a room's `walls`, `floor` and `ceiling`, a wall's `getHeight()`, and an opening's `getDoorlink()` and `vertices`.
- The build system is now `room-building`, and it is internal.
- `room-building-complete` now carries `detail.rooms` and `detail.portals`: the rooms and portals that pass built.
- `package.json` has an `exports` map: `import` resolves to the ESM build, everything else to the minified UMD, and files under `dist/` stay importable. Deep imports outside `dist/` no longer resolve.
- The `aframe` peer range is now `^1.5.0` instead of `>=1.5.0`, so A-Frame 2 isn't assumed to work.
