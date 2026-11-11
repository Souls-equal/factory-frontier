# FACTORY FRONTIER — GAME DESIGN DOCUMENT

**Document type:** Game Design Document
**Version:** 2.0 (Phase 0 split of the master specification)
**Target platform:** Desktop web browser (WebGL2)
**Status:** Canonical design source of truth

> This document is the design section (§0–§19) of the Factory Frontier master
> specification v2.0. During Phase 0 the former monolithic `README.md` was split
> into `docs/GDD.md`, `docs/TECHNICAL_ARCHITECTURE.md` and
> `docs/DEVELOPMENT_ROADMAP.md` exactly as `ARENA_RULES.md` mandates. The text
> below is preserved verbatim; only document metadata was added.

---

# 0. MASTER INSTRUCTIONS FOR THE AI DEVELOPER

You are the lead game developer, technical architect, gameplay programmer, and 3D systems engineer responsible for developing Factory Frontier.

Your objective is to build a complete, playable, 3D factory automation game inspired by the core gameplay principles of games such as Satisfactory.

This project must not be treated as a simple visual prototype.

The game must contain real gameplay systems, functional industrial simulation, meaningful progression, persistent construction, and a scalable technical architecture.

## 0.1 Core development principles

Follow these principles throughout the entire project:

1. Functionality always takes priority over decorative visuals.
2. All gameplay mechanics must be genuinely functional.
3. Never implement visual representations of systems that do not actually work.
4. Never simulate industrial production using arbitrary visual animations alone.
5. Separate gameplay logic from rendering logic.
6. Build reusable and modular systems.
7. Avoid unnecessary complexity when a simpler architecture is sufficient.
8. Preserve existing working functionality when adding features.
9. Do not introduce unnecessary dependencies.
10. Optimize systems for large factories and long gameplay sessions.

## 0.2 Development behavior

Before modifying any existing code:

- Inspect the repository.
- Understand its architecture.
- Identify existing systems.
- Identify dependencies between systems.
- Check whether the requested functionality already exists.
- Plan the implementation before changing files.

Never blindly rewrite existing systems.

Never delete working functionality simply because a new implementation seems easier.

When encountering architectural problems, explain the issue and implement the smallest appropriate structural improvement.

## 0.3 Implementation strategy

Do not attempt to implement the entire game in one development operation.

Work progressively through the development phases defined in this document.

Each phase must result in a working, testable version of the game.

Do not move to the next major phase while critical functionality from the previous phase is broken.

At the end of each phase, provide:

- Features implemented.
- Files created or modified.
- Architectural decisions.
- Tests performed.
- Known issues.
- Remaining tasks.

**Important:** The final objective is a coherent game, not a collection of disconnected features.

---

# 1. GAME OVERVIEW

## 1.1 Game concept

Factory Frontier is a first-person, 3D, open-world factory automation game.

The player arrives on an unexplored planet rich in natural resources.

Their objective is to establish an industrial infrastructure, extract natural materials, transform them into increasingly advanced components, and build massive automated production facilities.

The player begins with basic equipment and limited technology.

As the game progresses, they unlock increasingly sophisticated machinery, transportation systems, energy sources, and manufacturing processes.

The central gameplay experience revolves around designing, constructing, optimizing, and expanding automated production networks.

## 1.2 Main gameplay pillars

The game is built around seven fundamental pillars.

### A. Exploration

Explore a large environment containing:

- Different biomes.
- Natural resource deposits.
- Mountains and valleys.
- Rivers and lakes.
- Forests.
- Caves and underground areas.
- Interesting geographical formations.

Exploration should provide meaningful reasons to expand beyond the initial starting area.

### B. Resource extraction

Discover natural deposits and establish extraction infrastructure.

Resources must be physically represented in the world and extracted through appropriate gameplay systems.

### C. Logistics

Transport resources between different industrial installations using:

- Conveyor belts.
- Conveyor lifts.
- Pipes.
- Storage systems.
- Distribution machines.

Logistics must be a central gameplay mechanic.

### D. Manufacturing

Transform raw resources into increasingly complex components.

Production chains must involve multiple machines and intermediate products.

