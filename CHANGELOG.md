# Changelog

All notable changes to Factory Frontier are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added — Phase 2 (browser acceptance pending)

- Central item registry with iron ore, copper ore, limestone, coal, stone and wood;
  slot inventory with partial add/remove/transfer, capacity, split and merge.
- Seeded terrain-aware deposits with purity metadata, shared procedural visuals
  and solid colliders, plus gathering via the existing interaction system.
- Tab inventory modal with real slot contents, selection, inspection, moving,
  merging and half-stack splitting. Gameplay input is suspended while open.
- Added collision-release, inventory conservation, generation, gathering, modal,
  input and mocked-renderer bootstrap tests. `npm run typecheck`, `npm test`,
  `npm run build` and `npm run verify` passed (299 tests, 27 files).
- No manual browser/WebGL or pointer-lock testing was performed. Bounded deposit
  placement can yield fewer results on constrained world configurations.

### Fixed

- Fixed player launches under repeated obstacle pressure. Floating-point residual
  penetration could trigger an excessive radial escape, and the resulting position
  correction was incorrectly converted into physical velocity. Horizontal motion
  now sweeps to cylinder contacts and projects inward velocity while preserving
  tangential movement; initial depenetration does not add momentum.
- Added 17 regression tests for the reproduced 31.52 m/s launch, sustained pressure,
  oblique and corner contacts, repeated approaches, jumping, low frame rates,
  slopes, generated boulders, duplicate colliders and swept thin-obstacle contact.
  `npm run verify`: 271 tests across 24 files, typecheck, production build and
  build/preview/dev checks passed. Browser verification was not performed.

### Planned

- Browser acceptance checks for the Phase 1 and Phase 2 implementations.

## [0.3.0] — 2026-11-11

Phase 1 — playable 3D environment: terrain, player physics, collision and the first
interaction system.

### Added

- `TerrainHeightfield` — deterministic seeded heightfield with analytic normals,
  slopes, bounds, and render data that shares the physics triangulation.
- Procedural world generation (`createWorld`): 240 m exploration area with a flat
  outpost clearing, rolling hills, a boundary ridge, instanced boulders/formations
  and two environmental interactables.
- `ObstacleField` — cylinder collision with a spatial-hash broad phase, iterative
  push-out and a deterministic escape search for obstacle clusters.
- Player physics: gravity, ground detection, edge-triggered jumping, landing,
  falling, ground snapping, walkable-slope limit, frictionless sliding on steep
  ground, terrain and obstacle collision, camera interpolation (`viewAt(alpha)`).
- Interaction system: `Interactable` contract, analytic ray/sphere targeting,
  closest-target selection, range handling, edge-triggered execution, world
  interactables (Survey Beacon, Relay Mast).
- `InteractionPrompt` UI: highlighted target name, contextual hint, transient
  outcome feedback.
- `EnvironmentView` renderer: vertex-coloured terrain mesh, sky dome, horizon fog,
  instanced rocks, props with highlight rings, player-following shadow light.
- Configuration sections `world`, `player` and `interaction`, plus `render.fog*`
  values, all validated with explicit ranges.
- Input: `Space` jump and `E` interact as edge-triggered actions (`consumeJump`,
  `consumeInteract`), ignoring key auto-repeat and typing targets.
- 96 new tests (158 → 254 total across 23 files) covering terrain, obstacles, world
  assembly, physics, interaction, prompt UI, input edges and two end-to-end suites.

### Changed

- `SceneManager` now builds the environment from world data instead of drawing the
  flat foundation plane, grid, pad, beacon and boundary stakes.
- `Engine` takes the world and exposes `setHighlight`; the shadow light follows the
  player.
- `PlayerController` integrates physics on the fixed clock and keeps look at frame
  rate; `update()` remains as a convenience wrapper.
- Shell copy reflects Phase 1 ("Terrain Survey", jump/interact hints).

### Removed

- The foundation-only flat plane, construction grid, origin pad, beacon and
  boundary stakes (`foundation:*` scene objects).

### Verification

