# FACTORY FRONTIER — TECHNICAL ARCHITECTURE

**Document type:** Technical Architecture Specification
**Version:** 2.0 (Phase 0 split of the master specification)
**Status:** Canonical architecture source of truth

> This document is the technical section (§20–§23) of the Factory Frontier master
> specification v2.0, preserved verbatim from the former monolithic `README.md`.
> Architecture decisions actually taken during development are recorded in
> `PROJECT_STATUS.md` ("Architectural Decisions") and in the implementation map
> at the end of this document.

---

# 20. TECHNICAL ARCHITECTURE

## 20.1 General architecture

The project must be modular.

Suggested structure:

```text
src/
│
├── main.ts
│
├── core/
│   ├── Game.ts
│   ├── GameLoop.ts
│   ├── GameClock.ts
│   ├── EventBus.ts
│   ├── GameState.ts
│   └── Configuration.ts
│
├── engine/
│   ├── Renderer.ts
│   ├── SceneManager.ts
│   ├── CameraManager.ts
│   ├── LightingManager.ts
│   └── AssetManager.ts
│
├── player/
│   ├── Player.ts
│   ├── PlayerController.ts
│   ├── PlayerCamera.ts
│   ├── PlayerInventory.ts
│   └── InteractionSystem.ts
│
├── world/
│   ├── WorldManager.ts
│   ├── ChunkManager.ts
│   ├── Chunk.ts
│   ├── TerrainGenerator.ts
│   ├── BiomeGenerator.ts
│   ├── ResourceGenerator.ts
│   └── EnvironmentManager.ts
│
├── entities/
│   ├── Entity.ts
│   ├── EntityRegistry.ts
│   └── EntityManager.ts
│
├── items/
│   ├── Item.ts
│   ├── ItemRegistry.ts
│   └── Inventory.ts
│
├── buildings/
│   ├── Building.ts
│   ├── BuildingRegistry.ts
│   ├── BuildingManager.ts
│   ├── PlacementSystem.ts
│   ├── GridSystem.ts
│   └── ConstructionManager.ts
│
├── logistics/
│   ├── Conveyor.ts
│   ├── ConveyorPath.ts
│   ├── ConveyorManager.ts
│   ├── ConveyorSimulation.ts
│   ├── Splitter.ts
│   ├── Merger.ts
│   └── LogisticsNetwork.ts
│
├── production/
│   ├── Machine.ts
│   ├── MachineManager.ts
│   ├── Recipe.ts
│   ├── RecipeRegistry.ts
│   ├── ProductionSystem.ts
│   └── ProductionStatistics.ts
│
├── fluids/
│   ├── Fluid.ts
│   ├── Pipe.ts
│   ├── PipeNetwork.ts
│   └── FluidSimulation.ts
│
├── power/
│   ├── PowerGenerator.ts
│   ├── PowerPole.ts
│   ├── PowerNetwork.ts
│   └── PowerManager.ts
│
├── progression/
│   ├── Milestone.ts
│   ├── MilestoneManager.ts
│   ├── Technology.ts
│   └── TechnologyManager.ts
│
├── save/
│   ├── SaveManager.ts
│   ├── SaveSerializer.ts
│   ├── SaveValidator.ts
│   └── SaveMigration.ts
│
├── ui/
│   ├── UIManager.ts
│   ├── HUD.ts
│   ├── InventoryUI.ts
│   ├── ConstructionUI.ts
│   ├── MachineUI.ts
│   ├── MapUI.ts
│   └── SettingsUI.ts
│
├── data/
│   ├── items/
│   ├── buildings/
│   ├── recipes/
│   ├── technologies/
│   └── resources/
│
└── utils/
    ├── MathUtils.ts
    ├── GeometryUtils.ts
    ├── SpatialHash.ts
    └── ValidationUtils.ts
```

The structure is a reference architecture.

Adjust it when necessary, but preserve clear separation of responsibilities.

## 20.2 Data-driven design

Avoid hardcoding machine behavior inside individual UI components.

Machine definitions, recipes, item definitions, resource properties, and technology requirements should be stored in centralized data registries.

This allows the game to be expanded without rewriting core systems.

## 20.3 Rendering separation

Logical entities and rendered objects must be separate.

For example:

A conveyor item has:

- Logical item ID.
- Conveyor ID.
- Position along its path.
- Item type.

Its visual representation is simply a rendered instance derived from that logical state.

The same principle applies to buildings, machines, resources, and environmental objects.

## 20.4 Event system

Use a centralized event system for communication between independent systems.

Examples:

- BUILDING_PLACED.
- BUILDING_REMOVED.
- ITEM_TRANSFERRED.
- RECIPE_CHANGED.
- MACHINE_STATE_CHANGED.
- POWER_NETWORK_CHANGED.
- TECHNOLOGY_UNLOCKED.
- SAVE_COMPLETED.

Avoid excessive direct dependencies between unrelated systems.

---

# 21. SIMULATION ARCHITECTURE

## 21.1 Fixed timestep

Separate rendering updates from gameplay simulation.

The rendering loop may run at variable frame rates.

The industrial simulation should run at a controlled fixed timestep.

Suggested initial simulation interval: 50 milliseconds.

This gives a simulation frequency of 20 updates per second.

The interval must be configurable.

## 21.2 Simulation stages

Use a centralized simulation scheduler.

Suggested stages:

1. Power network updates.
2. Resource extraction.
3. Machine production.
4. Conveyor item movement.
5. Logistics transfers.
6. Fluid updates.
7. Statistics updates.

The precise execution order must be designed to avoid inconsistent state transitions.

## 21.3 Simulation performance

Avoid processing every machine unnecessarily.

Use active-state tracking.

Examples:

- An idle machine with missing input does not need expensive production calculations.
- A stationary conveyor does not need unnecessary geometry updates.
- Inactive chunks should not perform unnecessary visual updates.

## 21.4 Time management

Use accumulated simulation time.

Do not base industrial production directly on the rendering frame rate.

The simulation must remain consistent when the frame rate fluctuates.

If the browser temporarily freezes, avoid executing an unbounded number of catch-up updates.

Use a maximum catch-up limit.

---

# 22. PERFORMANCE AND SCALABILITY

## 22.1 Rendering optimization

Use:

- InstancedMesh.
- Shared geometries.
- Shared materials.
- Frustum culling.
- LOD where appropriate.
- Chunk-based visibility.
- Efficient shadow settings.

## 22.2 Industrial optimization

Avoid scanning all entities repeatedly.

Use:

- Spatial indexing.
- Network graphs.
- Connection caches.
- Dirty-state flags.
- Incremental updates.
- Object pooling.

## 22.3 Large factories

The architecture must support future factories containing:

- Hundreds of machines.
- Hundreds of conveyor segments.
- Thousands of transported items.
- Multiple independent production networks.

These are design targets, not guaranteed performance claims.

Measure performance and optimize actual bottlenecks.

## 22.4 Performance monitoring

Implement an optional developer performance panel.

Display:

- FPS.
- Frame time.
- Active chunks.
- Loaded buildings.
- Active machines.
- Conveyor item count.
- Simulation duration.
- Draw calls where available.

---

# 23. TESTING AND VALIDATION

## 23.1 Testing philosophy

Every major gameplay system must be testable independently.

Do not rely exclusively on visual inspection.

Use automated tests for deterministic logic.

## 23.2 Required tests

### Inventory

- Add item.
- Remove item.
- Transfer item.
- Full inventory.
- Invalid quantity.
- Stack merging.

### Extraction

- Normal deposit.
- Impure deposit.
- Pure deposit.
- No power.
- Full output inventory.

### Conveyors

- Normal movement.
- Item spacing.
- Blocked endpoint.
- Valid transfer.
- Invalid destination.
- Splitter distribution.
- Merger fairness.
- Conveyor removal.

### Production

- Valid recipe.
- Missing input.
- Full output.
- Interrupted power.
- Multiple production cycles.
- Invalid recipe.

### Electricity

- Connected generator.
- Disconnected machine.
- Insufficient production.
- Network merging.
- Network splitting.

### Save system

- Save creation.
- Save loading.
- Missing optional data.
- Invalid save.
- Version migration.
- Large factory restoration.

## 23.3 Conservation rules

The game must respect resource conservation.

For every logical transfer:

- One source loses the item.
- One destination receives the item.

For production:

- Inputs are consumed according to the recipe.
- Outputs are created according to the recipe.

No item should be duplicated or silently destroyed.

Any deliberate item destruction must be an explicit gameplay operation.

---


---

# APPENDIX A — PHASE 0 IMPLEMENTATION MAP

**Added:** 2026-11-11, when Phase 0 was completed.
**Status:** descriptive. Sections §20–23 remain the authoritative requirements;
this appendix records how the foundation was actually implemented.

## A.1 Module map

| Reference module | Phase 0 status | Actual file |
|---|---|---|
| `main.ts` | Implemented | `src/main.ts` |
| `core/Game.ts` | Implemented | `src/core/Game.ts` |
| `core/GameLoop.ts` | Implemented | `src/core/GameLoop.ts` |
| `core/GameClock.ts` | Implemented | `src/core/GameClock.ts` |
| `core/EventBus.ts` | Implemented | `src/core/EventBus.ts` |
| `core/GameState.ts` | Implemented (lifecycle state machine) | `src/core/GameState.ts` |
| `core/Configuration.ts` | Implemented | `src/core/Configuration.ts` |
| `engine/Renderer.ts` | Implemented | `src/engine/Renderer.ts` |
| `engine/SceneManager.ts` | Implemented | `src/engine/SceneManager.ts` |
| `engine/CameraManager.ts` | Implemented | `src/engine/CameraManager.ts` |
| `engine/LightingManager.ts` | Implemented | `src/engine/LightingManager.ts` |
| `engine/AssetManager.ts` | Not needed yet (no external assets) | — |
| `ui/UIManager.ts`, HUD and gameplay UI | Phase 2+ (only the Phase 0 shell exists) | `src/ui/StatusOverlay.ts` |
| `utils/*` | Only disposal utilities so far | `src/utils/DisposalUtils.ts` |
| player, world, entities, items, buildings, logistics, production, fluids, power, progression, save | Not started (Phases 1–12) | — |

