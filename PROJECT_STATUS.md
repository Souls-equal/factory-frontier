# PROJECT STATUS

**Project:** Factory Frontier
**Version:** 0.2.0
**Current Phase:** Phase 1 — Playable 3D Environment (foundation portion only)
**Phase Status:** 🟡 Partially started · first-person camera/input foundation complete ·
Phase 1 acceptance criteria **not** met
**Next Recommended Task:** Complete Phase 1 — terrain, gravity, collisions and
interaction raycasting
**Last Updated:** 2026-11-11

---

## Repository Inspection Findings (this task)

- The Phase 0 foundation from `main` was present and working: toolchain, docs,
  core architecture, foundation scene, tests and deployment workflows.
- No existing implementation needed to be replaced or removed; it was preserved.
- **Missing for this task:** any input layer, player controller, camera-view
  application, frame-stage update pipeline and control UI — now implemented.
- **Missing by design:** terrain/physics/raycasting (Phase 1), inventory and
  factories (Phases 2–9), save code (Phase 12), data registries (Phases 2–7).
  Designs for save/data are documented rather than stubbed.
- **External technical issue (now resolved in the repository setting):** Pages is
  configured for GitHub Actions (`build_type: workflow`). The *published* content
  is still the last legacy branch build, which serves raw sources instead of
  `dist/`; it is replaced by the next successful workflow deployment.

---

## Current Development Phase

Phase 0 (repository inspection and foundation) is complete and merged into `main`.
It delivered the toolchain, core architecture, deterministic fixed-timestep loop,
foundation scene, tests and Pages-compatible build.

This task extended the foundation with the first functional player-facing
capability: a **controllable first-person camera** (pointer-lock mouse look,
click-drag fallback, WASD movement, sprint, acceleration and bounded flat play
area), plus the input/player modules, frame-stage update pipeline, control UI and
tests.

This is explicitly authorised Phase 1 groundwork, not a completed Phase 1. There is
still no terrain, gravity, jumping, collision detection or interaction raycasting,
so the Phase 1 acceptance criteria in `docs/DEVELOPMENT_ROADMAP.md` are not met.
No factory gameplay system has been started.

---

## Completed Work

### Phase 0 — Repository inspection and foundation ✅

Toolchain (strict TypeScript, Vite, Three.js, Vitest), documentation split into
`docs/*`, central `Game` lifecycle, fixed-timestep clock and render loop, engine
renderer/scene/camera/lighting, foundation scene, event bus, configuration,
build/preview/dev verification scripts, CI and Pages workflows, 110 tests.

### Foundation extension — controllable first-person camera ✅

| Objective | Status | Evidence |
|---|---|---|
| Inspect repository and preserve existing implementation | ✅ | Phase 0 preserved; no working functionality rewritten |
| TypeScript / Three.js / Vite requirement | ✅ | Existing toolchain retained; strict check passes |
| Modular architecture (input, player, engine, core, UI) | ✅ | New `src/input/` and `src/player/` modules, small focused files |
| Fixed-timestep simulation + independent render loop | ✅ | Existing fixed stage retained; new presentation frame stage documented and tested |
| Data-driven machines/recipes/resources/items | 📝 Design only | Baseline interfaces and rules documented in Technical Architecture Appendix B.6; implementation deferred to Phases 2–7 |
| Save system designed for browser persistence | 📝 Design only | IndexedDB envelope, versioning, validation and atomic-write baseline documented in Technical Architecture Appendix B.5; implementation deferred to Phase 12 |
| GitHub Pages-compatible build | ✅ | Verified production base path and served assets |
| Basic Three.js scene with ground and lighting | ✅ | Foundation scene preserved and verified by tests and HTTP serving |
| Controllable 3D first-person camera | ✅ | `PlayerController` + `InputManager`; mouse look, WASD, sprint, pitch clamp, bounds |
| Application starts through the dev server | ✅ | Dev-server verification script passes; manual server run confirmed HTTP 200 |
| Production build succeeds | ✅ | `npm run build` passes |
| Documentation synchronized | ✅ | README, status, changelog, roadmap tracker, architecture appendices updated |

### Implemented in this task

- **`src/input/InputManager.ts`** — WASD/Shift keyboard state; pointer-lock mouse
  look with click-drag fallback; ignored keys while typing; blur/visibility key
  clearing; pointer-lock change callback; complete listener cleanup on dispose.
- **`src/player/PlayerController.ts`** — Three-free first-person controller:
  accelerated walking/strafe/sprint, mouse look with pitch clamp and yaw
  normalization, circular safety bound, spawn/reset, camera-view output.
- **`src/ui/ControlsHint.ts`** — pointer-lock-aware control hint (real state only).
- **Frame systems** — `Game.registerFrameSystem` / `unregisterFrameSystem`, run
  once per rendered frame immediately before `engine.render(alpha)`; fail-fast on
  errors; included in statistics and disposal.
