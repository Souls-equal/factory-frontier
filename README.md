# FACTORY FRONTIER

A first-person, browser-based 3D factory automation game. The player lands on an
unexplored planet, extracts its resources, and builds increasingly complex
automated production chains.

**Status:** Phase 0 (foundation) implementation complete · manual browser check pending · Version 0.1.0
**Next phase:** Phase 1 — Playable 3D environment (not started)
**Platform:** Desktop web browser (WebGL2) · **Stack:** TypeScript, Three.js, Vite

---

## Current state

Phase 0 establishes the technical foundation only. There is no player movement,
terrain, inventory, construction or production yet — those are Phases 1–6.

What exists and works today:

- Strict TypeScript project built by Vite 8, with a production build configured
  for GitHub Pages.
- A central `Game` orchestrator with an explicit lifecycle state machine and a
  dependency-injected rendering engine.
- A deterministic fixed-timestep simulation clock (50 ms, 20 Hz) with bounded
  catch-up, driven by a variable-rate render loop.
- A WebGL2 scene: a foundation survey site with a ground plane, construction
  grid, origin pad, beacon, instanced boundary markers, lighting, shadows and fog.
- A typed event bus, validated configuration, and a minimal boot/fatal/debug UI.
- Automated tests and build/serve verification scripts (see below).

Deliberately **not** implemented yet: terrain generation, first-person controls,
interaction raycasting, inventory, buildings, machines, conveyors, power,
progression, persistence, audio. The foundation scene is a render-pipeline
fixture, not gameplay content.

## Quick start

Requirements: Node.js ≥ 20.19 (developed and verified on Node 22.22) and npm 10.

```bash
npm ci
npm run dev
```

Open <http://localhost:5173/>. Add `?debug=1` to the URL to show live engine
statistics (FPS, frame time, simulation time, ticks, draw calls, triangles).

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
  └── src/main.ts                 DOM shell, bootstrap, resize, fatal UI
        └── core/Game.ts          lifecycle, fixed-step system scheduling, stats
              ├── core/GameLoop.ts ──> core/GameClock.ts (fixed timestep)
              ├── core/GameState.ts (explicit lifecycle transitions)
              ├── core/EventBus.ts  (typed pub/sub)
              └── GameEngine contract
                    └── engine/Engine.ts
                          ├── Renderer.ts        WebGL renderer + statistics
                          ├── SceneManager.ts    scene graph / foundation scene
                          ├── CameraManager.ts   perspective camera
                          └── LightingManager.ts lights and shadows
```

Key rules enforced by this structure:

- **Gameplay never imports Three.js.** `Game` depends only on the `GameEngine`
  interface (`src/engine/types.ts`).
- **Rendering never advances game state.** The render loop runs at display rate;
  simulation advances only in fixed steps.
- **Everything deterministic is injectable and tested.** The frame scheduler and
  engine can be substituted in tests; no WebGL is required for logic tests.
- **Configuration is centralized and validated** in `src/core/Configuration.ts`.
  The same module resolves the Vite base path for both dev and production.

### Phase 0 source layout

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
├── styles/main.css
├── ui/StatusOverlay.ts         boot status, fatal errors, debug stats
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
2. `vitest run` — 110 automated tests covering the clock, loop, event bus,
   configuration, lifecycle, engine composition, scene graph, overlay and the real
   `main.ts` bootstrap (with the engine mocked at the `GameEngine` boundary).
3. `vite build` — production bundle.
4. `verify-build` — checks the built HTML references `/factory-frontier/assets/…`,
   assets exist, no localhost or dev-server paths leak into artifacts.
5. `verify-preview` — starts the preview server under the Pages base path and
   fetches the document plus every referenced asset over HTTP.
6. `verify-dev` — starts the dev server, fetches and transforms the module graph,
   and confirms Three.js resolves through Vite.

**Rendering limitation:** this environment has no browser binary, so actual WebGL
rasterization is not executed by the automated checks. Scene construction, camera,
lighting and bootstrap wiring are unit-tested in Node/jsdom; the served game must
be inspected in a browser before Phase 1 work begins.

## Deployment (GitHub Pages)

The production build targets `https://<user>.github.io/factory-frontier/` by
default, so Vite's `base` is `/factory-frontier/` for production and `/` for
development. Override the production base with `VITE_BASE_PATH`:

```bash
VITE_BASE_PATH=/ npm run build      # custom domain at the root
VITE_BASE_PATH=/games/ff/ npm run build
```

`.github/workflows/deploy-pages.yml` builds, tests and deploys `dist/` to GitHub
Pages on every push to `main`. Select **GitHub Actions** as the Pages source in the
repository settings. For a renamed repository or custom domain, set the
`VITE_BASE_PATH` repository variable.

No backend, account or database is required. The build is fully static and uses
relative-to-base asset URLs.

## Documentation

The documentation is the source of truth. Phase 0 split the former monolithic
README specification into the required canonical documents without changing its
content:

- [`docs/GDD.md`](docs/GDD.md) — game vision, systems and design requirements (§0–19)
- [`docs/TECHNICAL_ARCHITECTURE.md`](docs/TECHNICAL_ARCHITECTURE.md) — architecture,
  simulation, performance and testing requirements (§20–23) plus the Phase 0
  implementation map
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
| 1 | Playable 3D environment (terrain, FPS controls, collisions) | Next |
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