Empty placeholder folders are deliberately avoided: modules are added when their
phase begins, so the repository never advertises unimplemented systems.

## A.2 Contract boundaries

```text
src/main.ts  (DOM only)
    │ creates config + Engine.create(canvas)
    ▼
core/Game  ──depends on──▶  engine/types.ts : GameEngine
    │                              ▲
    │ GameLoop + GameClock         │ implements
    ▼                              │
engine/Engine ───────────────▶ Renderer, SceneManager, CameraManager, LightingManager
                                   │
                                   ▼
                              Three.js (WebGL2)
```

- Gameplay code depends only on `GameEngine`. It never imports Three.js, which
  keeps the simulation testable and allows a future rendering backend change.
- `GameEngine` is backed by `RenderBackend` in `Renderer.ts`; the engine
  composition root can be tested with a fake backend and no WebGL context.
- `GameLoop` accepts a `FrameScheduler`, so loop timing is tested with a
  deterministic scheduler instead of `requestAnimationFrame`.

## A.3 Simulation timing policy

- Fixed simulation step: **50 ms** (20 Hz), configurable in `Configuration.ts`.
- Frame delta clamp: **250 ms** (`maxFrameDeltaMs`), preventing a background tab
  from contributing unlimited time.
- Maximum catch-up: **10 steps** per rendered frame (`maxCatchUpSteps`).
- If the catch-up budget is exhausted, the remaining backlog is **discarded** and
  reported through `GameClock.droppedTimeMs`. This avoids the spiral of death and
  keeps `alpha` inside `[0, 1)`.
- `GameLoop` treats the first frame after `start()` as the time origin: it renders
  but does not simulate, so startup never produces a burst of steps.
- Errors thrown by a simulation system or by rendering stop the loop immediately,
  transition the game to `stopped`, emit `game:error` and reach the UI through an
  injected `onError` handler. A broken frame is never silently ignored.

## A.4 Lifecycle and error handling

Explicit states: `created → initialized → running ⇄ paused → stopped → disposed`.
`GameState` owns the generic transition table; `Game` additionally enforces
per-action preconditions (`start` only from `initialized`, `pause` only from
`running`, `resume` only from `paused`, `stop` from initialized/running/paused).
Violations raise `GameLifecycleError`; direct misuse of the state machine raises
`GameStateError`.

Initialization failures leave the game in `created` so a retry is possible.
Disposal is idempotent, stops the loop, clears subscriptions and systems, and
disposes GPU resources.

## A.5 Rendering ownership and disposal

- `Renderer` wraps `WebGLRenderer` with sRGB output, ACES tone mapping, PCF soft
  shadows, and a device-pixel-ratio cap (2 by default).
- `SceneManager` owns the Phase 0 foundation scene: ground, survey grid, origin
  pad, beacon and 48 boundary markers rendered through `InstancedMesh`.
- `LightingManager` owns hemisphere, ambient and directional key lighting; shadows
  are configured centrally and are optional.
- `disposeObjectTree` disposes unique geometries/materials and detaches children,
  covering the "no obvious memory leaks" requirement for scene teardown.
- `Engine.render(alpha)` already accepts the interpolation factor; Phase 1 view
  interpolation can use it without changing the `Game` contract.

## A.6 Configuration and base paths

`src/core/Configuration.ts` is shared by the browser app and `vite.config.ts`.
It validates ranges, freezes the configuration, and resolves the base path:

- production default: `/factory-frontier/` (GitHub Pages project site),
- development default: `/`,
- explicit override: `VITE_BASE_PATH` (normalized to a leading/trailing slash).

`vite.config.ts` computes the base path from the same function; the runtime
validates `import.meta.env.BASE_URL` through `createGameConfig`. Development and
preview servers bind to `0.0.0.0` with `allowedHosts: true` so proxied preview
hosts work.

## A.7 Runtime UI boundary

`src/ui/StatusOverlay.ts` is the only UI in Phase 0: boot status, fatal startup
errors and optional debug statistics. It never mutates simulation state and is
bound through `data-ui` attributes, which keeps UI tests independent from layout.
The gameplay HUD, build menu and machine interfaces belong to later phases.

## A.8 Testing seams

- `Game` accepts an injected `GameEngine`, `GameClock`, `FrameScheduler` and
  `EventBus`; the renderer can be replaced by a fake backend in engine tests.
- `main.ts` is covered by a jsdom integration test that loads the real
  `index.html` and mocks only `Engine.create`, verifying boot, resize, fatal-error
  reporting and page-unload disposal.
- `StatusOverlay` is tested against a jsdom fixture; Three.js scene construction is
  tested in Node without a WebGL context.

## A.9 Deliberate non-implementations in Phase 0

No terrain, biomes, chunks, first-person controls, gravity, collision, raycasting,
inventory, resource deposits, buildings, conveyors, machines, fluids, power,
progression, save system or audio. The foundation scene is a render fixture and
is not presented as gameplay. No gameplay systems are registered in `Game`; the
registration seam exists for Phase 1.

## A.10 Deviations from the reference structure

- The reference tree is a target, not a scaffold: folders for future phases are
  not created empty.
- `engine/types.ts` is an addition. It defines `GameEngine`/`RenderBackend` so the
  orchestration layer is testable and independent from Three.js.
- `index.html` lives at the repository root because Vite requires the entry
  document there. The former empty `src/index.html` was removed.
- Documentation is split into `docs/` as mandated by `ARENA_RULES.md`; the README
  now serves as the entry point.

## A.11 Phase 1 extension points

- Add player/world modules under `src/player` and `src/world`; terrain and chunk
  streaming become `SimulationSystem`s registered through `Game.registerSystem`.
- Add input handling in `main.ts` (DOM listener wiring) and keep movement logic in
  a testable controller driven by fixed updates or per-frame input sampling.
- Extend `SceneManager` with chunk groups and use `Engine.render(alpha)` for view
  interpolation. Do not put gameplay state in Three.js objects.

---

# APPENDIX B — FOUNDATION CAMERA, INPUT AND PERSISTENCE BASELINE

**Added:** 2026-11-11, with the first-person foundation increment.
**Status:** descriptive. §20–23 remain authoritative; this appendix records the
decisions made while adding a controllable camera and documents designs that are
deliberately **not implemented yet**.

## B.1 Two update stages

The game now distinguishes two execution stages:

| Stage | Driver | Frequency | Content |
|---|---|---|---|
| `SimulationSystem.fixedUpdate` | `GameClock` | fixed 50 ms (20 Hz) | industrial simulation: extraction, production, logistics, power (future phases) |
| `FrameSystem.update` | render loop | display refresh rate | presentation/input: camera pose applied before rendering |

Rules:

- Frame systems run once per rendered frame, after fixed simulation steps and
  immediately before `engine.render(alpha)`.
- Frame systems must not mutate state owned by the deterministic simulation.
- A frame system error is fail-fast: the loop stops, the game transitions to
  `stopped`, `game:error` is emitted and the fatal UI is shown.
- The first frame after `start()` runs frame systems with a 0 ms delta so the
  view is correct before the first render.
- System ids are unique across both stages; registration throws on duplicates.

**Rationale:** mouse look must be smooth at display rate, while industrial
production must remain deterministic and frame-rate independent. Mixing the two
would either stutter the view at 20 Hz or make production depend on FPS.

**Trade-off:** camera translation is currently presentation-stage movement with a
frame delta clamped to 250 ms. It is not physics. Phase 1 must move terrain
following, gravity and collision into a deterministic player simulation with
interpolation, replacing the flat-ground assumptions.

## B.2 Player/view boundary

- `src/player/PlayerController.ts` contains plain numbers only — no Three.js, no
  DOM. It owns position, yaw, pitch and horizontal velocity.
- It emits a `CameraView` (`position`, `yaw`, `pitch`) through `engine/types.ts`.
- `Engine.applyView(view)` forwards to `CameraManager.applyView`, which validates
  finite values and writes position plus a `YXZ` Euler rotation (no roll).
- `main.ts` wires a single `FrameSystem` that reads input, advances the player and
  applies the view before each render.

Foundation movement behaviour:

- WASD relative to yaw, accelerated/braked at 28 m/s².
- Shift sprint multiplier (1.8× default).
- Pitch clamped to ±1.45 rad; yaw normalized to (−π, π].
- Circular safety bound (120 m default) so the player cannot leave the foundation
  plane. This is **not** collision detection and will be replaced in Phase 1.

Not implemented: terrain height sampling, gravity, jumping, collision, slope
handling, interaction raycasting. All belong to Phase 1.

## B.3 Input layer

`src/input/InputManager.ts` is DOM-only and translates events into axes/deltas:

- WASD (`KeyboardEvent.code`) and Shift sprint.
- Pointer lock requested on primary click; **click-drag look** remains available
  as a fallback when pointer lock is unavailable or rejected.
- Pointer-lock state is the source of truth for the control hint.
- Held keys are cleared on window blur and when the document becomes hidden.
- Key events targeting inputs/textareas/selects/contenteditable are ignored, so a
  future settings UI will not move the player.
- `dispose()` removes every listener, clears state and releases pointer lock.

No gameplay logic lives in the input layer.

## B.4 Control configuration

`GameConfig.controls` is validated at startup and immutable:

| Field | Default | Validation |
|---|---:|---|
| `eyeHeight` | 1.7 m | 0.5–5 |
| `moveSpeed` | 5.5 m/s | 0.5–20 |
| `sprintMultiplier` | 1.8 | 1–5 |
| `acceleration` | 28 m/s² | 1–200 |
| `lookSensitivity` | 0.0022 rad/px | 0.0001–0.02 |
| `pitchLimit` | 1.45 rad | 0.1–1.5 |
| `playAreaRadius` | 120 m | 5–150 (inside the 320 m ground plane) |

These are presentation/control tuning values, not gameplay balance decisions.

## B.5 Persistence design baseline (Phase 12 — not implemented)

No save code exists yet. The design baseline to implement in Phase 12:

- **Storage:** IndexedDB database `factory-frontier`, object store `saves`, keyed
  by slot id (`autosave`, `manual-1`, …). No localStorage for game state.
