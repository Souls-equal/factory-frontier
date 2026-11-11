# FACTORY FRONTIER

A first-person, browser-based 3D factory automation game. The player lands on an
unexplored planet, extracts its resources, and builds increasingly complex
automated production chains.

**Status:** Phase 1 implemented; browser acceptance pending · Version 0.3.0
**Next phase:** Phase 2 — resources and inventory (requires authorization)
**Platform:** Desktop web browser (WebGL2) · **Stack:** TypeScript, Three.js, Vite

---

## Current state

Phase 1 is implemented: the player explores a real, procedurally generated terrain
with gravity, jumping, collision and a central interaction system. Factory gameplay
(inventory, buildings, machines, power, saves) has **not** started.

What exists and works today:

- Strict TypeScript project built by Vite 8, with a production build configured
  for GitHub Pages.
- A central `Game` orchestrator with an explicit lifecycle state machine and a
  dependency-injected rendering engine.
- A deterministic fixed-timestep simulation clock (50 ms, 20 Hz) with bounded
  catch-up, driven by a variable-rate render loop; camera interpolation between
  steps keeps motion smooth without touching simulation state.
- **Terrain:** a finite 240 m seeded heightfield (120×120 cells) with hills, a flat
  outpost clearing and a raised boundary ridge. Gameplay queries read terrain data,
  never mesh geometry, and the render mesh is generated from the same triangles.
- **Physics:** gravity, ground detection, edge-triggered jumping, landing, slope
  handling with a configurable walkable limit, sliding on steep ground, and
  collision against terrain and solid obstacles.
- **Interaction:** camera-ray targeting with closest-target selection, a reusable
  `Interactable` contract, highlight + prompt + contextual hint, and `E` to use.
- **Environment:** vertex-coloured terrain, sky dome, horizon fog, instanced
  boulders and formations, player-following shadows, two interactable props.
- A typed event bus, validated configuration, and a minimal boot/fatal/debug UI.
- 271 automated tests plus build/serve verification scripts (see below).

Deliberately **not** implemented yet: inventory, resources, buildings, machines,
conveyors, power, progression, persistence, audio. The survey beacon and relay mast
are environment props that demonstrate the interaction contract — not gameplay
systems.

## Quick start

Requirements: Node.js ≥ 20.19 (developed and verified on Node 22.22) and npm 10.

```bash
npm ci
npm run dev
```

Open <http://localhost:5173/>. Click the scene to capture the mouse, then move
with **WASD**, sprint with **Shift**, jump with **Space**, look with the mouse and
press **E** when the prompt appears. Click-drag look works even if pointer lock is
denied. Add `?debug=1` to the URL to show live engine statistics (FPS, frame time,
simulation time, ticks, draw calls, triangles, frame systems).

### Controls

| Input | Action |
|---|---|
| Mouse (pointer lock or click-drag) | Look around |
| W / A / S / D | Move forward / left / backward / right |
| Space | Jump (grounded only; holding does not repeat) |
| Shift | Sprint |
| E | Interact with the highlighted target |
| Esc | Release pointer lock |

Key remapping is intentionally not implemented yet (Phase 13 settings).

### Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Vite development server with HMR |
| `npm run build` | Type-check, then build the production bundle into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | Strict TypeScript check (`tsc --noEmit`) |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run verify:build` | Assert the build uses the Pages base path and has no localhost URLs |
| `npm run verify:preview` | Serve `dist/` under the base path and fetch every asset |
| `npm run verify:dev` | Boot the dev server and fetch/transform the module graph |
| `npm run verify` | The full gate: typecheck → tests → build → all verifications |

## Architecture at a glance

```text
index.html
  └── src/main.ts                   DOM shell, bootstrap, resize, fatal UI
        ├── input/InputManager.ts   keyboard/mouse/pointer-lock → axes, look, action edges
        ├── world/World.ts          terrain + obstacles + interactables + spawn (no Three.js)
        │     ├── terrain/TerrainHeightfield.ts  seeded heights, normals, slopes, render data
        │     ├── ObstacleField.ts  cylinder collision + spatial hash
        │     └── noise.ts, rng.ts  deterministic generation
        ├── player/PlayerController.ts  Three-free physics: gravity, jump, slopes, collision
        ├── interaction/
        │     ├── InteractionSystem.ts  raycast targeting, edge-triggered execution
        │     ├── Interactable.ts       reusable contract
        │     └── raycast.ts            pure ray/sphere maths
        └── core/Game.ts            lifecycle, fixed + frame systems, stats
              ├── core/GameLoop.ts ──> core/GameClock.ts (fixed timestep + alpha)
              ├── core/GameState.ts (explicit lifecycle transitions)
              ├── core/EventBus.ts  (typed pub/sub)
              └── GameEngine contract
                    └── engine/Engine.ts
                          ├── Renderer.ts         WebGL renderer + statistics
                          ├── SceneManager.ts     atmosphere + environment view
                          ├── EnvironmentView.ts  terrain mesh, sky, instanced rocks, props
                          ├── CameraManager.ts    perspective camera / applyView
                          └── LightingManager.ts  lights, shadows, player-following key light
```

Key rules enforced by this structure:

- **Gameplay never imports Three.js.** `Game` depends only on the `GameEngine`
  interface (`src/engine/types.ts`).
- **Rendering never advances game state.** The render loop runs at display rate;
  industrial simulation advances only in fixed steps. Input-driven camera updates
  run in a presentation frame stage immediately before rendering.
- **The player controller is Three-free.** It produces a plain `CameraView`; the
  engine applies it to the camera.
- **Everything deterministic is injectable and tested.** The frame scheduler and
  engine can be substituted in tests; no WebGL is required for logic tests.
- **Configuration is centralized and validated** in `src/core/Configuration.ts`.
  The same module resolves the Vite base path for both dev and production.

### Foundation source layout

```text
src/
├── main.ts                     application bootstrap
├── core/
│   ├── Configuration.ts        validated config + base-path resolution
│   ├── EventBus.ts             typed event bus
│   ├── Game.ts                 game orchestrator and lifecycle
│   ├── GameClock.ts            fixed-timestep accumulator
│   ├── GameLoop.ts             rendering loop and frame statistics
│   └── GameState.ts            lifecycle state machine
├── engine/
│   ├── CameraManager.ts
│   ├── Engine.ts
│   ├── LightingManager.ts
│   ├── Renderer.ts
│   ├── SceneManager.ts
│   └── types.ts                GameEngine / RenderBackend contracts
├── input/InputManager.ts       keyboard, mouse-look, pointer lock / drag fallback
├── player/PlayerController.ts  first-person movement and look (no Three.js)
├── styles/main.css
├── ui/
│   ├── ControlsHint.ts         pointer-lock-aware control hint
│   └── StatusOverlay.ts        boot status, fatal errors, debug stats
└── utils/DisposalUtils.ts      GPU resource disposal
tests/                          unit and integration tests
scripts/                        build/preview/dev-server verification
```

## Testing and validation

```bash
npm run verify
```

This executes:

1. `tsc --noEmit` — strict type checking.
2. `vitest run` — 271 automated tests covering the clock, loop, event bus,
   configuration, lifecycle, engine composition, scene graph, input, player
   physics, terrain, obstacles, world assembly, interaction, prompt UI, frame
   systems, overlays, the real `main.ts` bootstrap (engine mocked at the
   `GameEngine` boundary) and two end-to-end Phase 1 suites.
3. `vite build` — production bundle.
4. `verify-build` — checks the built HTML references `/factory-frontier/assets/…`,
   assets exist, no localhost or dev-server paths leak into artifacts.
5. `verify-preview` — starts the preview server under the Pages base path and
   fetches the document plus every referenced asset over HTTP.
6. `verify-dev` — starts the dev server, fetches and transforms the module graph,
   and confirms Three.js resolves through Vite.

**Rendering limitation:** this environment has no browser binary, so actual WebGL
rasterization and real pointer-lock behaviour are not executed by the automated
checks. Terrain data, physics, collision, targeting, scene construction and
bootstrap wiring are tested in Node/jsdom, and the game must still be inspected in
a browser before visual/polish claims are made.

## Deployment (GitHub Pages)

The production build targets `https://<user>.github.io/factory-frontier/` by
default, so Vite's `base` is `/factory-frontier/` for production and `/` for
development. Override the production base with `VITE_BASE_PATH`:

```bash
VITE_BASE_PATH=/ npm run build      # custom domain at the root
VITE_BASE_PATH=/games/ff/ npm run build
```

There are exactly two workflows, with disjoint responsibilities:

| Workflow | Trigger | Purpose |
|---|---|---|
| `.github/workflows/ci.yml` | `pull_request`, `workflow_dispatch` | Validate a PR: `npm ci`, type-check, tests, production build, `verify:build`, `verify:preview`, `verify:dev` |
| `.github/workflows/deploy-pages.yml` | `push` to `main`, `workflow_dispatch` | Tests, builds, verifies and deploys `dist/` to GitHub Pages |

CI does **not** run on pushes to `main`; the deployment workflow runs the same
production gate there, so no commit is validated twice. Concurrency is scoped so a
newer commit supersedes a stale run without cancelling a deployment that is
already in flight (`ci-${{ github.ref }}` and `pages-build-${{ github.ref }}` use
`cancel-in-progress: true`; `pages-deploy` serialises deployments with
`cancel-in-progress: false`).

**Required repository setting:** Pages → Build and deployment → Source =
**GitHub Actions**. With the branch source selected, GitHub publishes the raw
repository (unbundled `index.html`/`src/*.ts`) instead of `dist/`. For a renamed
repository or custom domain, set the `VITE_BASE_PATH` repository variable.

The live site is <https://souls-equal.github.io/factory-frontier/>. It is only
considered deployed when the `Deploy GitHub Pages` run for the pushed `main` commit
succeeded and the published HTML references `/factory-frontier/assets/*` — a
successful `build` job alone does not publish anything.

No backend, account or database is required. The build is fully static and uses
relative-to-base asset URLs.

## Documentation

The documentation is the source of truth. Phase 0 split the former monolithic
README specification into the required canonical documents without changing its
content:

- [`docs/GDD.md`](docs/GDD.md) — game vision, systems and design requirements (§0–19)
- [`docs/TECHNICAL_ARCHITECTURE.md`](docs/TECHNICAL_ARCHITECTURE.md) — architecture,
  simulation, performance and testing requirements (§20–23), the Phase 0
  implementation map and the foundation camera/persistence design baseline
- [`docs/DEVELOPMENT_ROADMAP.md`](docs/DEVELOPMENT_ROADMAP.md) — phase scope and
  acceptance criteria (§24–26)
- [`PROJECT_STATUS.md`](PROJECT_STATUS.md) — live progress, verification results,
  decisions and known issues
- [`CHANGELOG.md`](CHANGELOG.md) — notable changes
- [`ARENA_RULES.md`](ARENA_RULES.md) — development rules

## Roadmap

| Phase | Scope | Status |
|---|---|---|
| 0 | Repository inspection and foundation | ✅ Complete |
| 1 | Playable 3D environment | 🟡 Implemented; manual browser verification pending |
| 2 | Resources and inventory | Planned |
| 3 | Building and placement | Planned |
| 4 | First automated extractor | Planned |
| 5 | Conveyor foundation | Planned |
| 6 | First production chain (iron plates) | Planned |
| 7–13 | Advanced logistics, power, manufacturing, world, progression, saves, polish | Planned |

Phase scope and acceptance criteria are defined in
[`docs/DEVELOPMENT_ROADMAP.md`](docs/DEVELOPMENT_ROADMAP.md).

## License

Apache License 2.0 — see [`LICENSE`](LICENSE).
