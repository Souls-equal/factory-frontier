# PROJECT STATUS

**Project:** Factory Frontier
**Version:** 0.3.0
**Current Phase:** Phase 5 — Conveyor foundation (in progress)
**Phase Status:** 🟡 In progress — headless WebGL path verified; user acceptance pending
**Next Recommended Task:** Validate the one-cell conveyor and dropped items in a real browser with the player; complete Phase 5 acceptance.
**Last Updated:** 2026-11-11

---

## Player camera and voxel contacts (user validation pending)

- Ignore individual pointer-lock motion events over 300 pixels and clear unconsumed look
  deltas on blur, visibility loss and pointer-lock transitions. Drag fallback and
  ordinary successive events remain unchanged; extremely fast single events may also be discarded. The
  user's particular device spike has not been reproduced with physical hardware.
- Voxel walls now use swept circle-to-column side and rounded-corner contacts,
  consistent with circular ground support. Existing overlaps allow outward or
  tangential motion without a corrective teleport; slope blocking no longer pins
  a player already inside a voxel wall. Tall walls and obstacle collisions remain.
  Tests cover corner clearance, wall sliding, overlap recovery, diagonal motion,
  high-speed sweeps, jumping and natural obstacles. Headless Chromium loaded the
  game and exercised synthetic look spikes and corner movement. Physical-device
  and in-game user validation remain pending; Phase 5 is not complete.

## Phase 5 — aligned downhill conveyor fix (user validation pending)

- Straight descending one-cell connections with one incoming route now form a
  full-length sloped lower deck with rails and treads, including foundation-to-
  ground transitions. Preview, path and rendered deck use the same inlet and
  outlet heights. Items remain protected by existing topology guards.
- Junctions, sideways entries and tiles that must also climb retain the shorter
  centre-entry ramp; steep or complex junctions are not fully redesigned.
  Automated tests cover four orientations, foundation height, item conservation,
  successive drops, preview, demolition, occupied belts and multiple inputs.
  A headless Chromium/WebGL scene rebuilt a foundation-to-ground descent for a
  visual check. Phase 5 and real-user validation of the reported setup remain pending.

## Phase 5 — natural environment visual refresh (user validation pending)

- Grass tops, grassy edges and deeper earth have a deterministic pixel-art texture
  atlas. Decorative rocks use three instanced faceted variants, and starter trees,
  fallen branches and loose stones have new models and pixel textures. These are
  presentation changes: generation, collision, collection and placement are
  unchanged. Decorative rocks retain their approximate cylindrical colliders.
- Headless Chromium/WebGL screenshots checked the actual scene and close views of
  trees and rocks. Physical play and user visual approval remain outstanding;
  Phase 5 is still in progress.

## Phase 5 — inventory visual refresh (user validation pending)

- Player and terminal inventories use the same dark six-column square slots and
  six local voxel material icons. Counts and accessible names remain available;
  custom items without artwork retain a text fallback. Capacity and interactions
  are unchanged. Chromium headless screenshots checked the populated standalone
  inventory and a simulated terminal at desktop and mobile widths; this is not a
  substitute for a complete in-game play session or user visual acceptance.

## Phase 5 — dropped items and two-panel terminal (user validation pending)

- A terminal collects covered dropped items until full; directional cells admit
  covered drops one at a time with spacing and priority over upstream traffic.
  Surplus remains visible and retried, not lost. Height filtering avoids collecting
  objects from beneath raised buildings. Ground and transport keep distinct
  interaction registrations when ownership changes.
- The terminal and player inventories appear side by side in compact voxel-like
  grids (stacked on narrow screens); selecting a slot inspects it and Retrieve
  contents remains the transfer action. No per-slot drag transfer is implemented.
  Automated tests exercise the real bootstrap with a mocked renderer, not a
  physical play session. Phase 5 and visual/player acceptance remain pending.

## Phase 5 — terminal slots and contact recovery (user validation pending)

- The receiving terminal shows its actual inventory slots using the same slot
  presentation as the player inventory. Slots can be selected for details;
  Retrieve contents still transfers only what fits. Production capacity remains
  one slot; the UI and tests also support configurable multi-slot inventories.
