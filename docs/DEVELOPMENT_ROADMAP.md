# FACTORY FRONTIER — DEVELOPMENT ROADMAP

**Document type:** Development Roadmap
**Version:** 2.0 (Phase 0 split of the master specification)
**Status:** Canonical roadmap source of truth

> This document is the roadmap section (§24–§26) of the Factory Frontier master
> specification v2.0, preserved verbatim from the former monolithic `README.md`.
> Live progress is tracked per checklist in `PROJECT_STATUS.md`; the phase text
> here always remains the authoritative definition of scope and acceptance.

---

## PROGRESS TRACKER

**Last updated:** 2026-11-11
**Current phase:** Phase 7 integration and acceptance; route editor play-test pending; Phase 5 acceptance incomplete

The user explicitly authorized the next step after confirming in-game miner →
conveyor → terminal transport, turns/slopes without item loss, and blockage/recovery.
Other Phase 5 checklist scenarios were not explicitly confirmed. Starting the
smelter slice before full Phase 5 acceptance is a user-directed exception to the
existing Phase 5 gate below; it does not mark that phase accepted or complete.
The user reported everything works after the Phase 6 complete-chain play-test was requested, and explicitly asked to proceed. The Phase 6 chain is user-validated; this does not establish acceptance of every Phase 5 scenario. Phase 7 includes storage, splitter modes, a fair merger and bounded upward/downward lifts. The user reports that all previously playable additions work after testing; this is a global report, not individual scenario evidence. The new bounded control-point route editor was added afterwards. The user reported that requiring an existing destination prevented incremental construction; open-ended routes and continuation have now been added and still require player retesting. Arbitrary lift heights remain unimplemented, so Phase 7 acceptance remains pending.
At the user's request the smelter now directly consumes coal (1 per iron ingot);
this is an early fuel exception, not the Phase 8 electrical power network. The
user subsequently reported testing without specifying results. A user-requested,
session-only creative construction toggle bypasses building costs but does not
bypass placement rules or machine inputs; the user confirmed it works. It is a testing aid, not a new phase.

The voxel transition is underway within Phase 5: finite starter resources and a
no-iron first Miner and block-style models for current world objects are implemented;
physical browser acceptance remains pending. This explicitly replaces the earlier
direct deposit-gathering loop to avoid mining terrain blocks.

The phase definitions below are authoritative; earlier dated progress notes are historical and superseded by this tracker where they describe current status. This tracker only records status;
detailed evidence and verification results live in `PROJECT_STATUS.md`.

| Phase | Status | Notes |
|---|---|---|
| 0 — Repository inspection and foundation | ✅ Implementation complete | Toolchain, core architecture, render loop, foundation scene, tests, Pages build; user reports later browser checks passed overall |
| 1 — Playable 3D environment | 🟡 Acceptance pending | Deterministic terrain, movement, collision and interaction implemented; user reports later browser checks passed overall |
| 2 — Resources and inventory | 🟡 Acceptance pending | Registry, deposits and inventory implemented; user reports earlier browser checks passed overall; 2.1 drag/drop, pointer lock and full-inventory browser checks remain |
| 3 — Building and placement | 🟡 Acceptance pending | Construction menu, preview, validation, grid, rotation, registration and demolition implemented; real-browser acceptance pending |
| 4 — First automated extractor | 🟡 User accepted | Browser verification remains pending |
| 5 — Conveyor foundation | 🟡 Partially user-validated | User confirmed miner → terminal, turns/slopes, blockage and recovery; remaining checklist not confirmed |
| 6 — First production chain | ✅ User validated | Coal-fueled smelter, constructor and plates implemented; user reports everything works after complete-chain test request |
| 7 — Advanced logistics | 🟡 Acceptance pending | Previous playable logistics additions user-validated globally; route correction, elevated platform alignment and adjustable 1–8 m lifts need player testing; heights outside that range remain unimplemented |
| 8 — Electricity | ◻ Planned | — |
| 9 — Advanced manufacturing | ◻ Planned | — |
| 10 — World expansion | ◻ Planned | — |
| 11 — Progression | ◻ Planned | — |
| 12 — Persistence | ◻ Planned | — |
| 13 — Polish and optimization | ◻ Planned | — |

---

# 24. DEVELOPMENT ROADMAP

The project must be developed through clearly separated milestones.

Do not skip foundational milestones.

## PHASE 0 — Repository inspection and foundation

Objectives:

- Inspect the repository.
- Configure TypeScript.
- Configure Vite.
- Install and configure Three.js.
- Establish the main application structure.
- Configure GitHub Pages compatibility.
- Create the central Game class.
- Create the rendering loop.
- Create a basic scene.

Acceptance criteria:

- Project builds successfully.
- Game loads in a browser.
- Three.js scene renders.
- No critical console errors.
- GitHub Pages base path is configured correctly.

## PHASE 1 — Playable 3D environment

Objectives:

- Basic terrain.
- First-person camera.
- Mouse controls.
- Player movement.
- Gravity.
- Collisions.
- Interaction raycasting.
- Basic lighting.
- Initial environment.

Acceptance criteria:

- Player can explore the environment.
- Camera controls work.
- Player cannot fall through terrain.
- Interactions detect the correct objects.

## PHASE 2 — Resources and inventory

Objectives:

- Item registry.
- Inventory system.
- Resource deposits.
- Manual gathering.
- Resource visualization.
- Basic HUD.

Acceptance criteria:

- Player can gather resources.
- Resources appear in inventory.
- Inventory capacity is respected.
- Invalid transfers are rejected.

## PHASE 3 — Building and placement

Objectives:

- Construction menu.
- Building preview.
- Placement validation.
- Rotation.
- Grid snapping.
- Building registration.
- Basic demolition.

Acceptance criteria:

- Player can place buildings.
- Buildings have persistent logical IDs.
- Invalid placements are prevented.
- Buildings remain in the correct position.

## PHASE 4 — First automated extractor

Implementation and automated coverage complete; real-browser acceptance remains pending.

Objectives:

- Miner Mk.1.
- Resource deposit detection.
- Automated extraction.
- Output inventory.
- Machine states.
- Machine inspection interface.

Acceptance criteria:

- Miner extracts resources automatically.
- Production respects extraction rate.
- Output capacity is respected.
- No items are created when output is blocked.

## Voxel transition (cross-cutting, user-requested; in progress)

The user has directed a change from smooth terrain to non-destructible blocks,
with trees/branches/loose stones for initial resources and block-style machines.
Do not silently declare earlier phases accepted or remove the Phase 5 criteria.
Proceed in independently verified steps: (1) immutable voxel data and exposed
faces, (2) actual world integration with swept block-side collisions, jumping,
landing and safe construction support, (3) the initial resource loop and visuals,
(4) full regression plus real-browser and user acceptance. The transition
now includes integrated terrain, wall collisions, placement checks, starter
resources and block-style current models. Browser and user acceptance remain pending.
Chunks, persistence and terrain editing are not included in the current step.

Construction now confirms with left click rather than C; hands-on input acceptance remains pending.
The four selectable building models have a block-style detail refresh; user visual acceptance remains pending.
The Q menu now includes model-based building thumbnails; browser acceptance remains pending.
Foundation placement has adjustable burial and elevation with neighbour alignment;
partial coplanar overlap can fill platform gaps and elevated aiming can extend
platforms. The user confirmed the current foundation placement is superb. This does not complete Phase 5.

## PHASE 5 — Conveyor foundation

The user reports disconnected belts and requests a single self-adapting
conveyor. A source-connected open line now runs and queues at its open end;
other possible user layouts still need real-browser verification. The construction menu now provides a single automatic conveyor with straight,
left/right and ascending/descending routing; topology stays linear and acyclic.
Automated coverage is present; browser and user acceptance remain pending.
Branches and mergers remain Phase 7 scope.

The new preview follow-up displays the changed existing belt as well as the
candidate and aligns unambiguous partial edge contacts. The reported in-game
turn issue still requires a real browser/player retest.

The turn follow-up preserves an isolated tile's inlet on sideways placement and
projects live items transactionally when a path changes. Conveyor presentation and
daylight palette were also updated at the user's request; WebGL and physical user
acceptance are still pending. No Phase 6 or Phase 7 systems were added.

Status: integration implemented and automated checks pass (410 tests / 46 files after the usability follow-up),
and a real headless Chromium WebGL path/blockage run passed. The user reported
basic controls, inventory and construction working but could not find iron; a
follow-up adds deposit markers and repeat placement for all buildings. Physical/user
acceptance of the markers and remaining chain scenarios remains pending. The previous prototype alone
was not playable. INVALID/ERROR runtime handling remains reserved, not implemented.
See `docs/PHASE_5_MANUAL_ACCEPTANCE.md` for pending real-browser checks.
Do not advance to Phase 6 until Phase 5 is accepted and explicitly authorized.


Objectives:

- Conveyor placement.
- Conveyor paths.
- Straight segments.
- Curves.
- Inclines.
- Item movement.
- Machine connections.
- Conveyor throughput.

Acceptance criteria:

- Miner output can connect to a conveyor.
- Items move along the conveyor.
- Items reach the destination.
- Items stop when the destination is blocked.
- Items never overlap or disappear.

## PHASE 6 — First production chain

Objectives:

- Smelter.
- Iron Ingot recipe.
- Constructor.
- Iron Plate recipe.
- Machine input and output connections.
- Production simulation.
- Production UI.

Acceptance criteria:

The following complete chain must work:

Iron Deposit  
→ Miner Mk.1  
→ Conveyor  
→ Smelter  
→ Conveyor  
→ Constructor  
→ Iron Plates.

The player must not need to manually move resources once the chain is configured.