### E. Automation

Connect machines together to create autonomous production systems.

Once properly configured, factories should operate without continuous player intervention.

### F. Energy management

Generate, distribute, and consume electricity.

Factories must respect actual energy production and consumption constraints.

### G. Expansion and progression

Unlock new technologies, improve production efficiency, and establish increasingly large industrial networks.

---

# 2. GAME DESIGN PHILOSOPHY

## 2.1 Player freedom

The player should have significant freedom when designing their factory.

Avoid forcing the player into predefined factory layouts.

Allow:

- Horizontal expansion.
- Vertical construction.
- Multiple production floors.
- Elevated conveyor networks.
- Underground infrastructure where appropriate.
- Independent industrial facilities.
- Complex transportation networks.

## 2.2 Meaningful automation

Automation must be rewarding.

The player should gradually move from manually collecting and processing resources to designing systems that perform entire production chains automatically.

## 2.3 Visual clarity

Even large industrial installations must remain understandable.

The player should be able to identify:

- Where resources originate.
- Where they are transported.
- Which machines process them.
- Where products are stored.
- Which machines are inactive.
- Where production bottlenecks occur.

## 2.4 Original identity

Factory Frontier takes inspiration from the factory automation genre.

Do not directly reproduce copyrighted assets, models, textures, sounds, names, maps, interfaces, or proprietary content from other games.

Develop an original visual identity, original machine designs, and original environmental elements.

---

# 3. TARGET PLATFORM AND TECHNOLOGY

## 3.1 Platform

The initial target is desktop web browsers.

Primary compatibility targets:

- Chromium-based browsers.
- Microsoft Edge.
- Google Chrome.
- Firefox where supported.

The game must run without requiring a dedicated launcher.

## 3.2 Technology stack

Use the following technologies unless an existing repository architecture provides a compelling reason to make a change.

| Technology | Responsibility |
|---|---|
| TypeScript | Gameplay and application logic |
| Three.js | 3D rendering |
| Vite | Development server and production build |
| HTML5 | Application structure |
| CSS | User interface styling |
| IndexedDB | Persistent local saves |
| WebGL2 | Primary rendering compatibility |
| WebGPU | Optional future rendering backend |

Do not make WebGPU mandatory.

The game should remain playable on systems supporting WebGL2.

## 3.3 Hosting

The initial deployment target is GitHub Pages.

Requirements:

- Static production build.
- No mandatory backend.
- Correct asset paths under a GitHub Pages subdirectory.
- No dependencies on development-server behavior.
- Persistent saves using browser storage.
- No hardcoded localhost URLs.

Configure Vite's base path appropriately.

The game must work both in local development and when deployed to GitHub Pages.

## 3.4 Browser performance

The game must be designed with browser limitations in mind.

Avoid:

- Excessive draw calls.
- Excessive individual meshes.
- Unnecessary physics calculations.
- Expensive operations every frame.
- Uncontrolled object creation.
- Large synchronous operations on the main thread.

Prefer:

- InstancedMesh.
- Shared geometries and materials.
- Object pooling.
- Spatial partitioning.
- Chunk-based loading.
- Fixed-timestep simulation.
- Efficient save serialization.

---

# 4. GAME WORLD

## 4.1 World structure

The world is a large explorable 3D environment.

Use procedural generation to create terrain and distribute natural resources.

The world should be reproducible using a world seed.

The same seed and generation configuration should produce the same initial world.

## 4.2 Terrain generation

Generate terrain using procedural noise.

Possible techniques include:

- Simplex noise.
- Perlin noise.
- Multi-octave fractal noise.
- Domain warping for more interesting geographical formations.

Terrain generation must support:

- Hills.
- Mountains.
- Valleys.
- Flat areas.
- Plateaus.
- Natural depressions.
- Water formations.

Avoid excessive terrain complexity.

Terrain resolution should be configurable.

## 4.3 Chunk system

Divide the world into manageable chunks.

Each chunk must have:

- Unique coordinates.
- Terrain geometry.
- Biome information.
- Resource deposit information.
- Environmental objects.
- Loading state.

Implement a ChunkManager responsible for:

- Loading nearby chunks.
- Unloading distant chunks.
- Generating missing chunks.
- Preserving modifications.
- Avoiding duplicate generation.

Use configurable view distances.

Factories and player modifications must remain persistent when their associated chunks are unloaded.

## 4.4 Biomes

Implement multiple biomes with distinct visual characteristics.

Initial biome suggestions:

**Grasslands**
- Open terrain.
- Moderate vegetation.
- Relatively flat construction areas.

**Dense Forest**
- Heavy vegetation.
- Wood resources.
- Uneven terrain.

**Desert**
- Sandy terrain.
- Sparse vegetation.
- Different resource distribution.

**Rocky Highlands**
- Mountains.
- Stone formations.
- Metal deposits.

**Wetlands**
- Water.
- Muddy terrain.
- Dense vegetation.

Biomes must influence environmental generation and resource distribution.

## 4.5 Environmental objects

Generate:

- Trees.
- Rocks.
- Bushes.
- Grass.
- Water.
- Natural formations.

Use instancing for repeated objects.

Environmental objects should not unnecessarily interfere with factory construction.

Allow the player to remove certain obstacles using appropriate tools.

---

# 5. RESOURCE SYSTEM

## 5.1 Resource definitions

Resources must be data-driven.

Each resource should have:

- Unique identifier.
- Display name.
- Description.
- Icon.
- Category.
- Stack size.
- Optional visual model.
- Optional rarity.
- Optional processing requirements.

Example resource categories:

- Raw materials.
- Processed materials.
- Components.
- Construction materials.
- Energy resources.
- Fluids.

## 5.2 Initial resources

Start with the following resources:

| Resource | Category | Main use |
|---|---|---|
| Iron Ore | Raw | Iron production |
| Copper Ore | Raw | Electrical components |
| Limestone | Raw | Concrete |
| Coal | Raw | Energy and metallurgy |
| Stone | Raw | Construction |
| Wood | Raw | Early construction |
| Water | Fluid | Industrial processes |

Additional resources should be introduced through progression.

Possible later resources:

- Caterium-like advanced conductive ore, with an original name.
- Quartz.
- Sulfur.
- Oil.
- Bauxite.
- Uranium-like radioactive materials, if appropriate for the game's progression.

## 5.3 Resource deposits

Each deposit must have:

- Position.
- Resource type.
- Purity level.
- Extraction capacity.
- Visual representation.
- Compatible extraction machines.

For the initial version, deposits may be infinite.

However, their production rates must still be limited by the extractor.

## 5.4 Resource purity

Introduce three purity levels:

- Impure.
- Normal.
- Pure.

Purity affects extraction output.

Example configurable multipliers:

| Purity | Production multiplier |
|---|---:|
| Impure | 0.5x |
| Normal | 1.0x |
| Pure | 2.0x |

These values must be configurable.

---

# 6. PLAYER SYSTEM

## 6.1 Camera and movement

Use first-person controls.

Default controls:

| Input | Action |
|---|---|
| W | Move forward |
| A | Move left |
| S | Move backward |
| D | Move right |
| Space | Jump |
| Shift | Sprint |
| Mouse | Look around |
| E | Interact |
| Q | Open build menu |
| Tab | Inventory |
| Escape | Pause |

Allow key remapping in a future settings menu.

## 6.2 Movement requirements

Implement:

- Mouse pointer lock.
- Smooth camera rotation.
- Acceleration and deceleration.
- Jumping.
- Gravity.
- Ground detection.
- Collision handling.
- Sprinting.
- Stable movement on slopes.

The player must not pass through terrain or major solid structures.

## 6.3 Interaction system

Use a central interaction system.

The player should be able to interact with objects through a camera raycast.

Examples:

- Open a machine interface.
- Collect nearby resources.
- Configure machines.
- Open storage.
- Activate objects.
- Inspect resource deposits.

Display a contextual interaction prompt.

Do not implement independent raycasting systems inside every machine.

---

# 7. INVENTORY AND ITEM SYSTEM

## 7.1 Inventory

The player has an inventory containing resources and manufactured items.

Each inventory contains slots.

Each slot stores:

- Item identifier.
- Quantity.
- Maximum stack size.

## 7.2 Inventory operations

Implement:

- Add item.
- Remove item.
- Transfer item.
- Split stack.
- Merge stacks.
- Check available space.
- Check available quantity.
- Move items between inventories.

All inventory operations must be validated.

Prevent negative quantities, duplicated items, and invalid transfers.

## 7.3 Item representation

Items should have separate logical and visual representations.

An item stored inside a machine does not need an active 3D object in the world.

An item transported on a conveyor may have an associated visual instance.

---

# 8. RESOURCE EXTRACTION

## 8.1 Manual gathering

The player can collect certain resources manually.

This mechanic provides the initial resources required to construct basic equipment.

Manual gathering should become less important as automation develops.

## 8.2 Mining machines

Implement multiple extractor tiers.

### Miner Mk.1

Basic automated extractor.

### Miner Mk.2

Improved extraction speed and efficiency.

### Miner Mk.3

Advanced extraction capabilities.

Each miner must support:

- Deposit detection.
- Resource type identification.
- Production rate.
- Electricity consumption.
- Output inventory.
- Output conveyor connection.
- Operational status.

## 8.3 Extraction logic

Mining must be simulated logically.

Production is determined by:

- Base extraction rate.
- Deposit purity.
- Machine efficiency.
- Available power.
- Output capacity.

Example:

A miner producing 30 Iron Ore per minute must generate 0.5 items per second on average.

The system must support fractional production accumulation without creating fractional physical items.

Do not spawn items when the output is full.

---

# 9. BUILDING AND PLACEMENT SYSTEM

## 9.1 Construction mode

The player can enter construction mode and select a building.

Display a transparent preview of the selected object.

The preview must communicate:

- Valid placement.
- Invalid placement.
- Orientation.
- Connection points.
- Approximate footprint.

## 9.2 Placement operations

Implement:

- Object selection.
- Positioning.
- Rotation.
- Grid snapping.
- Free placement where appropriate.
- Placement validation.
- Collision detection.
- Resource cost validation.
- Construction confirmation.
- Demolition.

## 9.3 Grid system

Use a configurable construction grid.

Buildings should align predictably.

Allow different snapping rules depending on object type.

For example:

- Foundations use grid snapping.
- Machines snap to compatible foundations.
- Conveyors use connection points.
- Poles use free placement with connection range validation.

## 9.4 Building lifecycle

Every placed building must have:

- Unique persistent ID.
- Building type.
- Position.
- Rotation.
- Configuration.
- Inventory state.
- Operational state.

The building's logical state must not depend on whether its visual model is currently loaded.

## 9.5 Structural components

Initial structural components:

- Foundations.
- Walls.
- Ceilings.
- Ramps.
- Pillars.
- Walkways.
- Stairs.

Allow multi-level factories.

---

# 10. CONVEYOR BELT SYSTEM

## 10.1 Importance

Conveyor belts are one of the most important systems in Factory Frontier.

They must be implemented as a genuine item transportation system.

A conveyor is not simply an animated texture.

It must transport real logical items between connected inventories.

## 10.2 Conveyor types

Initial tiers:

| Type | Relative speed |
|---|---:|
| Conveyor Mk.1 | 1x |
| Conveyor Mk.2 | 2x |
| Conveyor Mk.3 | 4x |
| Conveyor Mk.4 | 8x |

The actual item-per-minute limits must be configurable.

## 10.3 Conveyor geometry

Support:

- Straight segments.
- Horizontal curves.
- Vertical curves.
- Inclines.
- Descents.
- Elevated sections.
- Conveyor lifts.

The conveyor must follow a continuous path.

Avoid visible gaps between segments.

## 10.4 Conveyor construction

The player must be able to:

1. Select a conveyor.
2. Select a valid starting connection.
3. Place intermediate control points.
4. Define an endpoint.
5. Preview the resulting path.
6. Validate the route.
7. Confirm construction.

Allow the route to connect to:

- Machine inputs.
- Machine outputs.
- Splitters.
- Mergers.
- Storage containers.
- Other compatible logistics devices.

## 10.5 Logical transportation