- **Envelope:** versioned, JSON-serializable, contains only logical state:

  ```json
  {
    "saveVersion": 1,
    "createdAt": "ISO-8601",
    "updatedAt": "ISO-8601",
    "meta": { "seed": 123456, "playTimeMs": 0, "gameVersion": "0.2.0" },
    "world": { "seed": 123456, "modifications": [] },
    "player": { "position": [0, 1.7, 18], "yaw": 0, "pitch": 0, "inventory": [] },
    "buildings": [],
    "logistics": [],
    "powerNetworks": [],
    "progression": {}
  }
  ```

- **Versioning:** integer `saveVersion`; a chain of explicit migration functions;
  unknown/future versions are rejected with a user-visible error rather than
  guessed.
- **Validation:** schema validation before write and after read; reject invalid
  quantities, unknown item/building ids and dangling connections.
- **Atomicity:** write to a temporary record, validate, then commit the slot key;
  keep the previous successful save until the new one is complete.
- **Exclusions:** never serialize Three.js objects, meshes, materials, DOM nodes,
  rendered item instances or frame statistics.
- **Planned modules:** `save/SaveManager.ts`, `SaveSerializer.ts`,
  `SaveValidator.ts`, `SaveMigration.ts`, `IndexedDbStorage.ts` (Phase 12).

Until Phase 12 there is no autosave, no save slots and no persistence claims.

## B.6 Data-driven definitions baseline (historical; see Appendix D for Phase 2)

Machine, recipe, item and resource data will be immutable definitions loaded from
validated data modules, with registries owning lookup and referential integrity:

```ts
interface ItemDefinition { id: string; displayName: string; category: ItemCategory; stackSize: number; }
interface RecipeDefinition {
  id: string;
  machine: MachineId;
  durationMs: number;
  inputs: ReadonlyArray<{ item: ItemId; amount: number }>;
  outputs: ReadonlyArray<{ item: ItemId; amount: number }>;
}
interface MachineDefinition { id: string; category: MachineCategory; powerConsumptionKw: number; recipeIds: readonly string[]; }
```

Rules to enforce when implemented:

- ids are stable, unique and used in saves (never display names),
- amounts are positive integers unless a resource is explicitly fractional,
- registry validation runs once at boot and fails fast on dangling references,
- UI reads definitions; it does not hardcode machine behaviour.

No registries or sample gameplay definitions are created yet, because no gameplay
phase has started and empty registries would be placeholder systems.

## B.7 Deployment constraint

The build is verified under `/factory-frontier/` and served correctly by the
preview server. GitHub Pages is configured with **Source: GitHub Actions** and the
`Deploy GitHub Pages` workflow publishes `dist/`; a deployment is only considered
successful once the published HTML references `/factory-frontier/assets/*`. See
`PROJECT_STATUS.md` for the current deployment evidence.

---

# APPENDIX C — PHASE 1 TERRAIN, PHYSICS AND INTERACTION

**Added:** 2026-11-11, with Phase 1 (playable 3D environment).
**Status:** descriptive. §20–23 remain authoritative; this appendix records the
decisions made while adding terrain, player physics, collision and the first
interaction system, and the boundaries that later phases must respect.

## C.1 Module map (additions)

| Module | Layer | Responsibility |
|---|---|---|
| `src/world/noise.ts` | gameplay data | seeded value noise + fractal summation (no dependencies) |
| `src/world/rng.ts` | gameplay data | deterministic mulberry32 generator for world layout |
| `src/world/terrain/TerrainHeightfield.ts` | gameplay data | authoritative terrain surface: heights, normals, slopes, bounds, render data |
| `src/world/ObstacleField.ts` | gameplay data | solid obstacle definitions + spatial-hash circle collision |
| `src/world/World.ts` | gameplay data | world assembly (terrain, obstacles, interactables, spawn) |
| `src/player/PlayerController.ts` | simulation | first-person physics: gravity, jump, ground following, slopes, collision |
| `src/interaction/Interactable.ts` | contract | reusable interactable interface |
| `src/interaction/raycast.ts` | pure maths | ray/sphere intersection and forward-vector construction |
| `src/interaction/InteractionSystem.ts` | simulation | target selection, edge-triggered execution |
| `src/interaction/WorldInteractables.ts` | gameplay data | Phase 1 environment interactables (survey beacon, relay mast) |
| `src/engine/EnvironmentView.ts` | rendering | terrain mesh, sky, instanced rocks, props, highlight toggle |
| `src/ui/InteractionPrompt.ts` | presentation | prompt + transient feedback rendering |

## C.2 Terrain is data, rendering is a consumer

- `TerrainHeightfield` owns a Float32 grid of heights sampled from seeded fractal
  noise. It imports nothing from Three.js.
- `heightAt()` interpolates over **exactly the triangle split** used by
  `getRenderData()` (`(a,c,b)` and `(b,c,d)` per cell), so the drawn surface and
  the collision surface cannot diverge. A test asserts every render-buffer vertex
  agrees with `heightAt` within 1e-4.
- Normals and slopes are derived analytically from the same triangles; the
  renderer computes separate smooth vertex normals only for shading.
- A deterministic, bounded relaxation pass (`limitSlopes`) reduces axis-neighbour
  height differences toward `GENERATED_MAX_SLOPE_TANGENT` (0.72 rise/run). It does
  not guarantee a maximum triangle slope or complete-world traversability.
- The world is a finite square with a raised boundary ridge. Heights are clamped
  (never extrapolated) outside the bounds; the player is additionally inset by
  its collision radius.

**Chunk extensibility:** the grid has an explicit origin and cell size. `TerrainQuery`
is a starting point for chunk-aware queries, but generation and relaxation do not
currently guarantee seamless borders between independently generated chunks.

## C.3 Player physics and collision

- **Physics runs only on the fixed clock.** `PlayerController.step()` is called
  from a `SimulationSystem` at 50 ms. Mouse look (`applyLook`) runs per rendered
  frame; gravity, jumping, ground following and collisions never see a frame
  delta.
- **Camera smoothing without touching simulation state.** `viewAt(alpha)` linearly
  interpolates the last two fixed-step positions; `GameClock.alpha` supplies the
  factor. The authoritative position is never rewritten for rendering.
- **Gravity/jump model:** semi-implicit Euler (`v -= g·dt` then `y += v·dt`),
  edge-triggered jump (`jump` must rise while grounded; holding never repeats),
  landing snaps to the surface and clears vertical velocity.
- **Ground following:** when grounded and descending, the player snaps down within
  `groundSnapDistance`; a drop larger than that becomes a real fall. The player can
  never end a step below the surface height.
- **Slope rules:** a movement segment that climbs faster than
  `tan(maxWalkableSlope)` is rejected (position and velocity rollback). On ground
  steeper than the limit with no input, reduced drag allows downhill sliding.
- **Collision shapes and response:** obstacles are vertical cylinders and the
  player is a horizontal circle with a vertical span. A spatial-hash query covers
  the swept path. The earliest circle/cylinder hit yields an outward unit normal;
  remaining displacement is projected tangentially and swept again. Multiple
  contacts are resolved iteratively. Velocity is separately projected away from
  contact normals; positional correction is never divided by timestep or applied as
  momentum. No global velocity cap is used.
- **Initial overlaps:** iterative depenetration precedes movement. A small
  world-space contact tolerance avoids treating floating-point residuals as a
  cluster. The fallback radial search picks the nearest free sampled candidate.
  In pathological clusters it can still leave overlap or require a noticeable
  correction; unresolved motion and exhausted contact iterations conservatively
  stop instead of crossing obstacles. Vertical overlap is tested at the start of
  the step rather than continuously swept in 3D.
- **Broad phase:** a uniform spatial hash (8 m cells) limits tests to cylinders
  intersecting the horizontal swept bounding region.

## C.4 Interaction system

- `InteractionSystem` is a `SimulationSystem`: it re-casts the camera ray once per
  fixed step, so targeting is deterministic and independent of frame rate.
- Interactables are registered objects implementing `Interactable`
  (`descriptor`, `isAvailable`, `interact`). Only registered objects can be
  targeted — decorative meshes are ignored by construction, not by filtering.
- Selection: nearest ray/sphere hit whose distance is within
  `min(globalRange, descriptor.range)`. Unavailable objects are skipped.
- Execution is edge-triggered: `requestInteraction()` sets a flag that the next
  fixed update consumes exactly once. Holding the key repeats nothing.
- The system owns no DOM and no Three.js. Presentation polls `target` (prompt and
  highlight) and `outcomeSequence` (transient feedback).

## C.5 Rendering decisions

- Terrain is one merged mesh with vertex colours derived from height and slope (no
  textures, one draw call).
- Rocks and formations share three instanced meshes; instances are placed from the
  same `ObstacleDefinition` list physics uses.
- Sky is a vertex-coloured inverted sphere; fog is matched to the horizon band.
- The shadow-casting key light follows the player so the fixed 120 m shadow camera
  stays useful across the whole map; no shadow map is re-created.
- Highlight is a torus ring + emissive boost toggled by id; only a change costs
  anything per frame.

## C.6 Boundaries preserved

- Gameplay code still has no Three.js imports; `Engine.setHighlight` and
  `CameraView` remain the only rendering contacts.
- No inventory, resource, building, machine, power or save code was added
  (Phases 2–12). World data carries the extension points those phases need:
  `TerrainQuery` for deposits/placement, `ObstacleField` for solids, `Interactable`
  for machines/terminals.
- `VITE_BASE_PATH` and the Pages deployment structure are unchanged.

## C.7 Known technical debt

- Terrain is a single heightfield; no LOD, no chunk streaming, no collision mesh for
  overhangs/caves (heightfields cannot represent them).
- Interaction uses spheres only; irregular props need per-shape bounds in a later
  phase.
- Rock collision is an inscribed cylinder approximation of the visual mesh; the
  visual silhouette can extend slightly past the collider.
- No soft-body/rigid-body physics; the player is the only simulated body.


---

# APPENDIX D — PHASE 2 RESOURCE AND INVENTORY SYSTEMS

