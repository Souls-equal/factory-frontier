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
**Current phase:** Phase 3 implemented; browser acceptance pending

The phase definitions below are authoritative. This tracker only records status;
detailed evidence and verification results live in `PROJECT_STATUS.md`.

| Phase | Status | Notes |
|---|---|---|
| 0 — Repository inspection and foundation | ✅ Implementation complete | Toolchain, core architecture, render loop, foundation scene, tests, Pages build; user reports later browser checks passed overall |
| 1 — Playable 3D environment | 🟡 Acceptance pending | Deterministic terrain, movement, collision and interaction implemented; user reports later browser checks passed overall |
| 2 — Resources and inventory | 🟡 Acceptance pending | Registry, deposits and inventory implemented; user reports earlier browser checks passed overall; 2.1 drag/drop, pointer lock and full-inventory browser checks remain |
| 3 — Building and placement | 🟡 Acceptance pending | Construction menu, preview, validation, grid, rotation, registration and demolition implemented; real-browser acceptance pending |
| 4 — First automated extractor | ◻ Planned | — |
| 5 — Conveyor foundation | ◻ Planned | — |
| 6 — First production chain | ◻ Planned | — |
| 7 — Advanced logistics | ◻ Planned | — |
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

## PHASE 5 — Conveyor foundation

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