- **Camera application** — `CameraView` contract and `Engine.applyView` →
  `CameraManager` (`YXZ` rotation, finite-value validation).
- **Control configuration** — validated, immutable `GameConfig.controls`
  (eye height, speed, sprint, acceleration, sensitivity, pitch limit, play area).
- **Shell** — crosshair, control hint, updated phase label/boot copy.
- **Tests** — new suites for input, player movement, controls hint, frame systems,
  camera application and bootstrap wiring (110 → 158 tests).
- **Verification scripts** — now also check the controls hint, crosshair and new
  modules.

### Preserved from Phase 0

Toolchain and lockfile, strict configuration, `Game`/`GameClock`/`GameLoop`/
`GameState`/`EventBus`, `Engine`/`Renderer`/`SceneManager`/`CameraManager`/
`LightingManager`, foundation scene, `StatusOverlay`, build and verification
scripts, CI and GitHub Pages workflows.

---

## Verification Results

Commands executed in this sandbox:

| Command | Result |
|---|---|
| `npm ci` | ✅ 92 packages installed from lockfile |
| `npm run typecheck` | ✅ No errors (strict TypeScript 5.9.3) |
| `npm test` | ✅ 15 test files, **158/158 tests passed** |
| `npm run build` | ✅ Built in ≈0.33 s |
| `npm run verify:build` | ✅ 23 checks passed (base path, assets, favicon, HUD, no localhost) |
| `npm run verify:preview` | ✅ 11 checks passed; production build served under `/factory-frontier/`, all assets HTTP 200 |
| `npm run verify:dev` | ✅ 22 checks passed; dev entry page and module graph served/transformed (including new input/player modules) |

Production build output:

```text
dist/index.html                   2.64 kB
dist/assets/index-*.css           5.07 kB
dist/assets/index-*.js          568.68 kB   (Three.js included)
dist/assets/index-*.js.map    2,950.23 kB
dist/favicon.svg                    395 B
```

### New tests

- `tests/input/InputManager.test.ts` — axes, sprint, blur, typing-target guard,
  drag deltas, pointer-lock deltas, lock requests, rejection handling, dispose.
- `tests/player/PlayerController.test.ts` — spawn/view, forward/strafe relative to
  yaw, acceleration, sprint, braking, diagonal normalization, pitch clamp, yaw
  normalization, invalid input, frame-delta clamp, play-area bound, reset.
- `tests/ui/ControlsHint.test.ts` — binding, missing element, pointer-lock display.
- Extended `tests/core/Game.test.ts` — frame-system ordering, registration,
  duplicate-id protection, failure handling, disposal.
- Extended engine/config/overlay/bootstrap tests for camera application, controls
  config and real shell wiring.

### Acceptance status for this task

| Criterion | Status | Evidence |
|---|---|---|
| TypeScript checks | ✅ Passed | `npm run typecheck` |
| Production build | ✅ Passed | `npm run build` |
| Tests | ✅ Passed | 158/158 |
| Dev server starts | ✅ Passed | `verify:dev` + live server HTTP 200 check |
| Basic scene / ground / lighting | ✅ Constructed and tested | Scene graph, lights, render delegation; real rasterization pending browser |
| Controllable first-person camera | ✅ Logic verified | 35+ player/input/camera assertions; real pointer lock pending browser |
| GitHub Pages configuration coherent | ✅ Build / ⏳ deploy | Artifacts and base path verified; Pages uses GitHub Actions; deployment verification pending |
| Application renders correctly in a browser | ⚠️ Not executed | No browser binary in sandbox; manual check required |

**Manual browser check still required:** open the live preview, click to capture
the mouse, move/look with WASD + mouse, sprint with Shift, release with Esc, verify
no console errors, then record the result here.

---

## Infrastructure — GitHub Actions and Pages (repaired this task)

Audit of the run history (2026-11-11):

| Run window | Result | Interpretation |
|---|---|---|
| 19:58 – 20:12 | CI and Deploy runs `success` (e.g. `43094267705`) | Pipeline itself worked; the deploy job completed |
| 20:15 | `pages-build-deployment` `success` from branch `arena/f9c37f65-…` | **Legacy branch build published raw sources**, overwriting the workflow deployment |
| 20:25 – 20:45 | 4 runs stuck `queued`, 1 `startup_failure` with zero jobs, 1 `failure` whose build job never executed a step | **GitHub incident `dvy0t3mvh1lg`** — Actions and Pages reported `major_outage` from 20:48Z; the job queue stopped dispatching |

Root causes: (a) the outage blocked runners, so queue/`startup_failure` symptoms were
infrastructure, not our YAML; (b) duplicated validation — `ci.yml` ran on both `push`
and `pull_request`, producing two identical runs per PR update and a second full
pipeline on every `main` push; (c) `ci.yml` lacked any concurrency group, so obsolete
runs piled up; (d) `deploy-pages.yml` used a single workflow-wide `pages` group, which
serialised builds behind deployments; (e) the live site was stale because a legacy
branch build outranked the workflow deployment; (f) documentation still described
Pages as using branch deployment.