`ItemRegistry` is the authoritative source of item IDs, presentation metadata
and stack limits. `Inventory` stores only item IDs and quantities; its operations
validate input before mutation and report actual moved quantities, including
partial adds/removals/transfers. UI reads snapshots and revisions; no Three.js
objects or DOM nodes enter inventory state. Transfer between distinct inventories
preserves items; slot moving/merging and half-stack splitting use the same model.

`generateDeposits` creates seeded clusters from terrain and obstacle data, with
independent IDs, resource type, position, purity and future extraction metadata.
Placement rejects spawn/solid/deposit overlaps and steep samples. Attempts are
bounded, so constrained configurations can place fewer than requested; reachable
paths are not guaranteed. Purity multipliers are configurable and affect automated extraction. Deposits are infinite and not persistent in this phase.

`DepositInteractable` adapts a logical deposit to the existing `Interactable`
contract for inspection; it no longer grants materials. The fixed-step interaction
system owns raycast, range checks and E-edge consumption. Starter-object feedback
uses the actual added quantity.
`EnvironmentView` derives geometry/materials/highlight from logical deposits and
shares geometry and per-type materials. Deposit colliders use the existing obstacle
field; no visual object owns gameplay state.

`InventoryUI` renders snapshots and invokes inventory operations. Native HTML
drag-and-drop records a slot and inventory revision, applies no mutation until a
valid drop, and cancels if state changed. Empty slots receive stacks, matching
stacks merge, and incompatible occupied slots use the inventory model's atomic
`swapSlots`. Clicks only inspect or deselect; split remains a separate action.

`InputManager` remains the sole gameplay input layer; it suspends and clears
input, remembers and releases prior pointer lock while inventory is open. Closing
requests recapture synchronously in the close gesture only when previously locked;
if denied, click-to-capture remains available. Browser security prevents scripts
from warping the OS cursor. The existing game loop remains unchanged.
No machines, recipes, building or persistence systems were introduced.

Automated tests exercise the registry, inventory conservation, seeded generation,
gathering and full/partial outcomes, drag/drop event handling, modal input, scene
construction and the real bootstrap with a mocked WebGL engine. The user reports
earlier Phase 2 browser acceptance passed overall, except full inventory; the new
Phase 2.1 full browser acceptance was not verified at that time. A later Phase 5
headless run exercised a native stack merge and construction-menu pointer-lock
release/restore, not all inventory scenarios. Native drag-and-drop currently has
no keyboard move alternative.


## Appendix E — Phase 3 construction integration

`World` owns a `BuildingSystem` and a data-driven Three-free `BuildingRegistry`.
`Inventory.exchange` plans multi-item changes in a copied slot array and commits
only if all removals/additions fit. The default foundation costs 10 stone and 5
wood; demolition refunds all of it or leaves the building intact. IDs are stable
for a session only. No persistence or machines are implemented.

`ConstructionController` casts a terrain query ray using the existing view vector,
snaps footprint edges to a configurable 1 m grid, and invokes the same model
validation for preview and placement. TerrainHeightfield support clips every
intersecting terrain triangle to the footprint; generic terrain implementations
fall back to finite samples. Natural solids/deposits, buildings, the player,
world bounds and material availability are checked. Placement/demolition requests
are consumed in the fixed-step stage. Construction confirmation is a primary
mouse press while captured; when unlocked, the input layer distinguishes a short
click from drag-look and requests pointer capture on right click. Modal suspension,
focus loss and capture changes cancel incomplete gestures. C no longer places.
Foundation mode passes a height offset to the same authoritative validator for
preview and commit. It aligns unoccupied partial edge contacts to the nearest
foundation on the grid, inheriting that neighbour's base height; overlapping
foundations also inherit the nearest neighbour's base. Otherwise the reference is
the terrain minimum for heightfields and the maximum column top for voxel terrain.
Page Up/Down changes the offset by 0.1 m and success resets it. The highest terrain
point may cover at most 75% of the foundation height. Terrain slope/variation
limits do not reject foundations above terrain or voxel foundation placement;
other building rules remain unchanged. A 2×2 slab may overlap coplanar foundations
only if at least one grid cell is not yet covered. Different-height foundation
overlap remains forbidden because support selection is not multi-floor aware.
Full costs and refunds apply per slab, including overlaps. Foundations use vertical
intervals for collisions with other buildings, natural obstacles and the player;
callers without player height retain conservative horizontal checks. Multiple
coplanar slabs are ignored as collisions when a logistics building has a whole
supporting slab; demolition remains conservative for overlapping logistics.
The renderer emits each shared cell only once, suppressing overlapping slab details;
it recomputes visibility on removal. For foundation mode the terrain ray is also
projected onto neighbouring elevated platform levels within reach, without passing
through nearer terrain. Logistics building aiming also projects onto actual
foundation surfaces within reach; deposit-based miner aiming remains terrain-based.

`BuildingCollision` composes existing natural sweeps with conservative expanded
rectangle sweeps. `BuildingTerrain` exposes foundation tops to the player; both
read the current registry, so removal has immediate logical effect. The rendering
engine's `BuildingView` mirrors snapshots and owns separate preview resources,
which are reused while active and disposed on removal. Menus reuse the existing
modal/pointer-lock input suspension. The construction menu generates and caches
static isometric SVG thumbnails from `BuildingView` meshes using Three.js's CPU
SVG renderer; geometry/materials are disposed immediately and no extra WebGL
context is created. Thumbnails are decorative; labels and costs remain text.
The current block models add batched decorative meshes via `BuildingDetails`;
preview tinting and disposal still operate on the direct mesh children. Conveyor
junctions omit the extra low chassis where it could obstruct an entry ramp. The
terminal shell is inset within its unchanged collision footprint; logical ports,
transport and machine state indicators remain authoritative.
Demolition targeting does not perform
terrain/prop line-of-sight occlusion. Real-browser verification remains pending.


## Appendix F — Phase 4 Miner Mk.1 integration

`BuildingSystem` owns the snapped placement and deposit binding; the same
validator supplies preview and commit. A compatible, registered item deposit's
centre must fall within the footprint, and only its own natural collider is
exempted. The committed building stores the session-stable deposit and item IDs.
The fixed-step `MachineManager` follows building lifecycles and blocks demolition
while machine output contains items; normal deletion refunds the cost atomically.
The bootstrap synchronizes machine interactables with the central interaction
registry and suppresses inspection on occupied deposits, so deposit targeting cannot
hide machine inspection. Rendering consumes logical state and never drives it.

`Miner` implements the reusable `Machine` interface and state vocabulary. The
configuration defaults are 30 items/minute and one output slot. Progress stores
fractional work, calculated as `rate × deposit.productionMultiplier × fixedMs`;
60,000 work units equal one item. Work is capped by available output capacity,
so no backlog is created while blocked. Inventory transfers reuse the validated
partial transfer API. Deposits are infinite; loss or incompatibility stops work
as MISSING_INPUT, and restoring it resumes. Modal panels suspend both player and
machines; an explicitly paused game does not simulate or catch up. Hidden-tab scheduling
follows the browser and the existing bounded catch-up policy.

The temporary Phase 4 policy requires **no electricity**: NO_POWER is reserved
for a future power model and is not produced by a pretend network. Inspection is
DOM-only; the procedural machine indicator reads authoritative state. Renderer
objects and the placement preview have separate lifecycles and are disposed.
At the end of Phase 4 there were no conveyors, machine recipes, power connections or persistence; see Appendix G for subsequent Phase 5 work.


## Appendix G — Phase 5 conveyor integration (in progress)

The prior Three-free prototype (`ConveyorPath`, `Ports`, `ConveyorNetwork`) remains
transport authority. Segments have directional coincident ports and grid-aligned
straight, quarter-circle right-curve or inclined paths. `ConveyorDefinitions`
provides common geometry/ports; `ConveyorPlacement` derives connection height and
rejects incompatible touching ports and cycles, including Miner output when the
Miner is placed after a belt. `BuildingSystem` validates preview
and placement identically, pays atomically, tracks topology revisions and composes
independent demolition guards. A foundation supporting logistics cannot be removed.
Terrain placement uses the existing slope and variation limits and sinks at most
0.12 m; connected elevated paths may stand up to 2 m above the ground to allow a
short incline and endpoint without introducing Phase 7 lifts or support structures.

`LogisticsManager` synchronizes buildings and topology on revision changes; it
adapts the real Miner inventory to a source and owns one-slot configurable terminal
inventories. Terminal retrieval transfers only what fits. Demolition refuses
occupied segments and nonempty inventories rather than deleting resources. An
route without a connected source freezes its items. A source-connected line
runs even without a receiver; its front item stops at the open end and causes
backpressure until a compatible receiver or extension is attached. Topology is
linear and acyclic. No save/load exists. The game fixed-step stage runs machines before
logistics and both pause during gameplay modals.

Defaults are 1 m/s, 60 items/minute, 0.5 m spacing, and game ticks of 50 ms.
Advancement is downstream first; one item cannot advance across multiple segments
in a tick. Large steps can therefore under-run nominal rate. DISCONNECTED means no
connected source, IDLE a source-connected empty route, RUNNING a source-connected
moving/occupied route, BLOCKED a front item held by an open end, downstream
capacity or spacing. INVALID and
ERROR are reserved union values, not assigned runtime states; placement validation
reports invalidity separately. No error-recovery model is implemented.

`BuildingView` renders independent belt surfaces, ports and state lamps;
`ConveyorItemsView` interpolates positions between fixed steps using instancing.
Neither owns simulation state. DOM inspection exposes direction, connections,
count, maximum throughput and status; terminal inventory can be collected.
Tests cover real systems, scene graph and mocked-renderer bootstrap, not a real
WebGL browser. Real-building chains have been tested at all four rotations and
for 300 simulated seconds under repeated blockage and recovery, not exhaustively.
A separate headless Chromium / SwiftShader WebGL 2 run exercised actual UI
gathering, the full chain, modal pause, partial retrieval, full-terminal
backpressure, terminal demolition refusal and recovery. It used synthetic input
and DevTools observation, and does not establish physical usability. Other
browser scenarios and user acceptance remain pending; Phase 5 is not complete.

### Phase 5 usability follow-up