Represent conveyor contents independently of their visual models.

Each conveyor should maintain an ordered collection of item entities.

Each entity contains:

- Item identifier.
- Distance along the conveyor.
- Optional visual instance reference.

Items must move according to conveyor speed.

Use a continuous distance-based representation.

The simulation must prevent:

- Items overlapping.
- Items passing through blocked items.
- Items exceeding conveyor capacity.
- Items disappearing at connections.
- Duplicate transfers.

## 10.6 Conveyor transfer logic

When an item reaches the endpoint:

1. Identify the connected destination.
2. Check whether the destination accepts the item.
3. Check available destination capacity.
4. Transfer the item if valid.
5. Otherwise, retain the item at the endpoint.

A blocked output must cause items to accumulate naturally.

This blockage must propagate upstream.

## 10.7 Conveyor throughput

Each conveyor has a maximum throughput.

Its effective throughput depends on:

- Conveyor tier.
- Item spacing.
- Movement speed.
- Destination capacity.
- Upstream supply.

Display throughput information in inspection mode.

## 10.8 Visual representation

Use lightweight visual item models.

Repeated objects should use InstancedMesh where practical.

Do not create a new geometry and material for every transported item.

Visual item positions must be derived from logical conveyor positions.

---

# 11. LOGISTICS MACHINES

## 11.1 Splitter

The splitter receives items through one input and distributes them through multiple outputs.

Initial configuration:

- One input.
- Three outputs.

Distribution modes:

- Balanced distribution.
- Overflow distribution.
- Configurable output priority.

The balanced distribution algorithm must avoid permanently favoring one output.

## 11.2 Merger

The merger receives items from multiple inputs and sends them through one output.

Initial configuration:

- Three inputs.
- One output.

Use fair input selection.

Prevent one permanently active input from starving the others.

## 11.3 Conveyor lifts

Allow vertical transportation.

Support:

- Upward movement.
- Downward movement.
- Configurable height.
- Compatible machine connections.

## 11.4 Storage containers

Storage containers must support:

- Input connections.
- Output connections.
- Item stacks.
- Capacity limits.
- Manual interaction.
- Inventory inspection.

Allow different container sizes in later progression.

---

# 12. MACHINE AND PRODUCTION SYSTEM

## 12.1 General architecture

All production machines must use a common machine interface.

Do not implement a completely different production architecture for every machine.

Each machine should define:

- Machine identifier.
- Display name.
- Input inventories.
- Output inventories.
- Available recipes.
- Processing duration.
- Power consumption.
- Production state.
- Input and output connection points.

## 12.2 Machine states

Use the following states:

- IDLE.
- RUNNING.
- NO_POWER.
- MISSING_INPUT.
- OUTPUT_FULL.
- DISABLED.
- ERROR.

Machine state transitions must be handled centrally.

## 12.3 Production cycle

A production cycle follows this sequence:

1. Check whether the machine is enabled.
2. Check whether power is available.
3. Check whether the selected recipe is valid.
4. Verify that all required ingredients are available.
5. Verify that output capacity is sufficient.
6. Consume the required ingredients.
7. Advance the production timer.
8. Generate the resulting items when processing completes.
9. Return to the appropriate operational state.

Do not consume ingredients if the machine cannot complete the production cycle under the defined rules.

## 12.4 Initial production machines

### Smelter

Transforms raw ore into ingots.

Examples:

- Iron Ore → Iron Ingot.
- Copper Ore → Copper Ingot.

### Constructor

Transforms one or more materials into basic components.

Examples:

- Iron Ingot → Iron Plate.
- Iron Ingot → Iron Rod.
- Copper Ingot → Copper Wire.
- Limestone → Concrete.

### Assembler

Combines multiple components.

Examples:

- Iron Plate + Iron Rod → Reinforced Component.
- Copper Wire + Iron Rod → Electrical Component.

### Foundry

Combines different raw materials or processed materials.

### Manufacturer

Handles more advanced recipes involving several input components.

### Refinery

Processes advanced resources and fluids.

## 12.5 Recipe system

Recipes must be data-driven.

Each recipe contains:

- Unique ID.
- Display name.
- Input requirements.
- Output products.
- Production duration.
- Compatible machine types.
- Optional power multiplier.
- Unlock requirement.

Example:

```json
{
  "id": "iron_plate",
  "name": "Iron Plate",
  "machine": "constructor",
  "duration": 6,
  "inputs": [
    {
      "item": "iron_ingot",
      "amount": 3
    }
  ],
  "outputs": [
    {
      "item": "iron_plate",
      "amount": 2
    }
  ]
}
```

The actual values are examples and must remain configurable.

## 12.6 Production accuracy

Production calculations must be deterministic.

Use fixed simulation intervals.

Avoid floating-point accumulation errors where possible.

Production rates must be expressed in understandable units, preferably items per minute.

---

# 13. FLUID SYSTEM

Fluids should be introduced after the basic solid-item logistics system is stable.

## 13.1 Fluid transportation

Implement a separate fluid transportation system.

Use pipes rather than conveyor belts.

Each pipe network must support:

- Connected segments.
- Flow capacity.
- Fluid type.
- Storage capacity.
- Input and output connections.
- Flow simulation.

## 13.2 Fluid behavior

Fluids must obey conservation rules.

Never generate or remove fluid quantities without an explicit production or consumption operation.

Support basic flow limitations.

Do not attempt a highly complex physical fluid simulation initially.

Use a simplified deterministic network simulation.

## 13.3 Fluid machines

Possible machines:

- Water Extractor.
- Pump.
- Fluid Buffer.
- Refinery.
- Fluid Generator.

---

# 14. ELECTRICITY SYSTEM

## 14.1 Power generation

Machines require electricity to operate.

Initial power sources:

- Biomass Generator.
- Coal Generator.
- Advanced Generator.

## 14.2 Electrical connections

Implement:

- Power poles.
- Power connections.
- Connection range.
- Network identification.
- Network merging.
- Network splitting.

A machine must be connected to a valid power network to consume electricity.

## 14.3 Power network data

Each network should track:

- Total production.
- Total consumption.
- Available power.
- Maximum capacity.
- Connected generators.
- Connected consumers.
- Operational status.

## 14.4 Power distribution

When production is insufficient:

- Machines must stop or reduce their operation according to the chosen power rules.
- The network should indicate insufficient power.
- The player should be able to inspect power statistics.

## 14.5 Biomass Generator

The initial generator consumes fuel.

It must support:

- Fuel inventory.
- Fuel consumption.
- Power generation.
- Operating state.
- Output capacity.

## 14.6 Coal Generator

The coal generator requires:

- Coal.
- Water.
- Appropriate pipe connections.

It generates electricity while both required resources are available.

---

# 15. PROGRESSION SYSTEM

## 15.1 Technology tiers

The player progresses by completing industrial milestones.

Each milestone unlocks new capabilities.

Suggested progression:

### Tier 0 — Initial Survival

- Basic inventory.
- Manual resource gathering.
- Basic tools.
- Initial construction materials.

### Tier 1 — Basic Automation

- Miner Mk.1.
- Smelter.
- Conveyor Mk.1.
- Constructor.
- Basic storage.

### Tier 2 — Industrial Logistics

- Splitter.
- Merger.
- Conveyor Mk.2.
- Improved storage.
- Additional production recipes.

### Tier 3 — Advanced Manufacturing

- Assembler.
- Improved extractors.
- Electrical infrastructure.
- Reinforced components.

### Tier 4 — Industrial Energy

- Coal generation.
- Water extraction.
- Pumps.
- Advanced conveyor systems.

### Tier 5 — Complex Manufacturing

- Manufacturer.
- Refinery.
- Advanced materials.
- More sophisticated production chains.

### Tier 6 — Large-Scale Industry

- Advanced generators.
- High-capacity logistics.
- High-efficiency machinery.
- Endgame production systems.

## 15.2 Milestone system

The player must deliver specified quantities of items to a central delivery station.

Example:

**Basic Automation Milestone**

Requirements:

- 100 Iron Plates.
- 100 Iron Rods.
- 50 Concrete.

Reward:

- Conveyor Mk.1.
- Miner Mk.1.
- Smelter.
- Constructor.

