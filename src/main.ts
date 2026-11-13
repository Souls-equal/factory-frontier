import { GroundItems } from './logistics/GroundItems';
import './styles/main.css';

import { VoxelCollision } from './world/terrain/VoxelCollision';
import { BuildingTerrain } from './buildings/BuildingTerrain';
import { BuildingCollision } from './buildings/BuildingCollision';
import { ConstructionController } from './buildings/ConstructionController';
import { LogisticsManager } from './logistics/LogisticsManager';
import { LogisticsInteractable } from './logistics/LogisticsInteractable';
import { LogisticsUI } from './ui/LogisticsUI';
import { MachineManager } from './machines/MachineManager';
import { MinerInteractable } from './machines/MinerInteractable';
import { SmelterInteractable } from './machines/SmelterInteractable';
import { ConstructorInteractable } from './machines/ConstructorInteractable';
import { MachineUI } from './ui/MachineUI';
import { ConstructionUI } from './ui/ConstructionUI';
import { createGameConfig } from './core/Configuration';
import { Game } from './core/Game';
import { Engine } from './engine/Engine';
import { InputManager } from './input/InputManager';
import { Inventory } from './items/Inventory';
import { createDefaultItemRegistry } from './items/ItemRegistry';
import { GatherableCollision } from './resources/Gatherables';
import { DepositInteractable } from './resources/ResourceDeposit';
import { InventoryUI } from './ui/InventoryUI';
import { InteractionSystem } from './interaction/InteractionSystem';
import { createWorldInteractables } from './interaction/WorldInteractables';
import { PlayerController } from './player/PlayerController';
import { ControlsHint } from './ui/ControlsHint';
import { InteractionPrompt } from './ui/InteractionPrompt';
import { StatusOverlay } from './ui/StatusOverlay';
import { createWorld } from './world/World';

/**
 * Application bootstrap.
 *
 * Keeps DOM wiring out of the game core: `Game` never touches the document,
 * `Engine` never knows about the UI, and the player/interaction systems never
 * import Three.js. Stage assignment matters:
 *
 * - player physics and interaction targeting run on the fixed simulation clock,
 * - mouse look, camera application, highlighting and the prompt run once per
 *   rendered frame, reading authoritative state without mutating it.
 */

const app = document.querySelector<HTMLElement>('#app');
const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');

if (app === null || canvas === null) {
  throw new Error('Application shell is missing #app or #game-canvas.');
}

const overlay = StatusOverlay.fromDocument(document);
const controlsHint = ControlsHint.fromDocument(document);
const interactionPrompt = InteractionPrompt.fromDocument(document);
const query = new URLSearchParams(window.location.search);

const config = createGameConfig({
  appName: __APP_NAME__,
  version: __APP_VERSION__,
  basePath: import.meta.env.BASE_URL,
  debug: import.meta.env.DEV || query.has('debug'),
});

let game: Game | undefined;
let input: InputManager | undefined;
let statsTimer: number | undefined;
let inventoryUI: InventoryUI | undefined;
let constructionUI: ConstructionUI | undefined;
let machineUI: MachineUI | undefined;
let logisticsUI: LogisticsUI | undefined;

function measureViewport(): { width: number; height: number } {
  const width = app?.clientWidth ?? 0;
  const height = app?.clientHeight ?? 0;
  return {
    width: Math.max(1, Math.floor(width > 0 ? width : window.innerWidth)),
    height: Math.max(1, Math.floor(height > 0 ? height : window.innerHeight)),
  };
}

function handleResize(): void {
  if (game === undefined) {
    return;
  }
  const { width, height } = measureViewport();
  game.resize(width, height, window.devicePixelRatio || 1);
}

function shutdown(): void {
  if (statsTimer !== undefined) {
    window.clearInterval(statsTimer);
    statsTimer = undefined;
  }
  window.removeEventListener('resize', handleResize);
  input?.dispose();
  input = undefined;
  interactionPrompt.dispose();
  inventoryUI?.dispose();
  inventoryUI = undefined;
  constructionUI?.dispose();
  constructionUI = undefined;
  machineUI?.dispose();
  machineUI = undefined;
  logisticsUI?.dispose(); logisticsUI = undefined;
  game?.dispose();
}

function handleFatalError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error('[Factory Frontier] fatal error:', error);
  shutdown();
  overlay.showFatal(message);
}