`EnvironmentView` consumes the unchanged deposit data to draw per-resource
coloured static aura rings and broken terrain-sampled ground traces. These
meshes are presentation only: they have no influence on interaction volumes,
physics, generation or placement. Geometries and shared per-type materials
are disposed with the environment. The targeted interaction highlight remains
a separate, initially hidden ring. `ConstructionController` retains any selected
building and its rotation after placement; every confirmation still calls the
authoritative validator and atomic payment. Escape cancels the mode and pending
placement, allowing normal interaction and demolition. The renderer selects
`PCFShadowMap` directly, matching Three.js's former deprecated-mode fallback.

## Voxel transition — terrain integration

`VoxelTerrain` is a renderer-independent, immutable finite column model. Each
column samples a supplied deterministic surface at its centre, rounds to a block
level, and represents solids from a fixed bottom up to the exclusive top. It
exports occupancy and bounded exposed-face buffers, without internal faces; it
has no caves, editing, chunks or bottom mesh. Surface generation rejects meshes
over 500,000 faces before allocation. `World` now samples the prior seeded
heightfield into this model, normally at 1 m per block; if a large or complex
world exceeds the mesh budget, resolution is reduced until it fits. This may make
blocks larger than a jump. The renderer consumes the same data. `VoxelCollision`
composes conservative expanded-column swept wall collision with natural and
building collisions. `groundBelow` tests the player's circular footprint against
column tops and finds support below their prior feet height, so landing near a
ledge does not teleport the player through a wall. The default fixed-step jump
speed is 8.4 m/s. Voxel building support takes exact column extrema over the
footprint, and generated deposits are filtered against Miner support. The old
heightfield remains the procedural source, not the rendered/physical surface.
The initial resource loop and block-style current models were added subsequently;
browser and physical acceptance remain pending.

## Appendix — finite voxel-transition starter resources

`GatherableField` owns seeded tree, branch and loose-stone state separately from
Three.js. Bounded placement avoids existing obstacles, deposits, spawn and other
starter objects. Trees take three E presses for up to 20 wood; branches and stones
give up to 5 wood/stone. Full or partial inventory leaves the untransferred
remainder available; there is no respawn or persistence. `GatherableCollision`
rebuilds its obstacle hash after depletion; trees block movement while loose
objects do not. Building placement checks all live objects dynamically, so none
leaves a ghost collider or becomes buried in a building. `EnvironmentView`
synchronizes shared block meshes from logical availability before rendering.
Deposits are inspect-only until a Miner is placed; its cost is 10 stone and
10 wood, breaking the old circular iron requirement. Legacy `gatherQuantity`
configuration is retained but unused. Bounded generation does not guarantee a
bootstrap in every constrained custom world. No browser acceptance is inferred
from tests.

## Appendix — block-style current models

`EnvironmentView` shares cube geometries across each stepped deposit body and
detail, while preserving item-specific colours, auras, terrain-following marks
and target rings. Natural rocks remain instanced (up to three box variants);
beacon and relay use box primitives. Existing obstacle physics remains cylindrical,
so collisions are approximate rather than per-voxel. The sky and circular
interaction/deposit indicators are deliberately unchanged.

`BuildingView` renders the Miner with block drill and stepped head, foundation
tiles and a terminal lid/panel. Conveyors already use box surfaces: curves and
inclines keep their angled segments to follow the logical paths and ports.
Ore instances remain cubes. All placed state lamps and port colours are preserved;
preview parts use the same valid/invalid tint and do not write depth. The
renderers read authoritative gameplay state and do not alter placement, machines
or transport. Scene graph and port-coordinate tests do not establish visual
clarity or working WebGL; physical browser acceptance remains required.

## Appendix — open-ended source-connected conveyor routes

`ConveyorNetwork.refreshStates` builds routes from every output-free terminal
segment, whether it has a receiver or not, and activates a route only if its
upstream end has a source. Open ends hold items at the last path endpoint and
propagate spacing backpressure. No resource is removed at an open end. Adding a
compatible receiver reconnects on building revision, keeps existing item IDs,
and resumes delivery. `LogisticsUI` distinguishes a missing source from an open
output. This does not relax exact position/direction/height checks.

The later automatic conveyor follow-up supersedes the former separate menu choices;
see the topology section below.

### Automatic conveyor topology (Phase 5 follow-up)

`AutoConveyor` resolves contiguous automatic tiles and Miner/terminal ports into
a linear, acyclic graph. A source determines flow, or a receiver if no source is
present; otherwise an end tile's initial rotation provides a starting direction.
Straight paths, left/right quarter turns, and rising or falling transitions share
`ConveyorPath` for preview, rendering, port matching and simulation. Adjacent
support height differences are limited to one cell; branching, loops, incompatible connected
heights and mixing legacy conveyor tiles with automatic neighbours are rejected.
Legacy types remain registered for compatibility, but are hidden from the menu.

Building placement and demolition resolve and validate the complete proposed
layout before payment/refund. An isolated tile preserves its selected inlet when
a new tile appears to the side, so its shape becomes a turn. A pure network
projection maps each item's inlet-relative distance to the proposed path; if a
shorter path ends first, overflow moves to its successor. The guard checks every
segment and join for available space before payment; invalid or ambiguous
projections are refused. Applying a valid projection preserves item IDs, order,
and throughput clocks. Render interpolation resets on moved paths, so items can
visibly snap at the moment a live path is changed rather than interpolating
through unrelated world geometry. Branches and cycles remain unsupported.

The world palette, sky and fog now use a brighter daytime scheme, with brighter
hemisphere and ambient fill. Conveyor surfaces have path-following coloured rails,
treads and supports, using the same logical path for turns and inclines. These
presentation changes do not change physics. WebGL and physical player acceptance
remain pending.

### Preview of neighbour changes

Construction validation returns the proposed candidate plus any existing automatic
conveyor shapes changed by the same topology plan. A valid preview temporarily
replaces their displayed models with tinted ghost models; cyan and yellow markers
identify inlet and outlet. No simulation or inventory changes occur from preview,
and invalid previews never display proposed neighbour changes. Active items remain
on their actual paths until placement, which can make their current positions differ
from the ghost path. Confirmation uses the validated candidate ID and commits the
same proposed shapes without a second topology solve. A partially touching belt is
aligned to a neighbour only when the snapped footprint does not overlap a building
and exactly one alignment is available; ambiguous contacts retain the grid position.
The alignment still goes through normal terrain, collision, cost and topology guards.

### One-cell directional conveyors (supersedes the menu design above)

The construction menu exposes `conveyor-cell`, a 1×1 grid footprint. The controller
quantizes camera yaw to four directions (R adds an offset), shared by preview and
placement. Its straight path stays within the cell. Output targets the immediately
adjacent cell regardless of the destination's heading: straight entry is at the
inlet, side and opposite entry are at the centre. Existing legacy 2-cell paths
remain separate and cannot connect to cells. Machine ports cover either one-cell
lane across their 2-cell edge; a Miner uses one lane at its output, while a
terminal accepts both lanes on any of its four sides when the belt points inward
at matching height. New connected cells anchor to an existing terminal and vice versa. Non-accepting buildings at an output block instead of deleting items.

The fixed tick moves cell contents first, then processes outputs in rotating order
with capacity checks, so fan-in and cycles do not move items twice or duplicate
them; full receivers apply backpressure. Old linear routes retain their prior
simulation. A drop callback sends open-end resources into `GroundItems`, which
owns item IDs, position and gravity separately from Three.js. Dropped items use the
shared instanced mesh and interaction pickup; full inventory preserves the item.

The cell planner calculates an ascending surface on the lower upstream tile and,
where needed, an entry ramp within the downstream footprint. Aligned level/uphill
cells join at the downstream inlet; other entries traverse from the shared edge to
the destination centre, at belt speed along the rendered entry surface. Terrain
heights and planned deck rise are limited to one cell; unsafe placements are
rejected. Neighbour changes appear in the preview. Changes to an occupied deck
project items by their fractional path distance only if spacing remains safe; an
entry cannot be removed while an item is crossing it. Renderer and simulation use
the same plan and item transition positions. Cell collision for the player remains
box-based rather than a precise ramp collider.

Ground items are session-only, unstacked and unbounded. Physical browser
validation and user acceptance remain outstanding.

### Phase 5 interaction and turn presentation update

Lateral cell entries produce curved guide markings and open the appropriate side
rail; the same topology drives placed and preview meshes, including entry ramps.
The terminal has cyan markings on each accepting side. Conveyor bodies are no
longer E interactables. Moving items register dynamic targets using their stable
transport IDs and authoritative transition position; pickup transfers one item
atomically to inventory or leaves it on the belt if full. The shared target is
unregistered when an item is received or dropped; dropped-item interactions then
take over. Starter generation has additional tree and stone candidates with the
same seeded collision, spawn, and deposit exclusions and bounded retries.

### Terminal slots and building-contact recovery

`InventorySlot` provides shared DOM slot creation for the player inventory and
terminal. The terminal iterates the authoritative inventory snapshot, rebuilding
only on revision or selection changes, and displays empty and occupied slots at
any configured capacity. Slot selection is inspection only; Retrieve contents
continues to transfer all items that fit, retaining any remainder. Production
terminals still have one slot, with no upgrade mechanism yet.

Placement rejects the player's conservative square-expanded building footprint.
`BuildingCollision` also handles an unexpected initial overlap (including tiny
round-off overlaps) by projecting attempted motion against the nearest exit face,
without positional correction: outward and tangential motion remain possible,
while inward movement is constrained. Other buildings and natural obstacles are
still swept; conservative square corners remain an approximation, not an exact
capsule-box shape. Real player validation of the reported case remains pending.

### Dropped-item recovery and paired inventories

At each unpaused positive logistics tick, covered ground items near a terminal's
level are transferred into its authoritative inventory only when accepted. A cell
conveyor admits one covered item at the centre when spacing allows, preserving
its ID. While drops remain, that cell reserves incoming capacity for them before
upstream belts or source transfers. Unaccepted drops are lifted visibly above the
building and retried, remaining available to the player; unrelated height layers
are not collected. Half-open footprints assign boundary points deterministically.
This applies to the one-cell player-facing conveyor, not legacy internal paths.

