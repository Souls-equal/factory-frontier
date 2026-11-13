# Changelog

## Unreleased — raised platform alignment

- Align interactive foundation placement to raised lift ports or nearby flat
  belts; reject ambiguous heights and preserve manual height controls.
- Target foundation surfaces for logistics buildings and support complete
  machine footprints spanning coplanar slabs. Respect real vertical collisions.

## Unreleased — adjustable conveyor lifts

- Choose up/down lift travel from 1 to 8 m before placement using Page Up/Down.
- Aim one-cell conveyors at nearby elevated foundation surfaces; retain existing
  support, collision and transport rules. Player acceptance is pending.
- Record the user’s positive confirmation of the current foundation placement.

## Unreleased — foundation gaps and elevation

- Allow partial coplanar foundation overlap to fill gaps while rejecting fully
  covered footprints; render shared cells once and retain full costs and refunds.
- Avoid false collisions below elevated foundations, adjust voxel ground reference
  and enable aiming at nearby elevated platform levels. Player acceptance pending.

## Unreleased — open-ended conveyor routes

- Allow a route to end in empty space and be extended with another route or
  connected to a later machine, responding to player feedback.
- Show connected/open/blocked status and warn when items can fall from an open end;
  preserve source, cost, terrain and live topology validation.

## Unreleased — conveyor route editor

- Wire control-point route editing to construction input, previews, cost and
  atomic confirmation; preserve single-cell placement and revalidate on actions.
- Record the user's global success report for previously playable Phase 7 work;
  the new editor still requires a player test.

## Unreleased — route-planning foundation

- Add bounded orthogonal control-point expansion and atomic multi-cell conveyor
  planning/placement with endpoint and topology checks. This backend is not yet
  connected to an in-game editor; existing placement is unchanged.

## Unreleased — Phase 7 logistics integration

- Add a fair three-input merger with inspection and bounded protected buffers.
- Add balanced, configurable strict-priority and overflow splitter modes.
- Add one- and two-cell upward/downward conveyor lifts with continuous real
  item movement, height-aware ports and backpressure.
- Add combined logistics play-test guidance; acceptance remains pending.

## Unreleased — balanced splitter

- Add a one-input, three-output splitter with fair round-robin selection and
  blocked-branch fallback for one-cell belts.
- Protect its one-item buffer on demolition; provide inspection and retrieval.
- Record that the player deferred storage and splitter play-tests to test together.

## Unreleased — Phase 7 storage slice

- Add an eight-stack Storage Container with directional one-cell conveyor input
  and output, safe backpressure and demolition protection.
- Add player stack deposit and partial-safe retrieval in the logistics UI.
- Record user confirmation of the Phase 6 chain; Phase 7 play-testing is pending.

## Unreleased — constructor and iron plates

- Add the Constructor, fixed iron plate recipe, item art and inspection UI.
- Connect input and output to one-cell conveyors, with bounded buffers, safe
  backpressure and demolition; share processor simulation with the coal smelter.
- Enable an automated iron/coal → ingot → plate chain; full play test pending.

## Unreleased — creative construction

- Add a session-only Creative mode checkbox to the Q menu to construct without
  material costs. Placement and machine requirements stay unchanged.
- Record whether a building was free so demolition cannot create materials after
  changing modes; paid buildings still refund normally.

## Unreleased — coal-fueled smelter

- Require one coal and one iron ore per ingot. Fuel is consumed only when a
  cycle completes, and missing coal pauses the machine until replenished.
- Accept coal through the existing input conveyor lanes or the inspection panel;
  show and recover fuel separately, and protect it during demolition.
- Give coal and iron ingots distinct conveyor and ground-item colors.

## Unreleased — first smelter slice

- Add an iron smelter, iron-ingot recipe and item, with fixed-tick production,
  input/output buffers, status, inspection, manual recovery and demolition safety.
- Connect the smelter to directional one-cell conveyors with filtered input,
  backpressure and output transport. Constructor and iron plates are still planned.

## Unreleased — mouse construction placement

- Confirm construction with left click instead of C. In uncaptured mode, drag
  to look without placing, or right click to request mouse capture.
- Keep placement edge-triggered, modal-safe and subject to the existing validation.

## Unreleased — refined construction models

- Refresh the foundation, Miner, one-cell conveyor and receiving terminal with
  batched block-style mechanical details, frames, panels and reinforced supports.
- Keep placement, collision, item paths, state lights and port positions unchanged;
  the Q menu and placement ghosts use the same updated models.

## Unreleased — construction menu previews