## PHASE 7 — Advanced logistics

Objectives:

- Splitters.
- Mergers.
- Conveyor lifts.
- Storage containers.
- Multiple production lines.
- Advanced conveyor routing.

Acceptance criteria:

- Multiple machines can share a logistics network.
- Splitters distribute items correctly.
- Mergers combine input streams.
- Storage limits are respected.

## PHASE 8 — Electricity

Objectives:

- Power poles.
- Power networks.
- Biomass Generator.
- Fuel consumption.
- Machine energy consumption.
- Power statistics.

Acceptance criteria:

- Machines operate when powered.
- Machines stop when power is unavailable.
- Power statistics are accurate.
- Connected networks update correctly.

## PHASE 9 — Advanced manufacturing

Objectives:

- Assembler.
- Foundry.
- Additional recipes.
- Advanced components.
- Production statistics.

Acceptance criteria:

- Multi-input recipes work.
- Production chains can contain multiple stages.
- Bottlenecks are visible.
- Production remains consistent over time.

## PHASE 10 — World expansion

Objectives:

- Procedural generation improvements.
- Biomes.
- Resource distribution.
- Chunk streaming.
- Environmental diversity.

Acceptance criteria:

- Different seeds generate different worlds.
- Chunks load and unload correctly.
- Factory modifications remain persistent.

## PHASE 11 — Progression

Objectives:

- Milestones.
- Technology tree.
- Unlock requirements.
- New machines.
- New resources.
- Progression interface.

Acceptance criteria:

- Locked content cannot be used.
- Milestones consume the correct items.
- Rewards are granted exactly once.
- Progress persists after reloading.

## PHASE 12 — Persistence

Objectives:

- IndexedDB.
- Automatic saves.
- Manual saves.
- Save versioning.
- World restoration.

Acceptance criteria:

- Complete factory can be restored.
- Machine inventories persist.
- Conveyor connections persist.
- Player progression persists.
- No duplicate buildings appear after loading.

## PHASE 13 — Polish and optimization

Objectives:

- Visual improvements.
- Audio.
- UI refinement.
- Performance optimization.
- Bug fixes.
- Browser compatibility.
- Deployment validation.

Acceptance criteria:

- No critical gameplay bugs.
- Stable performance in representative factory scenarios.
- GitHub Pages deployment works.
- Save and load are reliable.

---

# 25. DEFINITION OF DONE

A feature is considered complete only when all relevant requirements are met.

### Functional

- Its gameplay logic works.
- Its inputs and outputs are correct.
- Its edge cases are handled.
- It integrates with existing systems.

### Visual

- Its 3D representation is correct.
- Its visual state matches its logical state.
- Its interface is understandable.

### Technical

- No unnecessary duplicated code.
- No broken dependencies.
- No critical console errors.
- No obvious memory leaks.
- Existing functionality remains operational.

### Persistence

If the feature changes persistent game state, it must be correctly serialized and restored.

### Testing

The feature must have been tested.

Never claim successful testing without actually executing the tests.

---

# 26. FINAL DEVELOPMENT DIRECTIVE

The objective is to create a complete and extensible factory automation game.

Do not prioritize the number of features over the quality of their implementation.

A small, fully functional factory is more valuable than a huge environment filled with non-functional machines.

The most important technical foundations are:

1. A stable 3D environment.
2. A reliable entity and building system.
3. A correct inventory system.
4. A deterministic industrial simulation.
5. A genuinely functional conveyor network.
6. A modular machine and recipe architecture.
7. A persistent save system.

Every new feature must integrate with these foundations.

**The first major gameplay objective is to create a fully functional automated iron production line.**

Do not begin implementing every planned system simultaneously.

Start by inspecting the repository, establishing the technical foundation, and implementing Phase 0.

Once Phase 0 is complete, proceed incrementally through the roadmap.

The final result must be a coherent, playable, persistent, and scalable 3D factory automation game.

### Phase 5 — one-cell conveyor redesign

One-cell, look-oriented tiles and transfer into the belt ahead irrespective of its
heading are implemented, with ground drops and pickup. Automated coverage includes
turns, fan-in, cycles, Miner, terminal and backpressure. Complete real-browser and
player acceptance, including ramp presentation and terrain. Do not advance
to Phase 6 without Phase 5 acceptance and explicit authorization.

### Phase 5 — player feedback iteration

Turn skins, four-sided cell terminal intake, E pickup of moving belt items, and
additional starter resources are implemented for testing. Phase 5 remains in
progress until the player validates the scenarios; do not start Phase 6.

The Phase 5 receiving terminal now displays inventory slots and building collision
recovers from overlapping contacts. The terminal still has one slot and no upgrade
system; in-game validation of both changes and Phase 5 acceptance remain pending.

Phase 5 feedback: directional cells and terminals recover covered dropped items;
the terminal shows both inventories. Re-test in the actual game before acceptance.