The paired terminal view reuses slot elements for both the receiver snapshot and
the player's inventory, each rebuilt on revision changes. Selection is inspection
only; the existing Retrieve contents action is the only terminal-to-player
transfer and respects capacity. The layout is responsive, with simple colored
voxel icons and accessible item labels. It does not offer drag-and-drop transfer.

### Shared inventory artwork

`ItemIcons` maps the six built-in item IDs to local voxel SVG assets, independently
from simulation data. `InventorySlot` renders those images for both inventories,
with a registry-provided text fallback for other IDs, an accessible button name
and a separate visible quantity. Empty slots have accessible names but no visible
placeholder. The CSS grid displays the actual snapshot only; it does not create
additional storage or modify slot selection, dragging or terminal transfer.

### Textured natural environment

The presentation layer creates deterministic, locally generated pixel textures
with Three.js `DataTexture`; it needs neither DOM canvas nor external requests.
A single atlas supplies terrain top grass, upper grassy walls and deeper dirt.
The terrain UVs are assigned per exposed quad from the owning voxel column; the
positions, normals, index buffer and collision data remain authoritative.
Decorative rocks share three faceted, instanced meshes with stone textures.
Starter resources use shared bark, foliage and stone textures and grouped parts;
visibility, targeting, collision and collection continue to use gatherable state.
Generated textures are explicitly disposed with the view. Decorative rock
colliders remain approximate cylinders, not precise faceted meshes.

### Aligned downhill cell decks

`resolveCellConveyors` uses an inlet offset and negative rise to put an aligned
straight descent on the full lower cell when it has only one incoming cell, no
Miner input and no need to climb toward its output. `ConveyorPath`, preview and
placed mesh consume the same offset and rise; the two decks meet at the shared
edge. Ground-drop coverage includes the raised inlet. Ambiguous multi-input
junctions, turns and cells also climbing retain centre-entry transitions and
their existing topology guards. Physics, capacity and grid occupancy do not
change.

### Look input and voxel contact stability

`InputManager` filters isolated pointer-lock events exceeding 300 pixels, preserving
normal accumulated motion and drag fallback, and discards queued look on blur, tab hiding and
pointer-lock changes. This bounded per-event heuristic can also reject a genuine
very large single mouse event. Physical-device verification remains necessary.

`VoxelCollision` sweeps the player circle against column side faces and rounded
corners, matching the circular support query instead of treating square expanded
corners as solid. Initial overlaps project away inward motion without a positional
push; natural/building collision composition and wall height filtering remain.
The terrain contract advertises vertical voxel walls so `PlayerController` does
not reject escape before the wall solver when already overlapping a column.

## Implementation note — Phase 6 smelter slice (2026-11-11)

`production/Recipes.ts` owns validated immutable recipe data, while
`machines/Smelter.ts` simulates one fixed iron recipe on the fixed clock with
separate bounded ore, coal-fuel and output inventories. `MachineManager` owns the
smelter lifecycle and protects nonempty buffers from demolition. `LogisticsManager`
connects filtered receiver and conditional source ports to the existing directed
one-cell network; UI and rendering consume this state without driving simulation.
The smelter supports manual input and recovery, pausing, and backpressure. A
user-requested direct-fuel exception consumes 1 coal per completed recipe cycle;
`NO_POWER` indicates missing coal when the other conditions are satisfied.
Fuel and ore are committed only on completion, and partial progress is retained
across interruptions. The receiver routes ore and coal into independent bounded
buffers, and demolition protects each buffer. This does not implement electrical
power networks (Phase 8) or recipe selection. The later constructor/plate slice
is documented below. Legacy
two-cell automatic conveyors do not route through the smelter; the currently
selectable one-cell conveyor is supported.

## Implementation note — creative construction

`BuildingSystem` owns a session-only creative flag. The construction menu updates
the flag and derives affordability from it; the authoritative placement validator
and commit both enforce the same policy. Free-placement provenance is recorded
on each building, preserved through topology replans, and governs demolition
refunds independently of the current flag. All non-cost validation and demolition
guards remain in force. No inventory items, machine fuel, recipes, power network
or persistence are added by this mode.

## Implementation note — constructor and iron plates

`machines/Processor.ts` owns the shared fixed-recipe simulation, bounded
input/output inventories, progress and preflight logic. Smelter extends it with
the existing direct coal policy; `ConstructorMachine` uses the no-fuel base for
its fixed 1 ingot → 1 plate / 2 s recipe. `MachineManager` owns lifecycle and
demolition guards; `LogisticsManager` routes filtered input and conditional
output for both processors through the existing one-cell conveyor network.
The constructor has no electrical network requirement in this slice, and has
no recipe selector because only one recipe is available. Legacy automatic
two-cell conveyor topology remains unsupported for these processors.

## Implementation note — Phase 7 storage slice

The LogisticsManager owns an eight-slot inventory for each storage container,
using the same bounded InventoryReceiver and demolition protection as terminals.
A directional one-cell input receives items and a source emits the first occupied
slot through a directional one-cell output. Its inventory is shared by manual
transfers and conveyor transport; synchronous transfer methods and the fixed clock
retain conservation and backpressure. The inspection UI reuses logistics slots
and adds selected-stack deposit. No transport filtering, FIFO guarantee, ground
item collection or legacy two-cell conveyor support is provided.

## Implementation note — Phase 7 balanced splitter

`Splitter` owns a one-item buffer and a persistent round-robin cursor. It exposes
one input receiver and three output sources. `LogisticsManager` wires one-cell
belts at the four directional ports, protects buffered contents from demolition,
and offers manual retrieval through `LogisticsUI`. Placement and topology
planning reject multiple lanes at the same port and anchor adjacent belts at the
correct height. Rendered port colors mirror the logical ports.

`ConveyorNetwork` first identifies source belts with capacity and then asks a
shared `SourceArbiter` to choose one among the ready sources. This maintains
round-robin fairness, skips blocked/absent branches and transfers at most one
buffered item in the tick. Normal non-grouped sources retain their existing
behavior. A belt may fill before a downstream blockage makes it unavailable.
At that point only balanced routing was implemented; the later note below
describes overflow and priority. No legacy two-cell support or ground-drop intake;
splitter buffering is session-only.

## Implementation note — Phase 7 merger, modes and bounded lifts

`Merger` owns three bounded single-item input slots. A round-robin cursor advances
only when its output takes an item. Each input independently backpressures while
its slot is occupied; inspection can recover the contents and demolition protects
them. `LogisticsManager` wires the three oriented one-cell inputs and one output.
Splitter arbitration additionally supports strict selected-port priority and
overflow to the next ready output, configured through the inspection UI.

Initially four buildable lift definitions provided up/down, 1/2-cell vertical differences; the later adjustable-height note extends this.
`ConveyorPath` defines a continuous horizontal–vertical–horizontal path; the
existing cell simulation moves, spaces, renders and protects its real item
entities. The manager connects exactly one matching one-cell belt at either end;
an unconnected lift output holds items, never drops them. Placement uses port
height offsets to anchor neighbouring belts, while the existing terrain and
foundation support limits remain in effect. Height/direction are fixed after
placement. See the later notes for height adjustment, route editing and direct
compatible machine ports; legacy two-cell conveyor attachment is not provided. All state is session-only.


## Implementation note — Phase 7 route-planning foundation

`ConveyorRoute.expandRoute` snaps control points to the one-cell grid and expands
orthogonal legs in the requested axis order, rejecting repeated cells and paths
longer than 24 cells. `BuildingSystem.previewConveyorRoute` stages each cell in
an isolated copy using the ordinary authoritative placement rules, verifies the
starting connection (including first-lane port arbitration), identifies the end
state, and checks the final layout against live topology guards. `placeConveyorRoute` revalidates, pays the whole
cost atomically and publishes the resulting cells and updated belt shapes in one
revision. Creative builds keep their no-refund flag. The live world and inventory
are not modified by planning; guards may synchronize the logistics network.

At this earlier slice the planner was backend-only; the editor below now provides
in-game route selection, preview, confirmation and control-point input. The start
must be a compatible one-cell belt or supported output; the end can be open or
connected. Legacy two-cell belts are not supported endpoints. Incremental staging
can reject a layout that might be valid if all cells were validated simultaneously.
The limit bounds work and cost; see the editor note below for preview caching.


## Implementation note — Phase 7 in-game route editor

`ConveyorRouteEditor` owns the transient waypoints and bend order independently
of rendering and input. A source is selected on the first free cell adjoining a
compatible output; the hovered final cell may be open or connected to an input
or an existing cell. A non-accepting building directly ahead is reported blocked.
Click adds points, R flips the orthogonal axis order for every leg, Backspace
undoes, Enter revalidates and commits, T switches back to single placement, and
Esc/Q cancel. The first-cell rotation is chosen from compatible source directions;
subsequent directions follow the generated route. The regular construction ray
and reach apply, so the player may move between points. The existing one-cell
placement remains available and unchanged.

`BuildingView` reuses the normal first-cell preview and draws additional pooled
route meshes, releasing them on mode changes/disposal. Green shows a valid start
or valid full route, red a rejection; the status displays the reason, end state,
and total cost where the staged plan is available. Open ends warn that transported
items can fall to the ground; no change is made to existing drop semantics.
Failed staging shows approximate red terrain-height geometry rather than claiming
exact supported shapes. The editor
caches the advisory preview by snapped target, waypoints, world/inventory
revisions, player position and a 250 ms time bucket to account for moving items
and dynamic obstacles. Click and Enter do not rely on the cache: they revalidate
against the current authoritative world and live topology guards. Note that each
new hovered grid cell still causes a fresh bounded plan; test performance in
large factories before increasing the 24-cell limit.

The user globally validated the previous playable logistics features before this
editor existed. The editor itself has automated coverage but awaits real player
validation; heights outside the later bounded lift range, legacy two-cell endpoints
and persistence remain out of scope.


## Implementation note — open-ended conveyor routes