- Show a static isometric thumbnail of each selectable building in the Q menu,
  generated from the same meshes as placed buildings and cached for menu refreshes.
- Keep previews visible for unaffordable entries, while preserving disabled selection.

## Unreleased — adjustable foundation platforms

- Adjust foundation base height with Page Up/Down in 0.1 m steps; allow floating
  platforms and at most 0.3 m burial, checked against the highest terrain.
- Snap partial edge contacts to neighbouring foundations and inherit their level;
  reset the adjustment after placement. Preview and confirmation share validation.

## Unreleased — camera and voxel movement stability

- Ignore extreme single-event pointer-lock mouse deltas and clear pending look input on focus,
  visibility and pointer-lock changes; normal multi-event fast turns still accumulate.
- Sweep the circular player footprint against actual rounded voxel corners instead
  of expanded square corners. Permit outward/tangential recovery from an existing
  overlap without teleportation while still blocking movement into walls.

## Unreleased — aligned downhill conveyor decks

- Use the entire lower tile as a railed sloping deck for an unambiguous,
  straight downhill connection, instead of a steep half-tile overlay. The
  simulation, preview and placed geometry share the same endpoints.
- Keep centre-entry ramps for turns, multiple incoming routes and tiles that
  must also climb; preserve item projection, drop collection and demolition guards.

## Unreleased — textured natural environment

- Add a pixel-art atlas for voxel grass tops, grassy edges and exposed dirt; the
  terrain still uses one mesh built from the authoritative column surface.
- Replace decorative rock boxes with three textured, irregular faceted variants;
  add textured bark, layered foliage, forked branches and small faceted stones.
  The placement, collision, collection and interaction state remain unchanged.

## Unreleased — voxel inventory artwork

- Restyle the player and terminal inventories with six-column, dark blue square
  slots inspired by the reference; preserve real capacities and existing actions.
- Add local isometric voxel SVG icons for iron ore, copper ore, limestone, coal,
  stone and wood, with readable quantities, accessible labels and text fallback
  for custom items.

## Unreleased — dropped-item recovery and terminal inventory

- Directional conveyor cells collect covered drops at their centre with spacing
  and priority over incoming traffic; terminals collect covered items up to their
  capacity. Remaining items stay visible above the building and retry later.
- The terminal modal now shows storage and the player's inventory in separate,
  responsive compact slot grids. Select either side for details; Retrieve contents
  still transfers what fits. The slot graphics are inspired by voxel inventory UI.

## Unreleased — terminal slots and building contact

- Render the terminal's actual slot inventory with the shared player-inventory
  slot component, item details and existing partial-safe Retrieve contents action.
  The deployed terminal still has one slot; future capacities render dynamically.
- Allow movement out of an existing building collision overlap and sliding along
  its nearest face without generating a positional push or allowing inward motion.
  Existing placement and swept collision protections remain in force.

## Unreleased — Phase 5 feedback

- Add distinctive guided turn skins and open side rails on directional cells.
- Accept one-cell conveyor output on all four marked terminal sides, preserving
  one-stack capacity and backpressure; align heights for either placement order.
- Replace E inspection of belts with pickup of moving items; preserve items when
  inventory is full. Add more seeded starter trees and stones.
- Automated coverage is not a substitute for player acceptance in a real browser.

## Unreleased — directional one-cell conveyors

- Replace the automatic belt menu option with a one-cell belt facing the player's
  view. Its output passes resources to the next belt independent of its heading,
  including fan-in and cycles, or to a compatible machine.
- Open ends drop recoverable items; full machines block instead. Legacy two-cell
  paths remain internal but do not connect to the new tiles.
- Add one-cell ascent and descent ramps, with continuous item transitions and
  previews of affected neighbours. Excessive height changes are rejected;
  real-browser and player verification remain pending.

## Unreleased — conveyor turn preview

- Preview valid neighbour changes as green ghost belts, retaining cyan input and
  yellow output markers; cancellation or an invalid placement restores real models.
- Align unambiguous partially touching belt footprints, and commit exactly the
  topology validated for the preview. Tests cover live material flow in both turn
  directions and four rotations, including a generated-world starting Miner.
  Real-browser and player confirmation remain pending.

## Unreleased — side turns and brighter presentation

- A sideways neighbour now turns an isolated conveyor and can reshape an occupied
  end immediately when items can be safely projected onto the resulting route.
  IDs, ordering, spacing and throughput clocks are preserved; unsafe joins are
  rejected without payment. Visual item positions can snap during a reshape.
