# PROJECT STATUS

**Project:** Factory Frontier
**Version:** 0.3.0
**Current Phase:** Phase 1 — Playable 3D Environment
**Phase Status:** ✅ Complete (all Phase 1 acceptance criteria met; manual browser check pending)
**Next Recommended Task:** Phase 2 — Resources and inventory (requires authorization)
**Last Updated:** 2026-11-11

---

## Repository Inspection Findings (this task)

- Phase 0 + the camera foundation from `main` (`821a943`) were present and working:
  strict TypeScript/Vite/Three.js toolchain, `Game` lifecycle, fixed-timestep clock,
  frame-system stage, `PlayerController`, `InputManager`, UI shell, 250 tests,
  CI/Pages workflows.
- The flat foundation plane, `playAreaRadius` clamp and frame-delta movement were
  **explicitly documented as Phase 1 placeholders** in Appendix B.1/B.2 and were
  replaced by terrain-driven physics, not by a rewrite of the surrounding systems.
- Missing for Phase 1 and now implemented: terrain, gravity, jumping, ground
  detection, collision, slope handling, interaction raycasting, interactable
  contract, interaction UI, real environment.
- Still absent by design: inventory, resources, buildings, machines, power, saves
  (Phases 2–12). No placeholder modules were created for them.

---

## Phase 1 — Playable 3D Environment ✅

### Terrain

| Item | Result |
|---|---|
| Representation | Finite square heightfield, 240 m, 120×120 cells (14 641 vertices, 28 800 triangles), generated from seeded fractal value noise |
| Determinism | Same seed + config → identical heights, obstacle layout and spawn (tested) |
| Height queries | `heightAt()` interpolates over the same triangle split the render mesh uses; render/collision agreement tested to 1e-4 |
| Normals/slopes | Analytic per-triangle normals; unit-length and upward-facing (tested) |
| Boundaries | `contains()`, `clampXZ()`, inset by player radius; out-of-bounds queries clamp rather than extrapolate |
| Shape | Flattened outpost clearing, rolling hills, raised boundary ridge closing the horizon |
| Smoothness | Deterministic relaxation pass caps the generated gradient at 0.72 (≈36°) |
| Extension | `TerrainQuery` contract + explicit grid origin for future chunk streaming |

### Player physics

| Requirement | Implementation | Evidence |
|---|---|---|
| Gravity | Semi-implicit Euler on the 50 ms fixed clock | 20 physics tests |
| Ground detection | Surface height + snap distance; never below the surface | Integration test asserts `y ≥ ground` every step |
| Jumping | Edge-triggered, grounded-only, impulse 7.2 m/s, apex within the analytic range | Holding the key yields exactly one jump over 120 steps |
| Landing | Snaps to surface, clears vertical velocity, sets grounded | Falling from 12 m lands at y≈0 |
| Falling | Ledge drops beyond the snap distance become real falls | Covered by gravity tests |
| Collision — terrain | Heightfield resolution (no tunnelling) | Large-step test at 400 m |
| Collision — obstacles | Vertical-cylinder push-out in a spatial hash + escape search | Blocked by a rock; walks around it; never stuck |
| Slopes | Segment-slope climb rejection + frictionless downhill slide above the limit | Steep ramp: no climb, slides; gentle ramp: follows surface |
| Frame independence | Physics only sees the fixed delta; camera interpolates between steps | Same movement/apex within tolerance at 25 ms vs 50 ms steps |
| Three.js boundary | `PlayerController` imports no Three.js; consumes `TerrainQuery`/`CollisionQuery` | Type-level separation |

### Interaction

| Requirement | Implementation |
|---|---|
| Raycast | Camera-centre ray, analytic ray/sphere test in plain maths (no Three.js) |
| Target selection | Nearest valid hit within `min(globalRange, descriptor.range)`; unavailable objects skipped |
| Interactable contract | `descriptor` (id, display name, hint, anchor, radius, range), `isAvailable()`, `interact()` |
| Feedback | Highlight ring + name + contextual hint; hidden with no target; transient outcome message |
| Input | `E`, edge-triggered (queued once, auto-repeat ignored, typing targets ignored) |
| Decoupling | System exposes state; UI and renderer poll it. No DOM/Three in gameplay code |

### Environment and rendering

- Single merged terrain mesh with height/slope-driven vertex colours (no textures).
- Vertex-coloured sky dome, horizon-matched fog, key light + hemisphere + ambient.
- Shadow-casting key light follows the player; shadows stay crisp across the map.
- Instanced boulders/formations (3 shared geometries), props with highlight rings.
- All geometries/materials disposed on teardown; no per-frame allocations in the
  update path (the frame systems only read state and toggle a highlight).

---

## Verification (executed 2026-11-11)

| Check | Result |
|---|---|
| `npm run typecheck` | ✅ pass (strict, `noUncheckedIndexedAccess`) |
| `npm test` | ✅ **254/254 tests, 23 files** |
| `npm run build` | ✅ `dist/index.html` 3.21 kB, CSS 6.63 kB, JS 593.19 kB, map 3.06 MB |
| `npm run verify:build` | ✅ 25/25 checks |
| `npm run verify:preview` | ✅ 12/12 checks |
| `npm run verify:dev` | ✅ 37/37 checks |
| Dev server serving | ✅ HTTP 200 for all new world/player/interaction modules |
| Real browser (WebGL, pointer lock) | ❌ **not executed** — no browser binary in this environment |

**Manual browser check still required.** Open the dev server or the live site,
click to capture the mouse, then verify: WASD movement follows terrain, Space jumps
and lands, sprint works, mouse look is smooth, walking into a boulder is blocked,
aiming at the Survey Beacon shows "Survey Beacon / Log survey ping" with a highlight
ring, `E` logs a ping once per press, looking away hides the prompt.