- Conservative building contact now permits sliding or moving outward from an
  existing overlap without a teleport or inward tunnelling. Placement still
  rejects the player's expanded footprint. The reported in-game case needs player
  re-testing; this fix covers a reproducible overlap/contact failure mode.

## Phase 5 — latest iteration (user validation pending)

- Directional cells display curved guides and open incoming side rails for turns;
  terminals accept inward-facing cells on all four marked sides, at matching
  height, and retain their one-stack backpressure. Legacy belts keep their port.
- E targets individual moving belt items instead of opening conveyor inspection;
  failed pickup keeps the item. More seeded starter trees and stones are placed
  with the same exclusion rules. Real-browser visual and player acceptance remain
  outstanding; Phase 6 has not begun.

## Voxel transition — terrain integration (in progress)

- The user chose indestructible voxel terrain and voxel-style resources and
  machines, with trees, branches and loose stones providing initial materials.
  Starter trees/branches/stones are implemented with block-shaped visuals and
  finite quantities. A Miner costs 10 stone and 10 wood (no iron); direct
  gathering from deposits is replaced by Miner-only extraction. This is a
  deliberate progression change requested for the voxel transition.
- The playable world now samples the seeded heightfield into immutable solid
  voxel columns, renders exposed block faces and resolves swept horizontal wall
  contacts plus footprint-aware landing. The default block size is 1 m and the
  default jump speed is 8.4 m/s; fixed-step tests cover a one-block jump and a
  two-block wall. Terrain cannot be edited. The existing generation settings
  still define the sampled heightfield. For large/complex configurations the
  grid may be coarsened to stay under the 500,000-face mesh budget; blocks can
  then exceed jump height. No chunk streaming, caves, terrain editing or saving.
- Building support checks all overlapping columns and rejects footprints that
  bridge excessive height differences. Deposit generation additionally checks
  the snapped Miner footprint; locations may therefore differ from the old world.
  Tests cover generated deposits across representative seeds and the full existing
  Miner-to-terminal chain on the default voxel world, not all possible worlds.
  Prior integration passed typecheck, test, build and verify: 433 tests in 49 files.
- Starter objects are seeded, finite and session-only: branches and loose stones
  give 5 each; trees require three E presses and provide 20 wood. Partial/full
  inventory leaves the remainder in place. Trees block movement and all starter
  objects block building until collected; collision and visuals follow shared state.
  Generation uses bounded retries; representative default seeds provide enough
  materials, but extreme custom worlds or a very small playable radius may not.
  The old `resources.gatherQuantity` setting remains accepted for configuration
  compatibility but no longer controls collection.
- Automated verification: 436 tests in 50 files, including an empty-inventory
  bootstrap through Miner and terminal, inventory conservation, active placement
  obstacles and synchronized collision/scene state.
- Deposits, natural rocks and outpost props now use block meshes; the Miner has
  a stepped block drill/head, the foundation and receiving terminal have block
  details, and conveyors retain box-based surfaces following their existing paths.
  Cyan/yellow port markers, coloured deposit auras/ground traces, highlights and
  logical state lamps remain. Valid/invalid placement tints all preview parts.
  Conveyor curves and inclines still use angled box surfaces to follow the actual
  transport path; circular markers and the sky remain non-voxel presentation.
  Natural obstacle physics still uses cylindrical colliders and is approximate.
  Current typecheck, test, build and verify pass; 445 tests in 50 files.
- **Still pending:** actual WebGL and physical user acceptance of the voxel
  visuals, terrain, bootstrap and Phase 5. Scene-graph tests do not prove browser
  usability; phase 5 is not accepted and phase 6 is not started.

---

## Phase 5 — one-cell directional conveyors (implementation; acceptance pending)

- The user reports automatic turns still fail and requested one-cell tiles,
  oriented by view, transferring into the tile ahead irrespective of its direction.
  This deliberately supersedes the two-cell automatic menu behavior below. R adds
  a manual quarter turn; the green preview and yellow marker show the tile's
  selected output direction. Existing legacy models are retained internally.