- Brighter daytime sky, fog, terrain and fill lighting; conveyor models add
  coloured path-following rails, treads and supports. Real-player and WebGL
  acceptance remain pending.

## Unreleased — automatic conveyor

- One construction choice resolves straight, left/right turns and height changes
  from neighbouring conveyors and machine ports. Preview, rendering and transport
  use the same paths. Branches, cycles and unsafe occupied-path reshapes are refused.
- Existing explicit conveyor definitions remain internally available; automatic
  and legacy tiles cannot be mixed as immediate neighbours. User acceptance pending.

All notable changes to Factory Frontier are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed — source-connected conveyors with open ends

- Source-connected linear belts now transport items before a terminal is placed;
  items queue and report BLOCKED at an open end and resume when a receiver is
  connected. No-source routes remain DISCONNECTED and preserve in-flight items.
- Logistics inspection explains the missing output, and tests cover four
  rotations, backpressure, reconnection and the bootstrap with a mocked renderer.
  Typecheck, test, build and verify passed: 452 tests in 50 files.
- At that earlier revision, the requested single, neighbour-adapting conveyor
  was not implemented and three explicit variants were still available. Physical/WebGL validation remains
  pending, including any other cause behind the reported disconnected layout.

### Changed — block-style current world objects

- Replaced Miner drill/head, deposits, natural rocks and outpost props with block
  geometry; added block detailing to the foundation and receiving terminal.
  Conveyors retain box segments on their logical curved/inclined paths, and
  transported items remain cubes. Auras, ground markings, ports and state lamps
  remain; valid/invalid preview tint now applies to every visible component.
- Collision and game logic are unchanged; natural obstacle colliders are still
  cylindrical. Sky and circular highlight/aura indicators remain non-voxel.
  Real WebGL and physical Phase 5 acceptance are still pending.
- Typecheck, test, build and verify pass: 445 tests in 50 files.

### Added — voxel starter resources

- Added seeded, finite trees (three E presses, 20 wood), branches (5 wood) and
  loose stones (5 stone), with block visuals, inventory-safe partial pickup and
  synchronized movement/placement collision and disappearance.
- Miner Mk.1 now costs 10 stone and 10 wood, no iron. Deposits are inspect-only
  and require a Miner rather than direct gathering; terrain remains indestructible.
- Automated suite: 436 tests in 50 files; typecheck, test, build and verify.
- Bounded generation is tested for representative default seeds, not all custom
  worlds. WebGL and physical acceptance of this update remain pending; see the
  later block-style models entry above.

### In progress — voxel terrain integration

- Replaced the playable smooth surface with seeded, indestructible column
  voxels, exposed-face rendering, swept wall collision and footprint-aware
  landing. Default jumps can reach one-metre blocks in fixed-step tests.
- Building support uses all intersected columns; generated deposits are checked
  for Miner support. Large, complex worlds may use larger blocks to stay within
  the mesh budget. Actual browser rendering and usability remain unverified.
- At the time of terrain integration the new collection loop and cost were
  pending; see the newer entry above. Phase 5 acceptance remains pending.
- Typecheck, tests, build and verify pass: 433 tests in 49 files.

### Earlier — voxel transition foundation (initially isolated)

- Added a read-only, finite column voxel data model with deterministic sampling,
  occupancy queries and exposed-face buffers; added unit tests for coordinates,
  culling, winding, repeatability and allocation limits. The playable world still
  uses the smooth heightfield; collision, controls, resource loop and visuals
  have not been migrated. Typecheck, tests, build and verify passed (416 tests
  in 47 files).
- Recorded the user's non-destructible terrain, tree/branch/stone starting
  resources and voxel-style machine direction. Phase 5 acceptance remains pending.

### Changed — Phase 5 usability follow-up

- Added resource-coloured aura rings and terrain-following ground traces, keeping
  deposit generation, harvesting, targeting and collision unchanged. Physical
  readability still needs user/browser verification.
- Typecheck, test, build and verify passed: 410 tests in 46 files, including
  marker lifecycle and repeat validation/payment for every building type.
- All building types now stay selected after placement; Escape cancels repeat
  mode before interactions or demolition. Validation and payment remain per pose.
- Select the supported Three.js PCF shadow mode directly instead of the removed
  PCFSoft mode (which previously fell back to PCF).
- User reported basic controls, inventory and construction working, did not notice
  the disconnected hint and could not find iron. Iron-dependent manual acceptance
  remains pending; the user reported the soft-shadow warning on the earlier build.

### Work in progress — Phase 5 integrated conveyor foundation

