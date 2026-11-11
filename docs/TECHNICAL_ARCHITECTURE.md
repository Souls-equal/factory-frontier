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