- The application transfers to adjacent one-cell belts, including side input,
  opposite directions, fan-in and cycles; multiple inputs are arbitrated. A Miner
  connects to one adjacent lane at its output; terminals accept the two lanes at
  their input. Full receivers block; open ends drop items into the world where E
  can collect them, without deleting them when the inventory is full.
- `npm run verify` passes: 577 tests in 54 files, typecheck, build and server
  verification. Automated tests cover occupied placement, cycles, opposite directions,
  generated-world Miner, terminal backpressure and Three.js bounds. Ramps are
  checked in all four directions, both elevations and all destination headings,
  including continuous item positions and Miner-to-terminal delivery. Browser/WebGL and player acceptance are
  **not yet verified**. Phase 5 remains open and Phase 6 has not started.
- Adjacent cells now plan ascending decks and descending entry ramps inside their
  footprints. Side and opposite entries follow the entry segment at belt speed;
  placement previews show affected neighbours. Adjacent support heights and deck
  rise are limited to one grid cell, otherwise placement is refused. Existing items
  are safely projected or the topology change is rejected if unsafe.
- Limitations: ground items are session-only, unstacked and unbounded in number.
  Old two-cell belts do not connect to one-cell belts; only the new belt is in the
  construction menu. Player collision still uses the building's box, not the
  exact ramp surface. Real browser play and slope behavior need validation.

## Phase 5 — turn preview follow-up (in progress)

- The user still reports that material routes do not turn and asks to see the
  turn before placement. Previously only the candidate was previewed: the
  existing belt that becomes a curve was still shown straight. The validator now
  returns the changed existing belt shapes, which are displayed as green ghosts
  with cyan inputs and yellow outputs; the real belts and items do not change
  until confirmation. Invalid placements show no hypothetical neighbour changes.
- Partially edge-aligned automatic belts snap to an unambiguous adjacent belt
  centre; overlapping footprints and ambiguous contacts are not auto-aligned.
  Confirmation applies the same validated plan rather than resolving it again.
  Tests cover both turn directions, all four rotations, items already in motion,
  slopes, cancellation, and one generated-world Miner. Actual WebGL/user retest
  remains necessary; these tests do not identify every possible reported layout.
  `npm run verify` passes: 510 tests in 51 files, plus typecheck, build and
  server checks.

## Phase 5 — open-ended conveyor fix (in progress)

- The user reports conveyors saying DISCONNECTED despite being oriented correctly,
  and requests one conveyor that adapts to neighbours. A demonstrated cause was
  that routes ran only with both a source and a terminal, even when the input and
  neighbouring belts were connected. Source-connected routes now run without a
  terminal; items queue at the open end, which reports BLOCKED, and resume when a
  receiver is attached. Routes without a connected source remain DISCONNECTED and
  retain their items. Ports still require exact position, height and direction;
  this addresses the demonstrated case, not necessarily every reported layout.
  Typecheck, test, build and verify passed; 452 tests in 50 files.
- The construction menu now offers one automatic conveyor: neighbouring tiles
  resolve into straight, left/right turns and rising or falling paths, with shared
  preview/render/simulation geometry. Lines remain linear and acyclic; branching,
  loops, unsupported height changes and mixed legacy/automatic neighbours are
  rejected. Sideways placement now turns even the first isolated tile, and live
  items can be projected onto the new path and its successor. The proposed layout
  is rejected only when item spacing or capacity cannot be preserved. Item IDs and
  clocks remain stable; visible positions can jump at the instant of reshaping.
  Legacy definitions remain available internally. Physical user validation of
  the new behaviour and the brighter daytime visuals is pending. `npm run verify`
  passes: 487 tests in 51 files, plus typecheck, build and server checks.
- This version has not been checked in real WebGL or physically by the user;
  use the revised manual checklist. Phase 5 remains in progress.

## Phase 5 — Conveyor foundation (in progress, 2026-11-11)

- The merged baseline was an isolated conveyor prototype, not a playable path.
  This branch integrates it into construction, the game loop, machine inventory,
  rendering and interaction. Phase 4 was accepted by the user for proceeding
  with its browser verification still pending.