- Reused the merged path, ports and fixed-step conveyor prototype; connected real
  building placement, Miner inventory, oriented topology, terminal collection,
  inspection, modal pause, procedural visuals and interpolated transport items.
- Added building-backed end-to-end, blockage/recovery and conservation tests,
  construction/bootstrap, UI and Three.js scene-graph tests. Typecheck, tests,
  build and verify pass: **402 tests across 45 files**.
- Fixed Miner placement bypassing incompatible pre-existing conveyor ports;
  preview and placement now reject incompatible direction/height before payment.
  Added four-rotation building chains, repeated topology changes, extended
  conservation/spacing, instanced growth and bootstrap modal tests.
- Headless Chromium 143 / SwiftShader WebGL 2 exercised real gathering, building,
  the full transport path, partial collection, full blockage, terminal demolition
  refusal and recovery. Construction-menu pointer lock release/restore also passed
  in a separate run; Three.js logged its existing PCFSoftShadowMap fallback warning.
  Physical/user acceptance and other browser scenarios remain pending. INVALID
  and ERROR are reserved, not currently assigned; linear acyclic routes only.
  Phase 5 remains in progress, not complete. The user authorized proceeding
  from Phase 4 while its own real-browser verification remains pending.

### Added — Phase 4 Miner Mk.1 (browser acceptance pending)

- Deposit-bound construction, deterministic purity-scaled extraction and a
  capacity-limited per-machine output inventory with safe partial transfers.
- Central interaction inspection, enable/disable, modal simulation pause,
  state-driven procedural visuals and output-safe demolition with full refunds.
- Added simulation, lifecycle, generated-world placement, UI, rendering and
  mocked-renderer bootstrap tests. Electricity is not required in this phase;
  no power network or conveyor systems have been added. Real-browser acceptance
  is pending; automated mocked-renderer tests do not establish WebGL usability.
- Typecheck, tests, build and verify passed: **353 tests in 39 files**.

### Added — Phase 3 building and placement (browser acceptance pending)

- Connected the world-owned construction model to the modal menu, placement
  controls, snapped terrain preview, fixed-step construction actions, renderer,
  player collision/ground queries and demolition. Foundation costs 10 stone and
  5 wood; demolition refunds the full cost or fails if inventory cannot fit it.
- Added exact triangle/footprint terrain support checks for the production
  heightfield, and tests for modal isolation, aiming, placement, demolition,
  refunds, collision, terrain support and scene lifecycle.
- `npm run typecheck`, `npm test`, `npm run build` and `npm run verify` passed
  with 335 tests in 34 files, including build/preview/dev-server checks.
- Added the permanent automatic pull-request merging policy to `ARENA_RULES.md`.
- Browser/WebGL verification is pending; Chromium could not launch in the prior
  attempt because NSS/NSPR libraries were missing.

### Changed — Phase 2.1 inventory UX

- Replaced click-to-move with native drag-and-drop for moving, partial merging and
  atomic swapping. Selection is inspection only; cancelled or stale drags do not
  mutate inventory. Half-stack splitting remains available.
- Inventory closing now attempts to restore pointer lock synchronously from the
  closing gesture when it was previously held. Browser denial falls back to
  click-to-capture; scripts cannot reposition the physical cursor.
- Added regression coverage for drag cancellation, conservation, full inventories,
  partial collection across several stacks, and pointer-lock restoration/denial.
  `npm run typecheck`, `npm test`, `npm run build` and `npm run verify` passed
  (314 tests, 27 files). Browser-level verification of these changes was not
  performed in this environment.


### Added — Phase 2 (historical implementation)

- Central item registry with iron ore, copper ore, limestone, coal, stone and wood;
  slot inventory with partial add/remove/transfer, capacity, split and merge.
- Seeded terrain-aware deposits with purity metadata, shared procedural visuals
  and solid colliders, plus gathering via the existing interaction system.
- Tab inventory modal with real slot contents, selection, inspection, moving,
  merging and half-stack splitting. Gameplay input is suspended while open.
- Added collision-release, inventory conservation, generation, gathering, modal,
  input and mocked-renderer bootstrap tests. `npm run typecheck`, `npm test`,
  `npm run build` and `npm run verify` passed (299 tests, 27 files).
- At implementation time, the agent did not perform browser testing. The user
  later reported browser acceptance passed overall, except full inventory. Bounded
  deposit placement can yield fewer results on constrained configurations.

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

- Browser checks for Phase 2.1 drag-and-drop, pointer-lock restoration and full inventory.

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
