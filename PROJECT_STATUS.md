# PROJECT STATUS

**Project:** Factory Frontier
**Version:** 0.1.0
**Current Phase:** Phase 0 — Repository Inspection and Foundation
**Phase Status:** ✅ Implementation complete · automated verification passed ·
manual browser confirmation pending
**Next Phase:** Phase 1 — Playable 3D Environment (not started)
**Last Updated:** 2026-11-11

---

## Current Development Phase

Phase 0 — Repository Inspection and Foundation.

The technical foundation defined by §24 of the roadmap is implemented: TypeScript,
Vite, Three.js, the central `Game` class, the rendering loop, a basic scene, GitHub
Pages compatibility, and an automated test/verification pipeline.

No Phase 1 or later gameplay systems have been started.

---

## Completed Phases

### Phase 0 — Repository inspection and foundation (implementation complete)

| Objective | Status | Outcome |
|---|---|---|
| Inspect the repository | ✅ | Repository contained only documentation and an empty `src/index.html` |
| Configure TypeScript | ✅ | Strict TS 5.9.3, `tsc --noEmit` clean |
| Configure Vite | ✅ | Vite 8.3.8 dev/build/preview, base path, preview-host support |
| Install and configure Three.js | ✅ | Three.js 0.187.0 with typed wrapper (`Renderer`, `SceneManager`, …) |
| Establish the main application structure | ✅ | `core/`, `engine/`, `ui/`, `utils/`, `styles/`, `tests/`, `scripts/` |
| Configure GitHub Pages compatibility | ✅ | Production base `/factory-frontier/`, deploy workflow, verified artifact URLs |
| Create the central Game class | ✅ | `src/core/Game.ts` with lifecycle, systems, stats and events |
| Create the rendering loop | ✅ | `GameLoop` + `GameClock` fixed-step loop with bounded catch-up |
| Create a basic scene | ✅ | Foundation survey scene with lighting, shadows, fog and instancing |

---

## Phase 0 Task Checklist

- [x] Inspect repository structure.
- [x] Inspect existing dependencies (none were present; no lockfile or package manifest).
- [x] Review project documentation (master specification, ARENA rules, status).
- [x] Create the missing canonical docs (`docs/GDD.md`, `docs/TECHNICAL_ARCHITECTURE.md`, `docs/DEVELOPMENT_ROADMAP.md`).
- [x] Configure TypeScript (strict, bundler resolution, no emit).
- [x] Configure Vite (dev, production build, preview, GitHub Pages base path).
- [x] Integrate Three.js behind an engine boundary.
- [x] Establish the initial game architecture (Game, GameEngine, GameLoop, GameClock, EventBus, GameState).
- [x] Create the main rendering loop (fixed 50 ms simulation, variable render rate).
- [x] Add automated tests for all deterministic Phase 0 systems (110 tests).
- [x] Add build/preview/dev-server verification scripts.
- [x] Validate the initial build and HTTP serving (Pages base path included).
- [ ] Confirm the WebGL scene visually in a real browser (environment limitation — see below).

---

## Verification Results

All commands below were executed in the development sandbox.

| Command | Result |
|---|---|
| `npm ci` | ✅ 90 packages installed from the committed lockfile |
| `npm run typecheck` | ✅ No errors (strict TypeScript 5.9.3) |
| `npm test` | ✅ 12 test files, **110/110 tests passed** |
| `npm run build` | ✅ Built in ≈0.26 s; 20 modules transformed |
| `npm run verify:build` | ✅ 21 checks passed (Pages base path, asset integrity, favicon, no localhost) |
| `npm run verify:preview` | ✅ Served `dist/` under `/factory-frontier/`, all assets HTTP 200 |
| `npm run verify:dev` | ✅ Dev entry page, module graph, Three.js pre-bundle and CSS served |

Production build output:

```text
dist/index.html                   2.38 kB
dist/assets/index-*.css           4.15 kB
dist/assets/index-*.js          560.34 kB   (Three.js included)
dist/assets/index-*.js.map      2919.51 kB
dist/favicon.svg                    395 B
```

The built HTML references assets under `/factory-frontier/assets/…`, and the
preview server returned HTTP 200 for the entry document and every referenced asset.

### Test coverage by area

| Area | Verified behaviour |
|---|---|
| `GameClock` | Accumulation, multi-step frames, delta clamping, catch-up cap, dropped time, invalid input, determinism, reset |
| `GameLoop` | First-frame origin, fixed updates, single render per frame, start/stop/restart, frame clamping, FPS stats, error fail-fast |
| `EventBus` | on/off/once, listener counts, error isolation, mutation during emit, clearing |
| `Configuration` | Defaults, overrides, immutability, base-path normalization, range validation |
| `GameState` / `Game` | Legal/illegal transitions, per-action guards, init failures, start/pause/resume/stop, resizing, system registration, disposal, error handling |
| Engine | Scene construction, instancing, camera aspect, lighting/shadows, render delegation, resize, dispose/teardown |
| UI | Boot status, fatal panel, debug stats, real shell markup, page-unload disposal, fatal engine error path |
| Bootstrap | Real `main.ts` against real `index.html` with only `Engine.create` mocked |

---

## Phase 0 Acceptance Criteria