- The construction menu exposes one automatic conveyor and a minimal
  receiving terminal (each 4 stone and 2 wood). R rotates, C places repeatedly
  for all buildings, Escape exits before interaction/demolition; invalid, disconnected and connected preview feedback
  shares the authoritative placement validator. Ports are directional and
  height-matched; mismatched connections and loops are rejected before payment.
  Miner placement now validates adjacent ports even when the belt was placed first.
  A source-connected open end now queues items; losing the source freezes that
  disconnected section without discarding them.
- A foundation may support a whole logistics footprint; removing a loaded
  foundation is refused. Otherwise placement follows terrain slope/variation
  limits, permits at most 0.12 m terrain penetration, and allows a connected
  elevated connected legacy end up to 2 m above terrain. Automatic tiles follow
  adjacent supports with at most one cell of height difference; no lift system exists.
- Stable building IDs link a real Miner output inventory, belt segments and a
  one-slot, configurable, inspectable terminal. Partial player retrieval conserves
  remainders; occupied belts, non-empty miner/terminal inventories and refunds
  that cannot fit block demolition. Shared additive guards preserve all checks.
- Fixed-step transport uses the existing prototype's one-input/one-output acyclic
  routes, 1 m/s speed, 60 items/minute and 0.5 m spacing by default, with
  downstream blockage and recovery. Rendered instances interpolate logical
  positions; cyan input and yellow output markers, shapes and state lamps are
  presentation only. Modal panels pause production/transport. DISCONNECTED,
  IDLE, RUNNING and BLOCKED are assigned; INVALID and ERROR are reserved, not
  currently runtime states (invalid placement has explicit feedback).
- **Automated:** typecheck, test, build and verify pass: 410 tests in 46 files
  after the usability follow-up (the earlier integrated baseline had 402 / 45).
  Coverage includes a real Miner → straight → curve → incline → terminal,
  conservation, full/recovery, disabled source, removal, terrain support,
  construction/UI and bootstrap (mock renderer), and Three.js scene graph tests.
  Added rotation, placement-order, repeated topology rebuild, 300-second blocked/recovery,
  instanced growth and real-bootstrap modal regression coverage. These do not
  demonstrate browser/WebGL, pointer lock or actual usability.
- **Headless real-browser check:** Chromium 143 on Debian, WebGL 2 with
  SwiftShader. The agent built NSS/NSPR from Mozilla source in temporary storage
  to launch it; no project dependency changed. Using actual UI inputs, it gathered
  resources, placed Miner → straight → right curve → incline → terminal, saw
  transport and terminal receipt, and inspected the endpoint. Pointer lock released
  and restored around construction in a separate run; the gameplay automation used
  drag-look fallback. DevTools was used to observe, not mutate, logical state.
- In that browser, a full 24-slot player inventory with 95 iron retrieved exactly
  5 of 9 terminal iron, leaving 4. The terminal later reached 100; all three belt
  segments reported BLOCKED, terminal demolition was refused, and after retrieval
  flow resumed (13 items received). A 4-second terminal modal held item positions
  and inventories unchanged. No page errors occurred; Three.js logged its existing
  PCFSoftShadowMap fallback warning.
- **User-reported manual feedback (merged Phase 5 build):** basic controls and
  UI, inventory quantities/splitting/full behavior, construction/rotation/invalid
  placement and a foundation were reported working. The disconnected preview
  hint was not noticed. The user could not locate iron, so the iron-dependent
  chain and remaining acceptance checks were not completed. The only reported
  console warning was the Three.js soft-shadow fallback. These are user reports,
  not additional agent-executed tests.
- **Follow-up:** deposits have per-resource coloured aura rings and terrain-sampled
  ground traces, without changes to logical generation, collision or harvesting.
  All building selections persist for repeat placement; Escape cancels before E/F.
  Renderer selects PCFShadowMap directly, matching Three.js's prior fallback.
  Scene graph and mocked-renderer tests cannot establish visual legibility or
  absence of console warnings in a real browser; both still require user retest.