Milestones must be data-driven.

## 15.3 Technology tree

Provide a visual technology tree.

Each node contains:

- Name.
- Description.
- Requirements.
- Unlocks.
- Completion status.

The player must be able to understand which technologies are currently accessible and which remain locked.

---

# 16. FACTORY MANAGEMENT

## 16.1 Building inspection

The player must be able to inspect every machine.

Display:

- Machine name.
- Production state.
- Current recipe.
- Input inventory.
- Output inventory.
- Production rate.
- Power consumption.
- Connections.

## 16.2 Production statistics

Provide factory statistics.

Track:

- Items produced per minute.
- Items consumed per minute.
- Resource extraction rates.
- Machine utilization.
- Power production.
- Power consumption.
- Blocked production lines.

## 16.3 Bottleneck detection

Introduce an optional inspection mode that helps identify production problems.

Examples:

- Insufficient input.
- Insufficient conveyor throughput.
- Blocked output.
- Insufficient electricity.
- Missing fluid.
- Unbalanced production.

Do not require the player to use this system, but make it available.

---

# 17. USER INTERFACE

## 17.1 General principles

The interface should be clean, modern, readable, and minimally intrusive.

The 3D world must remain the primary focus.

Avoid excessive visual clutter.

## 17.2 Main HUD

Include:

- Crosshair.
- Interaction prompt.
- Hotbar.
- Inventory shortcut.
- Build menu shortcut.
- Player status indicators.
- Notifications.

## 17.3 Build menu

Organize buildings into categories:

- Production.
- Extraction.
- Logistics.
- Power.
- Storage.
- Foundations.
- Structures.

Each entry should display:

- Name.
- Icon.
- Description.
- Resource cost.
- Unlock status.

## 17.4 Machine interface

The machine interface must display actual logical state.

Example:

**SMELTER**

Status: RUNNING

Recipe: Iron Ingot

Input:
- Iron Ore: 12

Output:
- Iron Ingot: 8

Production:
- 30 items/min

Power:
- 4 MW

Use real data from the simulation.

## 17.5 Inventory interface

Support:

- Drag and drop.
- Stack splitting.
- Stack merging.
- Item descriptions.
- Quantity display.
- Inventory capacity.

## 17.6 Settings

Provide:

- Graphics settings.
- Mouse sensitivity.
- Field of view.
- Audio settings.
- Key bindings.
- Save management.

---

# 18. AUDIO AND VISUAL FEEDBACK

## 18.1 Audio

Add sounds progressively.

Suggested sound categories:

- Footsteps.
- Resource gathering.
- Machine operation.
- Conveyor movement.
- Machine activation.
- Machine failure.
- Construction.
- Destruction.
- Interface interactions.

Audio must be configurable.

## 18.2 Visual feedback

Use subtle visual effects.

Examples:

- Machine status lights.
- Moving conveyor items.
- Production animations.
- Power connection indicators.
- Construction previews.
- Interaction highlights.

Visual effects must communicate actual game state.

A machine should not appear operational when its logical state is inactive.

---

# 19. SAVE SYSTEM

## 19.1 Persistence

Use IndexedDB for persistent local saves.

The game must be able to save:

- World seed.
- Player position.
- Player inventory.
- Unlocked technologies.
- Placed buildings.
- Building configurations.
- Machine inventories.
- Conveyor connections.
- Conveyor contents.
- Power networks.
- Storage contents.
- World modifications.

## 19.2 Save architecture

Separate world data from player data.

Use a versioned save format.

Example:

```json
{
  "saveVersion": 1,
  "world": {
    "seed": 123456,
    "chunks": []
  },
  "player": {
    "position": [0, 10, 0],
    "inventory": []
  },
  "buildings": [],
  "logistics": [],
  "powerNetworks": [],
  "progression": {}
}
```

This is an illustrative structure, not a mandatory final schema.

## 19.3 Reliability

Implement:

- Automatic saving.
- Manual saving.
- Save validation.
- Save version migration.
- Error handling.
- Recovery from interrupted saves.

Avoid serializing unnecessary rendering information.

The logical game state is what must be saved.

---

