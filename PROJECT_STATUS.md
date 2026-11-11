# PROJECT STATUS

**Project:** Factory Frontier
**Version:** 0.3.0
**Current Phase:** Phase 1 — Playable 3D Environment
**Phase Status:** 🟡 Implemented; acceptance pending browser verification
**Next Recommended Task:** Manual browser verification of Phase 1; Phase 2 requires explicit authorization
**Last Updated:** 2026-11-11

---

## Repository Inspection Findings (this task)

- Phase 0 + the camera foundation from `main` (`821a943`) were present and working:
  strict TypeScript/Vite/Three.js toolchain, `Game` lifecycle, fixed-timestep clock,
  frame-system stage, `PlayerController`, `InputManager`, UI shell, 158 tests,
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

## Collision instability investigation (2026-11-11)

- Reproduced the original bug on a single boulder: a tiny floating-point residual
  overlap triggered the radial escape search. Its first free angular sample moved
  the player around the boulder; the controller then divided that positional
  correction by the 50 ms step, producing **31.52 m/s** on step 10.
- Horizontal motion now sweeps to the nearest cylinder contact and slides along
  outward unit normals. The controller projects only inward physical velocity;
  depenetration is never converted to momentum. The escape search ignores
  round-off-scale penetration and chooses the closest free sampled point.
- The existing 50 ms simulation loop and its frame-time clamp remain unchanged.
  Tests exercise irregular frames through both `GameClock` and the actual `Game`
  loop, including multi-second frame spikes. No rendering changes or new
  dependencies were introduced.

---

## Phase 1 — Playable 3D Environment 🟡

### Terrain

| Item | Result |
|---|---|
| Representation | Finite square heightfield, 240 m, 120×120 cells (14 641 vertices, 28 800 triangles), generated from seeded fractal value noise |
| Determinism | Same seed + config → identical heights, obstacle layout and spawn (tested) |
| Height queries | `heightAt()` interpolates over the same triangle split the render mesh uses; render/collision agreement tested to 1e-4 |
| Normals/slopes | Analytic per-triangle normals; unit-length and upward-facing (tested) |
| Boundaries | `contains()`, `clampXZ()`, inset by player radius; out-of-bounds queries clamp rather than extrapolate |
| Shape | Flattened outpost clearing, rolling hills, raised boundary ridge closing the horizon |
| Smoothness | Bounded relaxation reduces axis-neighbour height differences toward 0.72 rise/run; triangle slopes are not universally capped |
| Extension | `TerrainQuery` contract + explicit grid origin for future chunk streaming |

### Player physics

| Requirement | Implementation | Evidence |
|---|---|---|
| Gravity | Semi-implicit Euler on the 50 ms fixed clock | 20 physics tests |
| Ground detection | Surface height + snap distance; never below the surface | Integration test asserts `y ≥ ground` every step |
| Jumping | Edge-triggered, grounded-only, impulse 7.2 m/s, apex within the analytic range | Holding the key yields exactly one jump over 120 steps |
| Landing | Snaps to surface, clears vertical velocity, sets grounded | Falling from 12 m lands at y≈0 |
| Falling | Ledge drops beyond the snap distance become real falls | Covered by gravity tests |
| Collision — terrain | Feet are clamped to the sampled ground height | Large vertical-fall test; not a continuous collision proof |
| Collision — obstacles | Swept horizontal circle against cylinders; separate initial depenetration; inward velocity projection | Sustained pressure, sliding, corners, repeated contacts, jump, slopes and irregular frames tested |
| Slopes | Segment-slope climb rejection + reduced-drag downhill slide above the limit | Steep ramp: no climb, slides; gentle ramp: follows surface |
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
- Renderer resources are disposed on teardown. Collision and interaction queries
  allocate temporary data; allocation-free hot paths have not been demonstrated.

---

## Verification (executed 2026-11-11)

| Check | Result |
|---|---|
| `npm run typecheck` | ✅ pass (strict, `noUncheckedIndexedAccess`) |
| `npm test` | ✅ **271/271 tests, 24 files** |
| `npm run build` | ✅ `dist/index.html` 3.21 kB, CSS 6.63 kB, JS 594.67 kB, map 3.07 MB |
| `npm run verify:build` | ✅ 25/25 checks |
| `npm run verify:preview` | ✅ 12/12 checks |
| `npm run verify:dev` | ✅ 37/37 checks |
| Dev server serving | ✅ HTTP 200 for all new world/player/interaction modules |
| Real browser (WebGL, pointer lock) | ❌ **not executed** — no browser binary in this environment |

**Manual browser checks not performed:** movement, mouse look and pointer lock,
sprint, jump, landing, terrain and obstacle collision (including sustained
pressure, sliding and corners), targeting and interaction, prompt visibility,
and rendering. These remain required before accepting Phase 1.

---

## Test coverage added this task

| Area | File | Tests |
|---|---|---|
| Terrain | `tests/world/TerrainHeightfield.test.ts` | 13 — determinism, grid/render consistency, bounds, invalid input, flat clearing, ridge, smoothness, normals, render data |
| Obstacles | `tests/world/ObstacleField.test.ts` | 13 — push-out, misses, vertical spans, determinism, clusters, broad phase, immutability, invalid input |
| World | `tests/world/World.test.ts` | 10 — reproducible layout, spawn on surface, clearing kept free, unique ids, collider registration, interactable data |
| Physics | `tests/player/PlayerPhysics.test.ts` | 20 — gravity, landing, large vertical falls, jumping, held-key repeat, slopes, sliding, obstacles, bounds, frame independence, interpolation |
| Interaction | `tests/interaction/InteractionSystem.test.ts` | 20 — ray maths, targeting, range, closest, availability, retargeting, execution, duplicate ids, world wiring |
| Interaction UI | `tests/ui/InteractionPrompt.test.ts` | 7 — visibility, content, feedback timer, teardown |
| Input edges | `tests/input/InputManager.test.ts` | +5 — jump/interact edges, auto-repeat, blur, typing targets |
| End-to-end | `tests/integration/phase1.test.ts` | 5 — spawn, walking, obstacle blocking, targeting + execution, jumping |
| Contact stability | `tests/player/ObstacleStability.test.ts` | 13 — launch repro, sustained pressure, sliding, corners, repeated contacts, jump, frame spikes, slopes, world rocks, thin-collider sweep |
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
4. **Cylinder collision for obstacles.** Swept circle motion and iterative
   sliding handle horizontal contacts; velocity projection is separate from
   depenetration. Vertical spans are sampled at the start of each step.
5. **Spatial hash broad phase.** Movement only tests obstacles near the capsule.
6. **Slope policy:** generation relaxes neighbouring heights with a bounded number
   of passes. The player implements a configurable slope limit; a universal
   maximum triangle slope and whole-world traversability are not guaranteed.
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

- **Previous v0.3.0 Pages deployment:** run `43105952909`, deployment
  `7721918068`, on merge `8d30fbd`, succeeded. This collision fix is not deployed
  until it is merged and a subsequent deployment succeeds.

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
   systems.
7. **No save system, inventory, building, machines or power** — by design.
8. **Source maps (~3.07 MB) ship with the production build** for debuggability.
9. **Collision bounds:** a deeply embedded spawn or pathological intersecting
   cylinder cluster may need a noticeable depenetration correction or remain
   overlapped. Remaining movement is conservatively stopped when the bounded
   search/contact iterations cannot resolve it. Vertical cylinder overlap is
   sampled at the start of each fixed step, not continuously swept in 3D.
10. **Terrain slope relaxation** is bounded and axis-neighbour based; it does not
    prove every triangle meets the configured walkable-slope limit.

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