At the user's request, a destination is no longer required to confirm a route.
The planner still verifies the existing start, individual placements, payment
and live topology guards, and reports `endConnection` as connected, open or
blocked. The blockage check follows the logistics manager's non-accepting
building-ahead rule; an open end remains a functional belt that can drop items.
Another route can start in the next free cell using the previously built belt as
its existing source, preserving the 24-cell limit per transaction. Inputs may be
placed afterward. Tests cover two consecutive 24-cell builds with in-flight
items, delayed terminal attachment, open-end drops, safety revalidation and the
actual application controls. Real-player retesting remains pending.


## Implementation note — adjustable lift height

`LiftDefinitions` validates the finite family of one- to eight-cell up/down
variants and shares the bound with the building registry. The Q menu retains
the existing 1 m and 2 m entries; Page Up/Down changes the selected variant in
placement mode, preserving direction and rotation, clamped at 1 and 8. The HUD
reports the size and the chosen variant persists for repeat placement. Preview,
collision dimensions, path and cost derive from that same registered type;
confirmation revalidates and placed lifts cannot be resized. Existing type IDs
and costs are unchanged. At that earlier lift-height step foundation validation and aiming were unchanged;
the later platform correction below extends height alignment.

For conveyor cells, construction aiming also considers the top of a nearby
elevated foundation when the ray intersects its actual footprint; a closer
terrain hit still wins. The same aim serves the route editor. Terrain bounds,
reach, collision and support validation are unchanged. Above the existing
unsupported-height allowance, a belt needs a suitable supporting foundation;
at that stage lift endpoints accepted only one-cell belts; the later direct-lift
note adds compatible machine ports but not legacy belts. Tests cover geometry, all heights and rotations, UI, high
supported paths, live backpressure, recovery and material conservation. No
player acceptance is claimed for the new height controls.


## Implementation note — raised platform and machine support

For interactive foundation previews and confirmation, the controller opts into
logistics alignment in the authoritative validator. If the 2×2 footprint does not
overlap a foundation, a neighbouring lift upper port or touching flat one-cell
belt can set the foundation top to that belt's base level. Ambiguous competing
levels are rejected, not silently guessed; ground-level anchors that would bury
the slab beyond the existing limit are ignored. The manual height offset is
applied relative to the chosen level, while coplanar overlapping foundations
retain their existing gap-fill rules. Direct `validate`/`place` callers do not
opt in unless requested, preserving existing explicit height semantics. Bounds,
terrain burial, collisions, costs and live topology guards remain authoritative.

Logistics buildings may target a foundation surface and use a footprint covered
entirely by multiple coplanar foundations. Terrain slope below a supported
building does not invalidate it; supported placements use vertical intervals for
player and obstacle checks. Other building collisions remain conservative and
demolition protects any slab overlapping a supported logistics footprint. Miners
still require their deposit and use their existing ground-based rules. Stacked
foundations at different heights remain unsupported; this is not multi-floor
support selection. Automated integration transports real items from storage via
a lift to a raised receiver straddling two slabs; in-game acceptance is pending.


## Implementation note — conveyor flow inspection

`ConveyorNetwork` records successful output handoffs and ground drops per segment
in bounded one-second simulation-time buckets and an accumulated session total.
`flowStats` reports up to 60 buckets (approximately 59–60 s at bucket edges);
startup history is partial, not extrapolated. Manual pickups and failed transfers
are excluded. Topology reconfiguration retains statistics; removing a segment
clears them. No per-frame rendering or wall clock drives the measurement.

G queues inspection using the existing construction ray target and opens
`LogisticsUI` only for an existing network segment, including lifts. Modal input
suppression and simulation pause remain in force; E and existing interactions
are unchanged. The displayed theoretical limit is the smaller of configured
throughput and `60 * speed / spacing`, an upper bound independent of supply,
blockages and fixed-step effects. Statistics are not persisted across sessions.


## Implementation note — storage output filter

`LogisticsManager` owns a validated optional item ID per storage building. Its
existing belt source peeks and removes only the selected item; null preserves the
original first-occupied-slot choice. If the selected item is unavailable, no
other item is automatically substituted. Changing the filter does not modify
inventories or recall in-flight items. Incoming ports, manual transfer, downstream
backpressure and demolition guards are unchanged. Configuration is independent
per storage, survives `sync` topology rebuilds, is removed on demolition, and is
not persisted between sessions. The existing E logistics panel selects from the
item registry; terminals and other devices do not expose the setting. This is an
output selector, not a splitter or an input/slot filter.


## Implementation note — direct lift connections

`DirectLiftConnections` matches exact world-space lift endpoints and oriented
machine ports. Miner, processor and storage outputs can feed the lift input;
processor, storage and terminal inputs can receive the lift output. The terminal
accepts any face. Heights, positions and directions must coincide. Existing
placement and support rules remain unchanged; matching does not snap heights.
`BuildingSystem` uses the same matcher for its advisory connected preview.

`LogisticsManager` attaches the existing source/receiver ports directly to lift
segments after wiring one-cell belts, preserving machine enabled state, item
acceptance, storage filters, transport clocks, flow counters and backpressure.
Unconnected lifts remain blocked rather than dropping items. No new ownership or
inventory transfer path is introduced. A later slice adds direct splitter/merger
ports; a subsequent slice adds direct lift-to-lift links, while legacy-belt links remain unsupported. Tests exercise both placement orders, all
rotations, high supported endpoints, live reconnection and conservation.


## Implementation note — direct lift/junction ports

`DirectLiftConnections` matches the lift input against each splitter output or
merger output and the lift output against the splitter input or each merger input.
It requires exact positions, directions and height, using the same matcher for
preview and runtime. Placement checks count both lifts and one-cell belts per
junction port so duplicate lanes cannot claim one port. No foundation or height
snapping rules changed.

`LogisticsManager` attaches the existing splitter source (including its arbiter)
or merger source/receiver to the lift segment. Thus direct lifts and belt branches
compete in the same ready-source arbitration, while merger input slots and cursor
remain independent and fair. Unconnected or blocked lifts retain items. Automated
coverage includes simultaneous direct ports, belt/lift mixtures, all rotations,
placement orders, high supported connections and blocked recovery. Direct
lift-to-lift links were added subsequently; legacy-belt links remain out of scope.


## Implementation note — direct lift-to-lift links

`directLiftLink` requires exact coincident output/input positions and directions.
The same geometry determines preview, port exclusivity and runtime topology.
Lifts retain their original terrain and foundation support, and no height is
automatically changed. Cell, lift and machine/junction links compete for each
lift port rather than silently choosing multiple inputs or outputs.

`ConveyorNetwork` treats matching lift endpoints as a continuous path: movement
is constrained by the downstream tail, retaining spacing across the join.
Topology projection and direct connection reject pre-existing unsafe item spacing.
The two-phase update, capacity, transfer clocks and per-segment flow counters are
unchanged. Tests cover every supported height, direction, rotation and placement
order, occupied links, backpressure, conservation and multi-lift operation.
Direct legacy-belt links remain unsupported. The player subsequently validated the direct lift-to-lift slice.


## Implementation note — fine lift-height control

`LiftDefinitions` accepts canonical lift IDs for every tenth from 1 to 8 cells;
the registry supplies matching geometry and unchanged costs. Integer IDs remain
unchanged. The controller stores heights as integer tenths when adjusting,
preventing floating-point drift: Page Up/Down changes ten steps, Shift plus the
same keys changes one, and both clamp to the existing bounds. Input passes the
keyboard modifier through to the controller. The Q menu still offers only the
existing 1 m and 2 m presets; preview and status show the selected value. Existing
lifts remain unchanged after placement.

Fractional lifts use existing path geometry, ports, support, collision,
foundation alignment, routing, backpressure and safety rules; foundation behavior
itself is unchanged. Tests exercise every canonical height, real keyboard wiring,
preview, rendering, costs, platform alignment and live connections to machines,
junctions, belts and other lifts. Heights beyond 1–8 m, sub-tenth increments and
editing placed lifts remain unsupported. Player acceptance of this slice is pending.


## Implementation note — filtered splitter routing

`Splitter` owns three optional per-output item IDs and an additional `filtered`
mode. For a buffered item, exact matching outputs are eligible; when no output
is assigned that item, only null (unmatched-item) outputs are eligible. An
assignment remains authoritative even if its port is absent or blocked, so
items never leak to unmatched routes. Multiple eligible ready outputs share the
existing persistent round-robin cursor, which advances only on successful take.
No eligible ready output leaves the single-item buffer intact, backpressuring
the input and potentially delaying later items. Previously sent items keep their
paths. Existing modes ignore but retain the filter configuration.

The E logistics panel lists registry items per port and clearly describes strict
matching and the unmatched fallback. Configuration is per splitter, retained
through topology rebuilds and mode switches, lost on demolition or session reload.
The same arbiter works for belt and direct-lift outputs without changing ports,
foundations, inventory or transport. Tests exercise invalid configuration,
fairness, late connections, blockage/recovery, live reconfiguration, mixed-item
conservation, real merger/splitter networks, rotations and actual UI markup.
Real-player acceptance remains pending; this does not complete Phase 7.


## Implementation note — selected stack transfers

`Inventory.transferStack` transfers only the source slot to another inventory,
merging into compatible destination stacks first and moving only what fits. Any
remainder stays in the same source slot; other stacks, including those holding
the same item, are untouched. It validates the slot and destination item before
source mutation, handles self/empty transfers, and updates revisions only when
items move. Existing type-based `transferItem` remains unchanged.

The logistics panel exposes selected-stack retrieval for storage and terminals
and retains bulk retrieval. Its existing storage deposit action now uses the
selected player slot rather than removing from earlier same-type stacks.
Selections are invalidated when the relevant inventory revision changes and
click handlers recheck revisions before transfer. Partial/full results report
the exact remainder. Splitter/merger buffers, automated output filters and
conveyor items remain on their existing paths; the modal pause is unchanged.
Tests cover exact and stale selections, capacity, both directions, conservation
and live conveyor recovery. In-game acceptance remains pending.


## Implementation note — quantity-limited selected stack transfers

`Inventory.transferStack` accepts an optional positive safe integer quantity,
validated against the selected source stack before mutation. Without it the
whole stack is requested. The result remainder describes the unfulfilled
requested quantity, while the source slot retains both unrequested items and
any amount that could not fit. Empty and self transfers do not mutate state;
revisions change only when items move.

