# Contributing

## Setup

`.tool-versions` pins Node 24.15.0 and pnpm 12.15.0 (asdf and mise read it). Then:

```bash
pnpm install
```

## Commands

```bash
pnpm start           # dev server on port 8000, opens the demo
pnpm start:https     # the same over https, which WebXR needs on a headset
pnpm build           # type check, then minified UMD + ESM and an unminified UMD in dist/
pnpm lint            # ESLint over src, tests, configs and example scripts
pnpm lint:fix
pnpm test            # Vitest, once
pnpm test:watch
pnpm coverage        # tests with coverage
pnpm changeset       # record a consumer-visible change for the next release
```

CI runs `pnpm build`, `pnpm lint` and `pnpm coverage` on every pull request. Coverage fails below 95% of statements, branches, functions or lines. Those are floors, not targets: a test should check behavior that could break, not reach a number.

## Branches and releases

Pull requests target `develop` and are squash-merged, so the PR title becomes the commit message.

Any change a consumer would notice gets a changeset: run `pnpm changeset`, pick the bump, and write one or two sentences for the release notes. Internal changes (refactors, tests, tooling, docs) don't need one.

A release merges `develop` into `main`. Changesets then opens a Version Packages pull request that bumps the version and writes the changelog. Merging it publishes to npm through trusted publishing and deploys the example pages to GitHub Pages.

## Tests

The tests run in Node with Vitest, without a browser or A-Frame. `tests/setup.ts` puts the `three` package on the global `THREE` and installs a small A-Frame mock that records registered components, so a test can pull a component's definition and call its methods.

- `tests/geometry/` tests the pure geometry functions with plain values and no mocks.
- `tests/builders/` checks what a build leaves on elements (meshes, classes, positions) and in the build state (opening corners), and `tests/builders/helpers/` how the structure is found.
- `tests/components/`, `tests/primitives/` and `tests/systems/` cover the A-Frame layer.
- `tests/integration/rooms.test.ts` builds two rooms joined by a door and a window, then checks which way every surface faces, that the openings line up, and that `room-collision` walks through the door and stops at the window and the walls. Refactors must leave it passing unchanged; a behavior change edits it only where the change is intended.

All mocks live in `tests/utils/mocks.ts`, and every mock factory takes an options object. Element mocks hold real `THREE.Object3D`s, parented the way A-Frame parents them, so transforms, raycasts and world normals are real. Collision tests raycast against real meshes and fire the scene's `loaded` event themselves (`loadScene`). `tests/utils/meshes.ts` reads built meshes in world space. Tests follow arrange, act, assert.

## The demo is the test bench

There is no browser test runner, so `example/index.html` and `example/demo.js` do that job. The page is the published demo and the manual test bench at once: `pnpm start` opens it, and every check is reachable on foot.

- **Grey spheres** toggle a change, such as opening a doorway, growing a room or pushing a wall. A sphere turns green while its change is on, and its label grows when you hover over it.
- **White spheres** are fixed labels that name what to look at.
- **The signpost** by the path introduces the page, explains how to move, and lists the checks that need the A-Frame inspector (Ctrl+Alt+I).

A pull request that changes behavior adds its checks to this page, so the next person can see the change working. Throwaway test pages don't get committed.

## The performance page

`example/perf.html`, with `perf.js` and `perf.css`, builds a grid of rooms joined by doorways. Open it at `/example/perf.html` on the dev server. `?rooms=N` sets the room count (100 by default).

| Key | Action |
| - | - |
| 1, 2, 3 | Reload with 25, 100 or 400 rooms |
| P | Pause this library's ticks |
| M | Animate `room0`, which forces a rebuild every frame |
| I | Walk inside the middle room, with collision on |
| O | Return to the overview |
| R | Toggle a pixel ratio of 1 |
| L | Toggle unlit materials |

F would be the obvious key for flat materials, but A-Frame uses it for fullscreen.

The readout shows the room, wall and portal counts, the tick cost of each of this library's components in µs per frame, fps, draw calls and the render settings. The numbers are averaged over each second, because browsers round `performance.now()` too coarsely to time a single frame. A-Frame's stats panel sits in the top left.

## Code style

Lint enforces most of the style, so run `pnpm lint:fix` after editing. A few rules are worth knowing before you start:

- Each layer imports only from the layers below it. [ARCHITECTURE.md](ARCHITECTURE.md) lists them.
- Every module ends with one `export { }` list.
- File names are camelCase.
- No em dashes, in code, comments or docs.

Work since 2026 is done with the help of AI coding tools; [AI_DISCLOSURE.md](AI_DISCLOSURE.md) says how.
