# Changelog

All notable changes to Factory Frontier are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned

- Complete Phase 1 — playable 3D environment: terrain, gravity, jumping, collision
  detection, interaction raycasting and initial environment. (First-person camera,
  mouse look and movement are implemented in 0.2.0; Phase 1 is not complete.)

## [0.2.0] — 2026-11-11

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
