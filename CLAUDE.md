# CLAUDE.md

Guidance for Claude Code in this repository. [CONTRIBUTING.md](CONTRIBUTING.md) has the full workflow and [ARCHITECTURE.md](ARCHITECTURE.md) explains the code; read them before larger changes.

## Commands

```bash
pnpm start        # dev server on port 8000, opens example/index.html
pnpm build        # type check + dist/ bundles
pnpm lint         # pnpm lint:fix after editing
pnpm test         # Vitest, once
pnpm coverage     # what CI runs, with 95% floors
pnpm test:browser # Playwright, the demo in headless Chromium (CI runs it too)
pnpm changeset    # for consumer-visible changes only
```

## Rules

- Layers, top to bottom: `primitives/`, `components/`, `systems/`, `builders/`, `geometry/`, `utils/`, plus `types/`. Each imports only from the layers below it, and lint enforces it. `geometry/` is pure: no elements, no `AFRAME`, no element types. Shared helpers go in the layer's `helpers/` subdirectory.
- Every module ends with one `export { }` (or `export type { }`) list. File names are camelCase.
- Unit tests run in Node with an A-Frame mock (`tests/setup.ts`). All mocks live in `tests/utils/mocks.ts`, and every factory takes an options object. Geometry tests use plain values, not mocks.
- `example/index.html` and `example/demo.js` are the demo and the manual test bench: a behavior change adds its checks there (grey spheres toggle, white spheres label) and a matching test to `tests/browser/demo.test.ts`, which loads the demo in headless Chromium and reads scene state, not pixels.
- `room-collision` finds surfaces by the `collidable` and `walkable` classes from `src/utils/surfaceClasses.ts`.
- PRs target `develop`. Add a changeset only when a consumer would notice the change.
- No em dashes anywhere, including comments and docs.