| Criterion | Status | Evidence |
|---|---|---|
| Project builds successfully | ✅ Verified | `npm run build` exited 0 and emitted `dist/` with JS, CSS, source map and favicon |
| Game loads in a browser | ⚠️ Partially verified | Entry document, module graph and build artifacts are served correctly; the real bootstrap runs under jsdom. Actual page load in a browser was not executed (no browser binary in the sandbox) |
| Three.js scene renders | ⚠️ Partially verified | Scene graph, camera, lights, instancing and render delegation are unit-tested; GPU rasterization was not executed |
| No critical console errors | ⚠️ Partially verified | No transform/import errors, bootstrap integration test produces no `console.error`. Runtime console of a real browser was not captured |
| GitHub Pages base path configured correctly | ✅ Verified | Built HTML and every asset use `/factory-frontier/…`; preview server fetch checks pass; override documented |

**Phase 0 is not declared fully accepted until the manual browser check below has
been performed and recorded here.** Phase 1 must not start before that check.

Manual check required:

1. Run `npm run dev` and open the printed URL (or use the live preview).
2. Confirm the boot overlay disappears, the survey scene is visible, and the
   debug panel works with `?debug=1`.
3. Confirm the browser console shows the `Factory Frontier … ready` info line and
   no errors; verify WebGL2 is active.
4. Record the result in this document.

---

## Architectural Decisions

1. **Documentation split.** The 2,222-line master specification was divided into
   `docs/GDD.md` (§0–19), `docs/TECHNICAL_ARCHITECTURE.md` (§20–23) and
   `docs/DEVELOPMENT_ROADMAP.md` (§24–26), preserving the text byte-for-byte. This
   satisfies the mandatory structure in `ARENA_RULES.md` and avoids maintaining
   three divergent copies. `README.md` is now the entry point.
2. **Gameplay/rendering boundary.** `Game` depends only on the `GameEngine`
   interface in `src/engine/types.ts`; `Engine` composes the Three.js subsystems.
   Gameplay code must never import Three.js. This enables headless logic tests and
   future rendering-backend changes.
3. **Fixed timestep with bounded catch-up.** 50 ms steps, 250 ms maximum frame
   delta, 10-step catch-up limit, excess backlog discarded and reported. This
   protects determinism and prevents the simulation from entering an unbounded
   catch-up spiral after a stall.
4. **Explicit lifecycle.** `GameState` owns the transition table; `Game` enforces
   per-action preconditions. This fixed a real gap where `resume()` was accepted
   from `initialized`.
5. **Fail-fast loop errors.** An exception in a simulation system or in rendering
   stops the loop, moves the game to `stopped`, emits `game:error`, and surfaces a
   fatal panel in the UI instead of silently continuing with inconsistent state.
6. **Environment-aware base path.** Production defaults to `/factory-frontier/`,
   development to `/`; both dev and build use the same resolver, and
   `VITE_BASE_PATH` supports renamed repositories or custom domains.
7. **Dependency minimalism.** Runtime dependency: Three.js only. Dev tooling:
   TypeScript, Vite, Vitest, jsdom, type packages. No physics engine, state library
   or UI framework has been introduced.
8. **Verification as code.** Base-path, asset, preview-server and dev-server
   checks are scripts run locally and in CI, not manual steps.
9. **Phase 0 scene is explicitly a fixture.** The survey scene proves the render
   pipeline and instancing path. It contains no fake gameplay systems.
10. **No empty scaffolding.** Folders and registries for later phases are created
    only when those phases begin.

---

## Known Issues and Limitations

1. **Browser/WebGL verification not executed in the sandbox.** There is no browser
   binary or system browser library available, and browser downloads are outside
   the allowed network hosts. The game is verified through build artifacts, HTTP
   serving, jsdom bootstrap and Node scene-graph tests. A manual browser check is
   required before Phase 1.
2. **The scene is a Phase 0 fixture**, not terrain: flat ground plane, grid, pad,
   beacon and instanced markers. It does not represent Phase 1 world generation.
3. **No gameplay systems are registered.** `Game.registerSystem` is the extension
   point; Phase 0 intentionally has an empty simulation system list.
4. **Source maps are shipped** (≈2.9 MB `.map`) for debuggability. Compression and
   map policy can be revisited in Phase 13 (deployment optimization).
5. **The Pages deployment workflow has not run on GitHub Actions yet.** It is
   configured for `main`; this branch (`arena/f9c37f65-factory-frontier`) does not
   trigger a deployment. Repositories with a different name or a custom domain
   must set `VITE_BASE_PATH`.
6. **No persistence, audio, UI framework or asset pipeline.** These are later
   phases and no placeholders were added.
7. **GitHub Pages SPA fallback is not configured.** Not needed in Phase 0 (single
   route); required if client-side routing is introduced later.

---

## Next Objective

1. Perform and record the manual browser smoke check above.
2. Start **Phase 1 — Playable 3D environment** only after that check passes:
   terrain, first-person camera, pointer lock, movement, gravity, collisions,
   interaction raycasting, basic lighting and initial environment.
3. Add automated tests for movement/collision math and raycast selection while
   implementing Phase 1; keep the fixed-step simulation and rendering separation.

---

## Development Notes

- Documentation is the source of truth. Update this file and `CHANGELOG.md` after
  every task, and update the roadmap when progress or scope changes.
- Do not mark a phase complete based on visual appearance or on unexecuted checks.
- Preserve the layering: DOM in `main.ts`/`ui/`, orchestration in `core/`, Three.js
  in `engine/`, gameplay (when added) independent of rendering.
- Run `npm run verify` before considering a task complete.