- **Physical/user acceptance remains pending.** The headless run used one layout,
  synthetic input and software rendering; it is not a manual usability assessment.
  Other rotations, foundation interaction, invalid-payment behavior, belt/miner
  demolition and disable/re-enable were not browser-tested. Follow
  `docs/PHASE_5_MANUAL_ACCEPTANCE.md` and report results. Phase 5 is **not complete
  or accepted**; no Phase 6 scope has been started.
- Limits: only linear acyclic networks; no splitters/mergers or save/load. State
  ERROR is not detected/recovered. Tests do not prove universal non-overlap or
  absence of loss under all configurations. Large time steps can under-run nominal
  throughput; standard game simulation uses fixed 50 ms steps. Disconnected items
  cannot be manually collected from belts and must be reconnected before removal.

---

## Phase 4 — Miner Mk.1 (2026-11-11)

- The user reports Phase 3 construction, preview and demolition were manually
  tested. This is a user report, not an agent-run browser acceptance.
- The construction menu includes Miner Mk.1 (originally 20 iron ore, 10 stone, 10 wood; now 10 stone and 10 wood).
  Its 2 × 2 m default footprint snaps to the construction grid. Preview and
  placement use the same terrain, slope, bounds, player, obstacle and cost
  validator, additionally requiring exactly one compatible deposit centre inside
  the footprint. Only that deposit's collider is exempt. Assignment is by stable
  session ID; a second miner cannot claim it. Placement pays atomically.
- Fixed-step extraction is 30 items/min at normal purity; existing purity
  multipliers 0.5/1/2 give 15/30/60 by default. Deposits are infinite. Each miner
  owns a configurable slot inventory (one 100-item raw-resource stack by default).
  Capacity blocks production without accumulating blocked work; fractions survive
  disable, unavailable deposit and existing full output. A partial retrieval moves
  only what fits. Demolition is refused until output is empty, and then refunds
  the entire construction cost or fails if that refund cannot fit.
- Machine inspection via E displays actual state, purity, output, capacity, rate,
  progress and temporary power policy. Enable/disable and retrieve act on the
  logical machine. All modal panels suspend gameplay and production; closing tries
  the existing pointer-lock restoration. Extraction uses fixed simulated time,
  not wall-clock catch-up; an explicitly paused game does not produce. Hidden-tab
  behavior follows the browser scheduler and the existing bounded catch-up policy.
- Temporary power policy: electricity is **not required** in Phase 4. NO_POWER is
  reserved for future power integration; no free power network is simulated.
  The state-driven procedural indicator distinguishes running, idle, disabled,
  full, missing input and error. The machine and preview rendering are separate
  from logical state and dispose their resources when removed.
- Tests exercise purity/rates, fractional progress, capacity and recovery,
  transfer conservation, shared validation, generated-deposit placement,
  demolition, real fixed-step frame partitioning/pause, UI and bootstrap flow.
  Bootstrap coverage uses a mocked renderer, not WebGL.
- `npm run typecheck`, `npm test`, `npm run build` and `npm run verify` passed:
  **353 tests in 39 files**, plus build, preview and dev-server checks.
- **Browser acceptance remains pending.** The earlier Chromium attempt failed on
  missing NSS/NSPR libraries at that time. A later Phase 5 headless run covered
  portions of Miner operation and pointer lock, but not full Phase 4 acceptance.
  Physical usability has not been agent-verified.
  No conveyors, recipes, power network, saves or Phase 5 work are included.

---

## Phase 3 — Building and placement (2026-11-11)

- The continuation began with a standalone registry, grid transform, building
  model, inventory exchange and rendering consumer; none was connected to play.
  The baseline passed 324 tests in 30 files.
- `World` owns the building model using the player's inventory. The initial
  structural foundation is 2 × 2 one-metre grid cells, 0.4 m tall and costs 10
  stone and 5 wood. IDs are unique for the world session, not saved on reload.
- Q opens the construction menu. Selecting an affordable foundation enters
  placement; aim at ground within 6 m, R rotates 90°, C confirms, Escape cancels.
  F demolishes a targeted registered building. Menus suspend gameplay input and
  pause player physics; opening a menu also clears horizontal momentum.