The logistics panel provides separate optional numeric inputs for storage
deposit and storage/terminal selected retrieval. Blank means the whole stack;
invalid or excessive values are rejected without transfer. Selections and
quantities reset when their source inventory changes, and actions recheck the
source revision. Destination changes do not invalidate the source selection.
The notice reports the total still in the selected source stack. Bulk retrieval,
transport, filters, foundations and modal pause are unchanged. In-game player
validation remains pending.


## Verification note — combined production logistics

An integration test places two real miners, a merger, a fueled smelter, a
constructor and a balanced splitter with a belt and an elevated direct lift
branch, using the actual machine and logistics managers at 50 ms steps. It
seeds downstream buffers and full destinations to exercise backpressure, checks
modal pause, releases destinations in stages and counts all relevant resources
across inventories, belts, junctions and the player. It simulates deposit
unavailability after 60 items per miner to bound the input. It also verifies
that opening a different branch does not reroute items already committed to a
full belt. No game or architectural behavior changed. This is automated
evidence for one arrangement, not browser or player acceptance of Phase 7.


## Implementation note — Phase 7 integration audit

Cell-output obstruction is shared by route planning and live topology through
`blocksCellOutput`. It compares the output endpoint height with the candidate
building's vertical span, including conveyor ramp endpoints, instead of blocking
every object at the same horizontal coordinates. Foundations are still excluded
from the obstruction rule and their placement/support rules are unchanged.
Same-height non-accepting buildings still block and existing open-end drops are
unchanged. Tests exercise both placement orders and all rotations with a real
upper container, plus height comparisons and existing blockage regressions.

The route-preview cache uses exact player body coordinates and vertical bounds
near candidate cells, retaining coarse position caching farther away; confirmation
still revalidates independently. Escape is handled at the logistics modal level,
including selector and numeric-input focus. A consolidated French player checklist
is in `PHASE_7_VALIDATION_FR.md`. Automated evidence does not establish player
acceptance or remove the documented route, lift and legacy-connection limits.


## Implementation note — Phase 8 electrical topology foundation

`PowerGrid` is a pure, renderer-independent domain model, not yet registered in
the game. It owns a graph of explicit 3D-positioned poles, generators and
consumers. Wires must include a pole, fit a configurable 3D range and connect
distinct nodes; generators and consumers have at most one wire, preventing them
from bridging pole networks. Poles can form arbitrary graphs and cycles. Adding
or removing a node or edge updates connected components without persisting
network identities: a snapshot uses the least member ID for its current component.

Rates are non-negative safe integer watts; global aggregate bounds prevent
overflow. Snapshots are independent copies and contain sorted member IDs,
installed capacity, enabled capacity, enabled demand, supplied watts, shortfall
and status. Unconnected endpoints are `isolated`, a pole network without online
capacity is `offline`, excess demand is `overloaded`, otherwise it is `online`.
An overloaded network supplies zero to all consumers; a disabled consumer or
isolated endpoint is never powered. At the time of this topology slice, fuel use,
dispatch and machine simulation were not yet implemented; see the following note.
The current coal-smelter and Phase 7 gameplay retain their existing behavior.

Graph mutations are validated before changes and increase the revision only on
actual changes. Snapshots are rebuilt on query; future in-game integration should
batch/cache them as needed and update the network before machines in the fixed
timestep. Tests verify 3D range, merging, splitting, cycles, no phantom links,
capacity/demand changes, overload recovery, validation and deterministic graph
recomputation. Phase 7 was subsequently globally validated by the player; Phase 8 remains in progress.

## Implementation note — isolated biomass dispatch and machine power

`BiomassGenerator` owns one wood buffer and tracks partially consumed burn time.
One wood provides 30 seconds at a rated 30 kW. `PowerSimulation` combines it
with `PowerGrid` and registered consumer instances. It synchronizes availability
and enabled demand, sets machine power, and runs the consumers in segments cut
at fuel-exhaustion boundaries. Loaded online generators all burn at full rate;
no fuel is used in idle, isolated or overloaded networks. Enabled consumers
reserve their rating even when blocked or missing inputs. This provisional policy
is explicit, not proportional dispatch or energy storage.

Power loss preserves existing machine progress and buffers. Coal remains a direct
smelter recipe requirement in addition to electricity when electrically managed.
The adapter is not registered with `Game`: machines default to powered in the
current game. Building lifecycle, wiring controls/visuals, fuel interaction,
player-facing statistics and safe demolition must be integrated and tested before
Phase 8 can be accepted. The simulation adapter must replace, not duplicate,
`MachineManager` stepping when integrated.

## Implementation note — playable Phase 8 integration

`PowerManager` is the authoritative fixed-step adapter between buildings, the
existing `MachineManager` instances and `PowerSimulation`. It synchronizes
building lifecycle and rebuilds the topology on a building revision, retaining
generator inventories and partial burn time. In the app it replaces, rather
than duplicates, the machine simulation step and runs before logistics. Menus
pause both production and fuel consumption. Machine/UI and rendering layers read
the same network snapshots; no Three.js object owns game state.

The integration chooses automatic wiring: all poles with top anchors within
10 m in 3D connect, and each endpoint connects to its nearest pole (ties ordered
by ID). Adding a nearer pole can therefore reassign an endpoint; adding a pole
can merge networks. `PowerWireView` renders those links. Wires have no costs or
manual disconnect controls. Pole, generator and machine inspections show network
capacity, available and supplied power, demand, shortfall, status and counts.
Each miner, smelter and constructor reserves 10 kW while enabled; one fueled
biomass generator supplies 30 kW. Shortage sheds the whole network and all
available generators burn at full rate when a network is loaded and online.
Fuel may be transferred manually or through the rear conveyor input; stored wood prevents generator demolition;
already-burning fuel is lost on demolition of an otherwise empty generator.
Smelters still require coal separately. Persistence is outside this phase.
The player subsequently gave global Phase 8 validation without individual
scenario results: see `PHASE_8_VALIDATION_FR.md`.

## Implementation note — Phase 9 initial recipe slice

The constructor can switch between validated single-input plate and rod recipes
using its E panel. Switching requires both buffers empty; fractional work is
reset, explicitly disclosed to the player. The conveyor output resolves the
current recipe dynamically, without altering topology or touching items already
in transit. Recipe choices remain session-only.

`RecipeRegistry` validates and freezes optional additional distinct ingredients.
`Processor` reserves one input slot per ingredient, checks all requirements and
commits ingredient consumption atomically on completed cycles. Output space,
power loss and pauses preserve existing behavior. Plate + rod → reinforced
component is registered and tested with the generic processor, but no playable
assembler or multi-input delivery UI exists yet. A buildable assembler, foundry,
logistics integration and statistics remain Phase 9 work.

## Implementation note — conveyor-fed biomass fuel

`LogisticsManager` optionally receives the authoritative `PowerManager` and
synchronizes it before rebuilding connections. The generator exposes only a
rear receiver at belt height: one-cell lanes, aligned lift outputs and matching
legacy conveyor outputs share its existing one-stack fuel inventory. The
receiver accepts wood only and applies inventory backpressure. It never exposes
a source; direction, elevation, topology guards, pause and demolition protections
remain authoritative. The cyan rear marker and generator inspection describe
the inlet. The auto-conveyor route planner still only automatically routes to
its original miner/terminal endpoints; a compatible resolved belt can connect
to the generator without extending that planner. No foundation rules changed.

## Implementation note — initial Phase 9 production statistics

A `Processor` tracks the quantity of each output item committed by completed
cycles, independent of the current output inventory. The inspection panel shows
the current recipe's per-machine lifetime count; switching recipes preserves
previous counts. Pauses, blocked cycles and partial progress add nothing. Counts
are in-memory only, reset on demolition/session reset, and cover processors, not
miners or network-wide rates. Comprehensive throughput/bottleneck analytics
remain Phase 9 work.

## Implementation note — playable Phase 9 multi-input manufacturing

`AdvancedMachine` reuses `Processor`, with fixed two-ingredient Assembler and
Foundry recipes. `MachineManager` owns instances and demolition guards;
`PowerManager` supplies each at 10 kW. `LogisticsManager` resolves the current
recipe at transfer time and reserves at most one stack for each ingredient.
Both rear cell lanes, direct lift outputs and matching legacy belts share the
receiver. Wrong items and full buffers exert backpressure; a mixed lane may
block a needed ingredient behind an unwanted/excess item. Manual inspection
provides independent feed and recovery. A Constructor can switch between
single-input recipes with different item types only when both buffers are empty.

Machines accumulate simulated elapsed and actual working time, completed
production, and committed ingredient consumption (including Smelter coal).
Inspection reports lifetime-average rates and utilization; menu pauses do not
advance the denominator. `MachineManager.statistics` aggregates rates across
currently placed machines and counts key blocked states. This sums per-machine
lifetime averages, not a rolling window; demolition and session reset erase
statistics, and there is no dedicated dashboard or persistence. Power data is
still per network. See `PHASE_9_VALIDATION_FR.md`; no foundation placement logic
was changed.

## Implementation note — Phase 9 factory dashboard and rolling history

`ProductionHistory` samples the authoritative machine counters after power and
logistics on each fixed step. It stores only 60 one-second simulation buckets
of completed production, committed consumption and extracted items. Events are
assigned to the end of the sample step; expiry is quantized by second. Rates
scale by actual elapsed simulated time until the window fills. The bounded
window retains already-recorded events briefly after a machine is removed, but
cleans up per-machine baselines. Pauses do not advance or sample the history.
The history is session-only; no historical charts, persistence or inferred
root-cause/throughput analysis are claimed.

H opens `FactoryDashboard`, a modal read-only snapshot which pauses all factory
updates. It shows per-item rates, lifetime average utilization, a unique list of
electrical networks with supply, demand and shortfall, and actual missing-input,
coal, electricity, full-output and blocked-belt states with building coordinates.
Summing each network once avoids double-counting power; aggregate numbers do not
imply energy can flow between isolated networks. The H and Escape paths release
and restore input capture consistently with existing panels. No foundation logic
changed. The game UI and new phase 9 scenarios remain unvalidated by the player.