- `npm run typecheck` — pass.
- `npm test` — 254/254 tests (23 files).
- `npm run build` — pass (`dist/index.html` 3.21 kB, CSS 6.63 kB, JS 593.19 kB).
- `npm run verify:build` / `verify:preview` / `verify:dev` — 25/25, 12/12, 37/37.
- Real-browser WebGL/pointer-lock verification was **not** performed (no browser
  binary in this environment).

## [0.2.0] — 2026-11-11

### Changed (CI/CD infrastructure)

- `ci.yml` now validates pull requests only (`pull_request`, `workflow_dispatch`)
  instead of also running on every `push`, removing the duplicate pipeline per PR
  update and the second full pipeline on `main`.
- Added `concurrency: ci-${{ github.ref }}` with `cancel-in-progress: true` so an
  obsolete run for an older commit is cancelled rather than queued.
- `deploy-pages.yml` splits concurrency by job: builds use
  `pages-build-${{ github.ref }}` with `cancel-in-progress: true` (a newer commit
  supersedes a stale build) while deploys use `pages-deploy` with
  `cancel-in-progress: false` (deployments never interleave or cancel mid-flight).
- Removed the workflow-wide `pages` concurrency group that made every new push wait
  behind a running build/deploy pair.
- Updated actions to maintained majors: `checkout@v7`, `setup-node@v7`,
  `configure-pages@v6`, `upload-pages-artifact@v5`, `deploy-pages@v5`. Added
  `timeout-minutes` to all jobs.
- Deployment no longer repeats `verify:preview`/`verify:dev`; those dev-server
  checks remain in CI, while the deploy gate runs tests, type-checked build and
  `verify:build`.