- Preview and confirmation share snapped transforms and the same validation:
  full terrain/circular world bounds, terrain support and slope, natural obstacle
  and deposit collision, other buildings, player footprint and resources. The
  production heightfield is checked by clipping all intersecting triangles; generic
  `TerrainQuery` implementations fall back to finite samples. Terrain variation
  is limited to 0.12 m. Foundation height is adjustable with Page Up/Down in
  0.1 m steps, up to 0.3 m below the highest terrain point, or above ground.
  Adjacent foundations snap edge-to-edge and inherit a neighbour's base height;
  the height adjustment resets after successful placement. Aim still targets ground
  within 6 m; all existing slope, overlap and resource checks remain in force.
  Automated coverage includes burial limits, alignment, floating support and UI
  keys; hands-on browser acceptance of this new workflow remains pending.
- The fixed-step stage consumes queued placement/demolition presses. Inventory
  exchange is all-or-nothing. Demolition refunds all original materials or fails
  without removing the building if they cannot all fit. Rendering and collision
  consume the logical registry; removed buildings disappear on the next frame and
  immediately leave collision/ground queries. Preview meshes are separate.
- Building collision uses conservative capsule-expanded rectangles (square
  corners), composed with the existing natural-obstacle sweep. Foundation tops
  supply player ground. Extremely complex intersecting contacts can conservatively
  stop movement. Demolition ray targeting does not test terrain/prop occlusion,
  consistent with the existing interaction system's known limitation.
- `npm run typecheck`, `npm test`, `npm run build` and `npm run verify` passed;
  **335 tests across 34 files**, plus build, preview and dev-server checks. The mocked-renderer bootstrap
  test exercises menu, selection, rotation, placement, demolition and refund; it
  is not a real browser/WebGL test.
- **Browser acceptance remains pending.** The previous isolated Chromium launch
  failed due to missing NSS/NSPR libraries; this continuation did not repeat the
  unchanged launch. The agent did not verify WebGL, pointer lock, or Phase 2.1 UX
  in a real browser. This was the historical Phase 3 status.

---

## Phase 2.1 — Inventory UX improvements (2026-11-11)

- The user reports that the earlier Phase 2 browser acceptance passed overall for
  terrain, movement/collision, resources, interaction, inventory opening/stack
  operations and modal input isolation. The user also reports that a completely
  full inventory had not yet been manually tested. This is a user report, not a
  browser run by this agent.
- Inventory slots now use native drag-and-drop: empty destination moves a stack,
  compatible destination merges up to the stack limit, incompatible occupied
  destination swaps atomically. Selection is inspection only; outside drops cancel,
  and a changed inventory revision cancels stale drags. Half-stack split remains.
- Opening inventory remembers whether the game held pointer lock and releases it.
  Closing through Tab, Escape or the close button synchronously requests recapture
  only if it was previously held. If the browser denies that request, the existing
  click-to-capture / drag-look fallback remains. Browsers do not permit scripts to
  reposition the physical cursor, so recapture uses relative pointer movement.
- New tests cover moves, partial merges, swaps, cancelled/stale drags, selection,
  pointer-lock restoration and rejection, a full 24-slot inventory, gathering
  with no capacity, and gathering across multiple partial stacks with remainder.
  `npm run typecheck`, `npm test`, `npm run build`, and `npm run verify` passed:
  **314 tests in 27 files**. Existing click-to-move UI test was updated because
  that behavior was intentionally replaced by drag-and-drop.
- The agent did **not** perform browser-level verification of these changes:
  at that time headless Chromium lacked NSS/NSPR system libraries. The later
  Phase 5 headless run covered a stack merge and construction-menu pointer-lock
  restoration, but not the full Phase 2.1 acceptance. Verify
  native drag-and-drop (including cancelling outside the panel), split/merge/swap,
  pointer-lock restore and denial fallback, and full/partial gathering in a real
  browser. Native HTML drag-and-drop has no dedicated keyboard move alternative.
- No Phase 3 systems were implemented.

---

## Phase 1 repository inspection (historical)

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
- At that point inventory and resources were absent; Phase 2 now adds them.
  Buildings, machines, power and saves remain out of scope.