function startDebugStats(target: Game): void {
  if (!config.debug) {
    return;
  }
  overlay.showStats();
  statsTimer = window.setInterval(() => {
    overlay.updateStats(target.stats);
  }, 250);
}

async function boot(): Promise<void> {
  overlay.setBootStatus('Generating terrain…');
  const registry = createDefaultItemRegistry();
  const inventory = new Inventory(registry, config.resources.inventorySlots);
  const world = createWorld(config, inventory);

  overlay.setBootStatus('Building environment…');
  const engine = Engine.create(canvas as HTMLCanvasElement, config, world);
  const createdGame = new Game({
    config,
    engine,
    onError: handleFatalError,
  });
  game = createdGame;
  await createdGame.init();

  overlay.setBootStatus('Wiring first-person controls…');
  const inventoryRoot = document.querySelector<HTMLElement>('[data-ui="inventory"]');
  const constructionRoot = document.querySelector<HTMLElement>('[data-ui="construction"]');
  const constructionStatus = document.querySelector<HTMLElement>('[data-ui="construction-status"]');
  const machineRoot = document.querySelector<HTMLElement>('[data-ui="machine"]');
  const logisticsRoot = document.querySelector<HTMLElement>('[data-ui="logistics"]');
  if (!inventoryRoot || !constructionRoot || !constructionStatus || !machineRoot || !logisticsRoot) throw new Error('Application shell is missing a gameplay panel.');
  const buildings = world.buildings;
  const buildingRegistry = buildings.registry;
  const construction = new ConstructionController(buildings, world.terrain, config.construction.reach);
  engine.initBuildings?.(buildingRegistry, config.construction.gridSize);
  const groundTerrain = new BuildingTerrain(world.terrain, buildings);
  const groundItems = new GroundItems((x, z, y) => {
    const p = world.terrain.clampXZ(x, z);
    const below = groundTerrain.groundBelow(p.x, p.z, y, 0);
    return Number.isFinite(below) ? below : world.terrain.heightAt(p.x, p.z);
  });
  const player = new PlayerController({
    controls: config.controls, player: config.player, terrain: new BuildingTerrain(world.terrain, buildings),
    obstacles: new BuildingCollision(new VoxelCollision(world.terrain, new GatherableCollision(world.obstacles, world.gatherables)), buildings), spawn: world.spawn,
  });
  const playerFootprint = () => ({ x: player.position.x, z: player.position.z, radius: config.player.radius });
  const machines = new MachineManager(buildings, registry, () => world.deposits, config.miner,
    () => !!(machineUI?.isOpen || logisticsUI?.isOpen || constructionUI?.isOpen || inventoryUI?.isOpen));
  const logistics = new LogisticsManager(buildings, machines, registry,
    () => !!(machineUI?.isOpen || logisticsUI?.isOpen || constructionUI?.isOpen || inventoryUI?.isOpen), 1, undefined, groundItems);
  let pendingConstruction: 'place' | 'demolish' | null = null;
  let createdInput: InputManager;
  const closeInventory = (): void => {
    if (!inventoryUI?.isOpen) return;
    inventoryUI.closePanel(); createdInput.resumeFromModal();
  };
  const closeConstruction = (): void => {
    if (!constructionUI?.isOpen) return;
    constructionUI.closePanel(); createdInput.resumeFromModal();
  };
  const closeMachine = (): void => {
    if (!machineUI?.isOpen) return;
    machineUI.closePanel(); createdInput.resumeFromModal();
  };
  const closeLogistics = (): void => {
    if (!logisticsUI?.isOpen) return;
    logisticsUI.closePanel(); createdInput.resumeFromModal();
  };
  logisticsUI = new LogisticsUI(logisticsRoot, logistics, inventory, closeLogistics);
  machineUI = new MachineUI(machineRoot, inventory, closeMachine);
  inventoryUI = new InventoryUI(inventoryRoot, inventory, closeInventory);
  constructionUI = new ConstructionUI(constructionRoot, buildingRegistry, inventory, (id) => {
    construction.select(id); closeConstruction();
    interactionPrompt.showFeedback('Aim at nearby ground. R rotates · Left click places repeatedly · Esc cancels.');
  }, closeConstruction, buildings.cellSize, buildings);
  createdInput = new InputManager(canvas as HTMLCanvasElement, {
    onPointerLockChange: (locked) => controlsHint.setPointerLocked(locked),
    onInventoryToggle: () => {
      if (constructionUI?.isOpen || machineUI?.isOpen || logisticsUI?.isOpen) return;
      if (inventoryUI?.isOpen) closeInventory();
      else { construction.cancel(); pendingConstruction = null; player.stopHorizontalMotion(); createdInput.suspendForModal(); inventoryUI?.open(); }
    },
    onInventoryClose: closeInventory,
    isConstructionActive: () => construction.active,
    onConstructionClick: () => { if (construction.active) pendingConstruction = 'place'; },
    onConstructionKey: (code) => {
      if (machineUI?.isOpen) { if (code === 'Escape') closeMachine(); return true; }
      if (logisticsUI?.isOpen) { if (code === 'Escape') closeLogistics(); return true; }
      if (inventoryUI?.isOpen) return code !== 'Escape';
      if (code === 'Escape') {
        if (constructionUI?.isOpen) { closeConstruction(); return true; }
        if (construction.active) { construction.cancel(); pendingConstruction = null; return true; }
        return false;
      }
      if (code === 'KeyQ') {
        if (constructionUI?.isOpen) closeConstruction();
        else if (construction.active) { construction.cancel(); pendingConstruction = null; }
        else { pendingConstruction = null; player.stopHorizontalMotion(); createdInput.suspendForModal(); constructionUI?.open(); }
        return true;
      }
      if (constructionUI?.isOpen) return true;
      if ((code === 'PageUp' || code === 'PageDown') && construction.selected === 'foundation') { construction.adjustFoundationHeight(code === 'PageUp' ? 1 : -1); return true; }
      if (code === 'KeyR' && construction.active) { construction.rotate(); return true; }
      if (code === 'KeyF' && !construction.active) { pendingConstruction = 'demolish'; return true; }
      return false;
    },
  });
  input = createdInput;

  const interaction = new InteractionSystem({
    range: config.interaction.range,
    viewProvider: () => player.view,
  });
  for (const interactable of createWorldInteractables(world.interactables)) {
    interaction.register(interactable);
  }
  for (const deposit of world.deposits) {
    interaction.register(new DepositInteractable(deposit, registry, config.interaction.range,
      () => !buildings.all().some((building) => building.depositId === deposit.id)));
  }

  for (const gatherable of world.gatherables.interactables(inventory, config.interaction.range)) {
    interaction.register(gatherable);
  }

  const machineInteractions = new Map<string, () => void>();
  const syncMachines = (): void => {
    machines.sync();
    const active = new Set([...machines.all(), ...machines.allSmelters(), ...machines.allConstructors()].map((machine) => machine.id));
    for (const [id, unregister] of machineInteractions) {
      if (!active.has(id)) { unregister(); machineInteractions.delete(id); }
    }
    for (const miner of machines.all()) {
      if (machineInteractions.has(miner.id)) continue;
      const building = buildings.get(miner.id);
      if (!building) continue;
      const unregister = interaction.register(new MinerInteractable(miner, building, config.interaction.range, (selected) => {
        pendingConstruction = null; player.stopHorizontalMotion(); createdInput.suspendForModal(); machineUI?.open(selected);
      }));
      machineInteractions.set(miner.id, unregister);
    }
    for (const smelter of machines.allSmelters()) {
      if (machineInteractions.has(smelter.id)) continue;
      const building = buildings.get(smelter.id); if (!building) continue;
      machineInteractions.set(smelter.id, interaction.register(new SmelterInteractable(smelter, building, config.interaction.range, (selected) => {
        pendingConstruction = null; player.stopHorizontalMotion(); createdInput.suspendForModal(); machineUI?.open(selected);
      })));
    }
    for (const machine of machines.allConstructors()) {
      if (machineInteractions.has(machine.id)) continue;
      const building = buildings.get(machine.id); if (!building) continue;
      machineInteractions.set(machine.id, interaction.register(new ConstructorInteractable(machine, building, config.interaction.range, (selected) => {
        pendingConstruction = null; player.stopHorizontalMotion(); createdInput.suspendForModal(); machineUI?.open(selected);
      })));
    }
  };

  const groundInteractions = new Map<string, () => void>();
  const syncGroundItems = (): void => {
    const active = new Set(groundItems.all().map((item) => item.id));
    for (const [id, unregister] of groundInteractions) if (!active.has(id)) { unregister(); groundInteractions.delete(id); }
    for (const item of groundItems.all()) {
      if (groundInteractions.has(item.id)) continue;
      const id = item.id;
      groundInteractions.set(id, interaction.register({
        get descriptor() { return { id: `ground:${id}`, displayName: registry.get(item.itemId).name, hint: 'Pick up',
          position: groundItems.get(id)?.position ?? item.position, targetRadius: .3, range: config.interaction.range }; },
        isAvailable: () => !!groundItems.get(id),
        interact: () => groundItems.pickup(id, inventory) ? { ok: true, message: 'Item picked up.' } : { ok: false, message: 'Inventory full.' },
      }));
    }
  };

  const logisticsInteractions = new Map<string, () => void>();
  const syncLogistics = (): void => {
    logistics.sync();
    const active = new Set(buildings.all().filter((building) => buildings.registry.get(building.typeId).placement === 'logistics' && (building.typeId === 'receiving-terminal' || building.typeId === 'storage-container' || building.typeId === 'splitter')).map((building) => building.id));
    for (const [id, unregister] of logisticsInteractions) if (!active.has(id)) { unregister(); logisticsInteractions.delete(id); }
    for (const id of active) {
      if (logisticsInteractions.has(id)) continue;
      const building = buildings.get(id)!;
      logisticsInteractions.set(id, interaction.register(new LogisticsInteractable(building, buildingRegistry.get(building.typeId).name, config.interaction.range, (selected) => {
        pendingConstruction = null; player.stopHorizontalMotion(); createdInput.suspendForModal(); logisticsUI?.open(selected);
      })));
    }
  };

  const beltItemInteractions = new Map<string, () => void>();
  const syncBeltItems = (): void => {
    const items = logistics.network.all().flatMap((segment) => segment.items);
    const active = new Set(items.map((item) => item.id));
    for (const [id, unregister] of beltItemInteractions) if (!active.has(id)) { unregister(); beltItemInteractions.delete(id); }
    for (const item of items) {
      if (beltItemInteractions.has(item.id)) continue;
      const id = item.id, initial = logistics.network.findItem(id)!.position;
      beltItemInteractions.set(id, interaction.register({
        get descriptor() { const p = logistics.network.findItem(id)?.position ?? initial; return { id: `belt:${id}`, displayName: registry.get(item.itemId).name,
          hint: 'Pick up', position: { x: p.x, y: p.y + .22, z: p.z }, targetRadius: .3, range: config.interaction.range }; },
        isAvailable: () => !!logistics.network.findItem(id),
        interact: () => logistics.network.pickup(id, inventory) ? { ok: true, message: 'Item picked up.' } : { ok: false, message: 'Inventory full.' },
      }));
    }
  };

  // --- deterministic simulation stage -------------------------------------
  createdGame.registerSystem({
    id: 'player-simulation',
    fixedUpdate: (fixedDeltaMs) => {
      const movement = createdInput.getMovement();
      const jump = createdInput.consumeJump();
      if (!constructionUI?.isOpen && !inventoryUI?.isOpen && !machineUI?.isOpen && !logisticsUI?.isOpen) {
        player.step(fixedDeltaMs / 1000, {
          moveX: movement.right,
          moveZ: movement.forward,
          sprint: movement.sprint,
          lookDeltaX: 0,
          lookDeltaY: 0,
          jump,
        });
      }

      const action = pendingConstruction; pendingConstruction = null;
      if (action === 'place' && construction.active && !constructionUI?.isOpen && !inventoryUI?.isOpen) {
        const result = construction.confirm(player.view, playerFootprint());
        interactionPrompt.showFeedback(result ? (result.reason === 'valid' ? `${buildings.registry.get(result.building!.typeId).name} placed.` : `Cannot place: ${result.reason}.`) : 'Aim at nearby ground.');
      } else if (action === 'demolish' && !construction.active && !constructionUI?.isOpen && !inventoryUI?.isOpen) {
        const target = construction.target(player.view);
        if (!target) interactionPrompt.showFeedback('Aim at a placed building to demolish.');
        else {
          const free = buildings.get(target)?.freePlacement === true;
          const result = buildings.demolish(target);
          interactionPrompt.showFeedback(result === 'removed' ? (free ? 'Free building demolished; no materials to refund.' : 'Building demolished; materials refunded.') : `Cannot demolish: ${result}.`);
        }
      }
      syncMachines(); syncLogistics(); syncBeltItems(); syncGroundItems();
      const interactPressed = createdInput.consumeInteract();
      if (interactPressed && action === null && !construction.active && !constructionUI?.isOpen && !inventoryUI?.isOpen && !machineUI?.isOpen && !logisticsUI?.isOpen) {
        interaction.requestInteraction();
      }
    },
  });
  createdGame.registerSystem(interaction);
  createdGame.registerSystem(machines);
  createdGame.registerSystem(logistics);

  // --- presentation stage --------------------------------------------------
  createdGame.registerFrameSystem({
    id: 'player-view',
    update: () => {
      const look = createdInput.consumeLookDelta();
      if (look.x !== 0 || look.y !== 0) {
        player.applyLook({
          moveX: 0,
          moveZ: 0,
          sprint: false,
          lookDeltaX: look.x,
          lookDeltaY: look.y,
        });
      }
      // Interpolation keeps the camera smooth between 20 Hz physics steps
      // without touching authoritative simulation state.
      engine.applyView(player.viewAt(createdGame.clock.alpha));
    },
  });

  let lastOutcomeSequence = interaction.outcomeSequence;
  createdGame.registerFrameSystem({
    id: 'interaction-presentation',
    update: () => {
      inventoryUI?.update(); constructionUI?.update(); machineUI?.update(); logisticsUI?.update();
      controlsHint.setConstructionActive(construction.active);
      const preview = construction.preview(player.view, playerFootprint());
      engine.syncBuildings?.(buildings.all());
      engine.syncConveyors?.(logistics.network.all(), machineUI?.isOpen || logisticsUI?.isOpen || constructionUI?.isOpen || inventoryUI?.isOpen ? 1 : createdGame.clock.alpha, groundItems.all());
      engine.setMachineStates?.([...machines.all(), ...machines.allSmelters(), ...machines.allConstructors()].map((machine) => ({ id: machine.id, state: machine.state })));
      engine.setBuildingPreview?.(construction.selected, preview ?? undefined);
      constructionStatus.hidden = !construction.active;
      if (construction.active) constructionStatus.textContent = (buildings.creativeMode ? 'Creative · ' : '') + (preview
        ? `${preview.reason === 'valid' ? 'Valid placement' : `Cannot place: ${preview.reason}`} · R rotate · Left click place · Esc cancel${preview.connection ? ` · ${preview.connection} port` : ''}${construction.selected?.startsWith('conveyor-') ? ' · direction follows view; yellow = output · R rotates' : ''}${preview.snappedToConveyor || preview.snappedToFoundation ? ' · aligned to neighbour' : ''}${construction.selected === 'foundation' ? ` · Page Up/Down height (${construction.foundationHeightOffset >= 0 ? '+' : ''}${construction.foundationHeightOffset.toFixed(1)} m) · base ${preview.transform.y.toFixed(1)} m` : ''}${preview.conveyorPreviewChanges?.length ? ' · green preview shows belt after placement' : ''}${!createdInput.isPointerLocked ? ' · drag to look · right click to capture mouse' : ''}`
        : `Aim at ground within ${config.construction.reach} m · R rotate · Left click place · Esc cancel${!createdInput.isPointerLocked ? ' · drag to look · right click to capture mouse' : ''}`);
      const target = inventoryUI?.isOpen || constructionUI?.isOpen || machineUI?.isOpen || logisticsUI?.isOpen || construction.active ? null : interaction.target;
      engine.setHighlight?.(target?.id ?? null);

      if (target === null) {
        interactionPrompt.hide();
      } else {
        interactionPrompt.show(target, target.id);
      }

      if (interaction.outcomeSequence !== lastOutcomeSequence) {
        lastOutcomeSequence = interaction.outcomeSequence;
        const outcome = interaction.lastOutcome;
        if (outcome !== null) {
          interactionPrompt.showFeedback(outcome.message);
        }
      }
    },
  });

  const { width, height } = measureViewport();
  createdGame.resize(width, height, window.devicePixelRatio || 1);

  window.addEventListener('resize', handleResize);
  window.addEventListener('beforeunload', shutdown);

  overlay.hideBoot();
  createdGame.start();
  startDebugStats(createdGame);

  console.info(
    `[Factory Frontier] ${config.appName} v${config.version} ready — ${world.terrain.resolution}² terrain cells, ` +
      `${world.obstacleDefinitions.length} solid obstacles, ${interaction.size} interactables, ` +
      `fixed timestep ${config.simulation.fixedTimestepMs} ms, base "${config.basePath}".`,
  );
}

boot().catch((error: unknown) => {
  handleFatalError(error);
});