Changes: `ci.yml` now runs only on `pull_request`/`workflow_dispatch` with
`concurrency: ci-${{ github.ref }}` and `cancel-in-progress: true`; `deploy-pages.yml`
runs on `push` to `main`/`workflow_dispatch`, splits build (`pages-build-…`,
`cancel-in-progress: true`) from deploy (`pages-deploy`, `cancel-in-progress: false`),
and uses maintained action majors (checkout v7, setup-node v7, configure-pages v6,
upload-pages-artifact v5, deploy-pages v5) with `timeout-minutes` on both jobs. Vite
base-path handling, `dist/` output and `VITE_BASE_PATH` override were left untouched.

Local validation of this change: `npm ci`, `npm run typecheck`, `npm test`
(158/158), `npm run build`, `verify:build` (23/23), `verify:preview`, `verify:dev`
all pass; both workflow files parse as valid YAML. Deployment confirmation: see the
line below — it is only recorded once a real deployment succeeded.

- **Live Pages deployment:** ⏳ not yet confirmed after the rework.

---

## Known Issues and Limitations

1. **The published Pages site is stale (legacy branch build).** Pages itself is
   configured for GitHub Actions (`build_type: workflow`), but the most recent
   deployment (2026-11-11T20:15Z) came from the **legacy branch build** of an old
   feature branch, so it publishes raw sources instead of `dist/`. It is replaced by
   the next successful workflow deployment; no repository setting change is needed.
2. **No real-browser verification in this environment.** WebGL rasterization,
   pointer lock and browser console output were not executed. Unit/integration
   tests and HTTP serving checks pass, but visual confirmation is pending.
3. **Camera foundation is not Phase 1 physics.** There is no terrain height
   sampling, gravity, jumping, slope handling or collision. The player walks on an
   assumed flat plane and is constrained by a circular safety radius. Phase 1 must
   replace this with a deterministic player simulation.
4. **Movement is presentation-stage.** It integrates frame deltas clamped to
   250 ms; it is bounded and frame-rate independent in speed but not a
   deterministic physics step. Industrial simulation remains fixed-step.
5. **No save system code and no data-driven registries yet.** Only documented
   designs exist (Technical Architecture Appendices B.5/B.6); no placeholder code
   was added. Phase 12 and Phases 2–7 respectively.
6. **No key remapping, settings menu, audio, terrain or interaction prompt.**
7. **Source maps (~2.95 MB) ship with the production build** for debuggability;
   revisit in Phase 13.
8. **No empty gameplay scaffolding.** Factory/system folders will be created when
   their phases begin.

---

## Architectural Decisions (this increment)

1. **Two-stage update model.** Deterministic industrial simulation stays on the
   50 ms fixed clock (`SimulationSystem`); input-driven camera/view updates run in
   a new `FrameSystem` stage once per render. This avoids 20 Hz mouse-look stutter
   without compromising simulation determinism.
2. **Three-free player controller.** `PlayerController` owns plain numbers and a
   `CameraView`; only `Engine`/`CameraManager` touch Three.js. This keeps movement
   logic testable in Node and preserves the gameplay/rendering boundary.
3. **Unified system id space.** Simulation and frame systems cannot share ids,
   preventing ambiguous statistics and teardown.
4. **Pointer lock with drag fallback.** Pointer lock is preferred, but look input
   remains usable if the browser denies it, which also makes jsdom-based tests
   meaningful without faking a lock.
5. **Controls as validated configuration.** Sensitivity, speeds, pitch limit and
   play-area radius are data, not constants buried in the controller.
6. **Design-before-implementation for persistence and data.** Save and registry
   designs are documented with explicit deferral; no fake systems were introduced.
7. **Version 0.2.0.** New player-facing capability; compatible with Phase 0
   foundation.

Unresolved design choices are tracked in `docs/GDD.md` Appendix A; no provisional
gameplay balance values were encoded.

---

## Next Recommended Task

1. Perform the manual browser check and record it here.
2. **Complete Phase 1 — Playable 3D environment** (do not start Phase 2):
   - deterministic terrain heightfield and walkable ground,
   - gravity, jumping, ground detection and collision with terrain/major objects,
   - interaction raycasting and contextual prompts,
   - basic environment placement that does not interfere with construction,
   - movement/collision/raycast tests and update of Phase 1 acceptance evidence.
3. Re-run the Pages deployment once CI infrastructure is healthy and confirm the
   live site serves `/factory-frontier/assets/*.js` (not raw sources).

---

## Development Notes

- Documentation is the source of truth; update this file, `CHANGELOG.md` and the
  roadmap tracker after every task, and architecture appendices when decisions
  change.
- Never mark a phase complete based on visual appearance or unexecuted checks.
- Run `npm run verify` before declaring a task complete.
- Preserve the layering: DOM in `main.ts`/`ui/`, orchestration in `core/`,
  Three.js in `engine/`, player math without Three.js.