- `README.md` and `PROJECT_STATUS.md` now describe the workflow structure and the
  GitHub Actions Pages source accurately (the previous "Pages uses branch
  deployment" statement was outdated).

### Verified

- First run on the new structure: CI run `43101563695` (PR #3) — all 10 steps
  `success` in 21 s.
- Merge to `main` (`b2dc982`) produced exactly **one** workflow run — the Pages
  deploy `43101711244` (build + deploy `success`, 32 s), with no duplicate CI run.
- Deployment `7721334220` published `dist/`; `https://souls-equal.github.io/factory-frontier/`
  now serves the hashed production bundles (`assets/index-V1qLIqrz.css`,
  `assets/index-BLJSyog1.js`) instead of raw sources.

### Notes

- No game code, tests, configuration or dependencies changed.
- The 2026-11-11 queued runs and `startup_failure` were caused by GitHub incident
  `dvy0t3mvh1lg` (Actions/Pages `major_outage`), not by the workflows. Four runs
  from that window (`43095979915`, `43096758010`, `43096810240`, `43096810255`)
  remain listed as `queued` as orphaned records; they never executed and cannot be
  cancelled through the API.


First-person camera and input foundation (Phase 1 groundwork).

### Added

- `PlayerController` — Three-free first-person controller with mouse look, pitch
  clamping, yaw normalization, accelerated WASD movement, sprint, spawn/reset and
  a circular foundation play-area bound.
- `InputManager` — keyboard axes, pointer-lock mouse look with click-drag fallback,
  ignored keys while typing, blur/visibility key clearing and complete listener
  cleanup. Pointer-lock state drives the UI hint.
- Presentation `FrameSystem` stage in `Game`: runs once per frame before rendering,
  included in statistics, unregisterable and fail-fast on errors.
- `CameraView` contract and `Engine.applyView` → `CameraManager.applyView`
  (`YXZ` rotation, finite-value validation).
- Validated, immutable `GameConfig.controls` section (eye height, move speed,
  sprint multiplier, acceleration, look sensitivity, pitch limit, play-area radius).
- Crosshair, controls hint and control documentation in the shell.
- Tests for input, player movement/look, controls hint, camera application, frame
  systems and bootstrap camera wiring (110 → 158 tests).
- Architecture Appendix B (camera/input stages, control config, persistence design
  baseline, data-driven definition baseline) and GDD Appendix A (open decisions).

### Changed

- `GameStats` now reports `frameSystems`; the debug overlay shows simulation and
  frame system counts.
- Verification scripts also check the crosshair, controls hint and new modules.
- Bumped version to 0.2.0.

### Design notes

- Industrial simulation remains deterministic and fixed-step; only presentation
  camera updates use frame deltas. Camera movement is explicitly not physics.
- No save code and no item/recipe registries were added: their designs are
  documented and deferred to Phases 12 and 2–7 to avoid placeholder systems.

### Verification

- `npm run typecheck` — pass.
- `npm test` — 158/158 tests pass (15 files).
- `npm run build` — pass.
- `npm run verify:build` / `verify:preview` / `verify:dev` — all pass.
- No browser binary is available in the sandbox, so real WebGL rendering and
  pointer-lock behaviour remain a manual check. GitHub Pages source is still a
  legacy branch deployment; see `PROJECT_STATUS.md`.

## [0.1.0] — 2026-11-11

Phase 0 — Repository inspection and foundation.

### Added

- TypeScript 5.9 + Vite 8 + Three.js 0.187 toolchain with strict type checking,
  npm scripts and a committed lockfile.
- Production build configured for GitHub Pages: base path `/factory-frontier/`
  for production, `/` for development, overridable with `VITE_BASE_PATH`.
- GitHub Actions workflows: CI (typecheck, tests, build, verification) and GitHub
  Pages deployment from `main`.
- Core runtime architecture:
  - `Game` orchestrator with explicit lifecycle state machine and typed events.
  - `GameEngine` / `RenderBackend` contracts separating gameplay from rendering.
  - `GameClock` fixed-timestep accumulator (50 ms) with bounded catch-up and
    dropped-time diagnostics.
  - `GameLoop` variable-rate render loop with injectable frame scheduler and
    rolling FPS/frame-time statistics.
  - `EventBus` typed pub/sub with error isolation.
  - Validated, immutable configuration including base-path resolution shared with
    the Vite config.
- Rendering layer: `Renderer` wrapper (color management, tone mapping, shadows,
  DPR cap), `SceneManager` foundation scene, `CameraManager`, `LightingManager`
  and an `Engine` composition root.
- Phase 0 foundation scene: ground plane, construction grid, origin pad, beacon
  and 48 instanced boundary markers, with fog, hemisphere/ambient/key lighting and
  soft shadows.
- Minimal application shell: boot overlay with live status, fatal startup error
  panel with WebGL2 guidance, optional debug statistics (`?debug=1`) and an
  original SVG favicon. No gameplay HUD.
- GPU resource disposal utilities (`disposeObjectTree`).
- Test suite (110 tests) for configuration, event bus, clock, loop, lifecycle,
  game orchestration, engine composition, scene graph, camera, lighting, overlay
  and the real `main.ts` bootstrap with a mocked engine boundary.
- Verification scripts: `verify:build`, `verify:preview`, `verify:dev`, aggregated
  by `npm run verify`.

### Changed

- Split the monolithic 2,222-line README master specification into canonical
  `docs/GDD.md`, `docs/TECHNICAL_ARCHITECTURE.md` and
  `docs/DEVELOPMENT_ROADMAP.md`, byte-for-byte preserving the original text.
  `README.md` is now the project entry point, quick-start and architecture map.
- Replaced the empty `src/index.html` placeholder with a root `index.html`
  application shell (Vite requires the entry document at the project root).
- Marked Phase 0 complete in the roadmap and documented the implemented
  architecture in `docs/TECHNICAL_ARCHITECTURE.md`.

### Removed

- Empty `src/index.html` placeholder (no functionality lost).

### Fixed

- `Game.resume()` could start a game from `initialized` because the generic state
  machine permits `initialized → running`. Lifecycle actions now have explicit
  per-action preconditions (`GameLifecycleError`).

### Verification

- `npm run typecheck` — pass.
- `npm test` — 110/110 tests pass.
- `npm run build` — production build succeeds (≈560 kB JS, ≈4.2 kB CSS).
- `npm run verify:build` — Pages base path and asset integrity verified.
- `npm run verify:preview` — build served and fetched under `/factory-frontier/`.
- `npm run verify:dev` — dev server serves and transforms the module graph.
- Browser/WebGL rasterization was not executed in the development sandbox (no
  browser binary available); see `PROJECT_STATUS.md` known limitations.

## [0.0.0] — 2026-11-11

- Initial repository import: master specification, ARENA rules, project status,
  license and empty `src/index.html`.