---

## Test coverage added this task

| Area | File | Tests |
|---|---|---|
| Terrain | `tests/world/TerrainHeightfield.test.ts` | 13 — determinism, grid/render consistency, bounds, invalid input, flat clearing, ridge, smoothness, normals, render data |
| Obstacles | `tests/world/ObstacleField.test.ts` | 9 — push-out, misses, vertical spans, determinism, clusters, broad phase, immutability, invalid input |
| World | `tests/world/World.test.ts` | 9 — reproducible layout, spawn on surface, clearing kept free, unique ids, collider registration, interactable data |
| Physics | `tests/player/PlayerPhysics.test.ts` | 20 — gravity, landing, no tunnelling, jumping, held-key repeat, slopes, sliding, obstacles, bounds, frame independence, interpolation |
| Interaction | `tests/interaction/InteractionSystem.test.ts` | 20 — ray maths, targeting, range, closest, availability, retargeting, execution, duplicate ids, world wiring |
| Interaction UI | `tests/ui/InteractionPrompt.test.ts` | 7 — visibility, content, feedback timer, teardown |
| Input edges | `tests/input/InputManager.test.ts` | +5 — jump/interact edges, auto-repeat, blur, typing targets |
| End-to-end | `tests/integration/phase1.test.ts` | 5 — spawn, walking, obstacle blocking, targeting + execution, jumping |
| Runtime composition | `tests/integration/runtime.test.ts` | 4 — real loop, camera follow, highlight clearing, beacon execution |

---

## Architectural decisions (this increment)

1. **Heightfield terrain as gameplay data; rendering is a consumer.** No gameplay
   query touches mesh geometry; the renderer reads `getRenderData()`. Verified by
   test, not by convention.
2. **Shared triangle split.** Physics interpolation and mesh triangulation use the
   same two triangles per cell, so collision and visuals cannot drift.
3. **Physics on the fixed clock, camera on the frame clock.** `step()` is a
   `SimulationSystem`; look and `viewAt(alpha)` are frame systems. Interpolation
   reads history and never writes simulation state.
4. **Cylinder collision for obstacles.** Chosen over boxes for stability (no corner
   trapping) and over per-mesh collision for cost; vertical span checks allow
   walking under/over later without changing the collider type.
5. **Spatial hash broad phase.** Movement only tests obstacles near the capsule.
6. **Slope policy:** generated terrain is capped at a traversable gradient, while
   the player still implements a walkable-slope limit (climb rejection and downhill
   sliding) for steeper terrain in future biomes.
7. **Interaction is a simulation system with a data-free contract.** Targeting is
   deterministic at 20 Hz; execution is edge-triggered; UI and highlight poll.
8. **Version 0.3.0.** New player-facing systems; no breaking change to the loop,
   configuration schema (additive sections only) or deployment.

---

## Infrastructure (unchanged this task)

Workflows were repaired in the previous task and were not modified now: `ci.yml`
runs on pull requests only with per-ref cancellation, `deploy-pages.yml` builds on
`main` pushes with build-supersede / deploy-serialise concurrency, and Pages uses
GitHub Actions. Last confirmed deployment: `7721488024` (run `43102108684`).
This task's merge is deployed by the same pipeline; the result is recorded below.

- **Live Pages deployment for v0.3.0:** ✅ **Confirmed** 2026-11-11T21:47Z — run
  [`43105952909`](https://github.com/Souls-equal/factory-frontier/actions/runs/43105952909)
  (build + deploy `success`), deployment `7721918068` on `main` @ `8d30fbd`.
  Verified over HTTP: the live site serves the v0.3.0 bundles
  (`assets/index-BqPsifUf.css` containing the interaction-prompt styles,
  `assets/index-C2sbTGQQ.js`) at <https://souls-equal.github.io/factory-frontier/>.

---

## Known Issues and Limitations

1. **No real-browser verification in this environment.** WebGL rasterization,
   pointer lock and visual output were not executed. Geometry, physics, targeting
   and UI state are covered by Node/jsdom tests and HTTP checks.
2. **Heightfield limitations.** No overhangs, caves or bridges; terrain is a
   function of XZ only. Chunk streaming, LOD and biome variety belong to Phase 10.
3. **Collision approximation.** Rocks collide as vertical cylinders; the visual
   silhouette can extend slightly past the collider. Props collide as cylinders too.
4. **No interaction occlusion.** Targets are chosen by ray/sphere hit only; a rock
   between the player and a beacon does not currently block targeting.
5. **Only the player is a simulated body.** No rigid-body physics, no dynamic props.
6. **Two interactable props exist as environment content.** They demonstrate the
   interaction contract (ping log, relay channel) and are not resource/gameplay
   systems; Phase 2 replaces them with real deposits/machines.
7. **No save system, inventory, building, machines or power** — by design.
8. **Source maps (~3.06 MB) ship with the production build** for debuggability;
   revisit in Phase 13.

---

## Next Recommended Task

1. Perform the manual browser check and record the result here.
2. **Phase 2 — Resources and inventory (only with explicit authorization):**
   item registry, inventory model with capacity rules, resource deposits placed on
   the Phase 1 terrain (`TerrainQuery` + `ObstacleField` are the extension points),
   manual gathering through the existing interaction contract, minimal HUD.
3. Do not start Phase 3+ before Phase 2 acceptance criteria are validated.

---

## Development Notes

- Documentation is the source of truth; update this file, `CHANGELOG.md`, the
  roadmap tracker and architecture appendices after every task.
- Never mark a phase complete based on visual appearance or unexecuted checks.
- Run `npm run verify` before declaring a task complete.