---

## Phase 2 — Resources and inventory (2026-11-11)

Historical implementation notes: the user subsequently reported the original Phase
2 browser checks passed overall. Full-inventory behavior was not manually checked,
and the new Phase 2.1 UX requires its own browser verification.

- Central registry: six raw resources, unique IDs, descriptions, icons and stack
  limits; no water item. The solid slot inventory is renderer-independent and
  supports partial add/remove/transfers, quantity/capacity queries, move, split
  and merge. Every operation validates before mutation and reports quantities.
- Historical Phase 2: 24 configurable inventory slots and 5 configurable units per deposit-gathering press. This loop has since been replaced; see voxel transition above. Purity now affects Miner extraction.
- Seeded deposits form a starting iron cluster and five exploration clusters;
  they query terrain, avoid existing obstacles, other deposits and the spawn, and
  carry their own logical IDs, purity and extraction metadata. Solid deposit
  colliders reuse `ObstacleField` and Three.js meshes consume deposit data.
- The existing interaction system handles targeting and edge-triggered interaction;
  partial/full results for finite starter resources appear in its feedback. Inventory opens with Tab, closes
  with Tab/Escape/button, and supports slot selection, inspection, moving,
  merging and half-stack splitting. Modal input clears held/queued actions and
  releases pointer lock; Phase 2.1 now attempts to restore previous capture.
- `npm run typecheck`, `npm test`, `npm run build`, `npm run verify` all passed:
  **299 tests in 27 files**, including the real bootstrap with mocked WebGL, seeded
  generation across 20 seeds, registry/inventory conservation, targeting and
  gathering, modal input, rendering scene graph, and Phase 1 regressions. Build
  generated 4.03 kB HTML, 7.90 kB CSS and 606.09 kB JS (uncompressed).
- Additional collision check: 500 repeated steps against adjacent cylinders and
  moving away passed. No physics changes were needed beyond the existing merged
  fix. This does not prove stability for all configurations.
- Known placement limits: generation is best-effort with bounded attempts; very
  constrained configurations can produce fewer deposits than requested, and a
  per-position slope/spacing check does not prove paths are reachable. Interaction
  still has no line-of-sight occlusion. Deposits are infinite and inventory does
  not persist between reloads; both are intentional for this phase.
- Remaining browser checks for the new changes are listed in the Phase 2.1 section.

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

## Phase 1 verification (historical, 2026-11-11)

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
  `7721918068`, on merge `8d30fbd`, succeeded. Phase 2 was subsequently merged; deployment of this Phase 2.1 work has not been verified.

---

## Known Issues and Limitations

1. **No browser verification by this agent for Phase 2.1.** The user reports the
   earlier Phase 2 browser acceptance passed overall, except full-inventory testing.
   New drag-and-drop and pointer-lock restoration need a real-browser pass.
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
7. **No save system or power network** — by design. Machines, buildings and inventory exist in memory only.
8. **Source maps (~3.27 MB) ship with the production build** for debuggability.
9. **Collision bounds:** a deeply embedded spawn or pathological intersecting
   cylinder cluster may need a noticeable depenetration correction or remain
   overlapped. Remaining movement is conservatively stopped when the bounded
   search/contact iterations cannot resolve it. Vertical cylinder overlap is
   sampled at the start of each fixed step, not continuously swept in 3D.
10. **Terrain slope relaxation** is bounded and axis-neighbour based; it does not
    prove every triangle meets the configured walkable-slope limit.

---

## Next Recommended Task

Complete Phase 5 physical/user acceptance, including remaining placement,
connection, demolition and recovery scenarios. A subset passed headless browser
automation as described above; repeat it for actual usability. Also verify the
outstanding Phase 4 and earlier browser checks. Fix findings and
complete CI, protection, PR and deployment checks before declaring acceptance.
Do not start Phase 6 without authorization.

---

## Development Notes

- Documentation is the source of truth; update this file, `CHANGELOG.md`, the
  roadmap tracker and architecture appendices after every task.
- Never mark a phase complete based on visual appearance or unexecuted checks.
- Run `npm run verify` before declaring a task complete.
