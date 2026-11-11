# FACTORY FRONTIER
## Master Game Design Document & Technical Development Specification

**Document type:** Master GDD / Technical Specification / AI Development Prompt  
**Project codename:** Factory Frontier  
**Version:** 2.0  
**Target platform:** Desktop Web Browser  
**Initial hosting:** GitHub Pages  
**Primary language:** TypeScript  
**3D Engine:** Three.js  
**Build system:** Vite  
**Development approach:** Modular, incremental, test-driven development

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
