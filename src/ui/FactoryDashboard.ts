import type { BuildingSystem } from '../buildings/BuildingSystem';
import type { ItemRegistry } from '../items/ItemRegistry';
import type { LogisticsManager } from '../logistics/LogisticsManager';
import type { MachineManager } from '../machines/MachineManager';
import { Processor } from '../machines/Processor';
import { Smelter, SMELTER_FUEL } from '../machines/Smelter';
import type { PowerManager } from '../power/PowerManager';
import type { ProductionHistory } from '../statistics/ProductionHistory';

/** Read-only factory snapshot. The surrounding application pauses while open. */
export class FactoryDashboard {
  private readonly close: HTMLButtonElement;
  private readonly summary: HTMLElement;
  private readonly powerSummary: HTMLElement;
  private readonly networks: HTMLElement;
  private readonly rows: HTMLElement;
  private readonly diagnostics: HTMLElement;
  constructor(private readonly root: HTMLElement, private readonly buildings: BuildingSystem,
    private readonly machines: MachineManager, private readonly logistics: LogisticsManager,
    private readonly power: PowerManager, private readonly history: ProductionHistory,
    private readonly items: ItemRegistry, private readonly onClose: () => void) {
    const get = <T extends HTMLElement>(selector: string): T => {
      const found = root.querySelector<T>(selector); if (!found) throw new Error(`Missing factory dashboard ${selector}`); return found;
    };
    this.close = get('[data-factory-close]'); this.summary = get('[data-factory-summary]');
    this.powerSummary = get('[data-factory-power]'); this.networks = get('[data-factory-networks]'); this.rows = get('[data-factory-rows]'); this.diagnostics = get('[data-factory-diagnostics]');
    this.close.addEventListener('click', onClose);
  }
  get isOpen(): boolean { return !this.root.hidden; }
  open(): void { this.root.hidden = false; this.update(); this.close.focus(); }
  closePanel(): void { this.root.hidden = true; }
  dispose(): void { this.close.removeEventListener('click', this.onClose); }
  update(): void {
    if (!this.isOpen) return;
    this.machines.sync(); this.logistics.sync();
    const machines = [...this.machines.all(), ...this.machines.allSmelters(), ...this.machines.allConstructors(), ...this.machines.allAdvanced()];
    const blockedBelts = this.logistics.network.all().filter(segment => segment.state === 'BLOCKED');
    const utilization = machines.length ? machines.reduce((sum, m) => sum + m.utilization, 0) / machines.length : 0;
    this.summary.textContent = `${machines.length} machines · ${blockedBelts.length} blocked belts · Mean lifetime utilization ${(utilization * 100).toFixed(1)}% · Simulation sample ${(Math.min(this.history.elapsedMs, 60000) / 1000).toFixed(1)} s`;
    const networks = this.power.networks();
    const watts = networks.reduce((sum, n) => ({ supplied: sum.supplied + n.suppliedWatts, demand: sum.demand + n.demandWatts, available: sum.available + n.availableWatts, installed: sum.installed + n.capacityWatts }), { supplied: 0, demand: 0, available: 0, installed: 0 });
    this.powerSummary.textContent = `Power (all ${networks.length} networks): supplied ${(watts.supplied / 1000).toFixed(1)} kW · demand ${(watts.demand / 1000).toFixed(1)} kW · available ${(watts.available / 1000).toFixed(1)} kW · installed ${(watts.installed / 1000).toFixed(1)} kW. Networks can be isolated or overloaded; supply is not shared between them.`;
    const doc = this.root.ownerDocument, rows = this.history.snapshot();
    this.networks.replaceChildren();
    for (const network of networks) {
      const li = doc.createElement('li');
      li.textContent = `${network.id}: ${network.status} · supplied ${(network.suppliedWatts / 1000).toFixed(1)} kW · demand ${(network.demandWatts / 1000).toFixed(1)} kW · shortfall ${(network.shortfallWatts / 1000).toFixed(1)} kW`;
      this.networks.append(li);
    }
    this.rows.replaceChildren();
    if (!rows.length) {
      const row = doc.createElement('tr'), cell = doc.createElement('td'); cell.colSpan = 4; cell.textContent = 'No production recorded in the current window.'; row.append(cell); this.rows.append(row);
    }
    for (const entry of rows) {
      const row = doc.createElement('tr');
      for (const text of [this.items.get(entry.itemId).name, entry.producedPerMinute.toFixed(1), entry.consumedPerMinute.toFixed(1), entry.extractedPerMinute.toFixed(1)]) {
        const cell = doc.createElement('td'); cell.textContent = text; row.append(cell);
      }
      this.rows.append(row);
    }
    this.diagnostics.replaceChildren();
    const issue = (text: string): void => { const li = doc.createElement('li'); li.textContent = text; this.diagnostics.append(li); };
    const where = (id: string): string => {
      const building = this.buildings.get(id); if (!building) return id;
      return `${this.buildings.registry.get(building.typeId).name} ${id} (${building.transform.x.toFixed(1)}, ${building.transform.z.toFixed(1)})`;
    };
    for (const machine of machines) {
      let reason = '';
      if (machine.state === 'OUTPUT_FULL') reason = 'output full';
      else if (machine.state === 'MISSING_INPUT') {
        if (machine instanceof Processor) {
          const missing = [machine.recipe.input, ...(machine.recipe.additionalInputs ?? [])].filter(input => machine.input.getItemCount(input.itemId) < input.quantity);
          reason = `missing input: ${missing.map(input => this.items.get(input.itemId).name).join(', ')}`;
        } else reason = 'resource deposit unavailable';
      } else if (machine.state === 'NO_POWER') reason = machine instanceof Smelter && machine.powered && !machine.fuel.getItemCount(SMELTER_FUEL.itemId) ? 'missing coal' : 'electricity unavailable';
      else if (machine.state === 'ERROR') reason = 'machine error';
      if (reason) issue(`${where(machine.id)} — ${reason}`);
    }
    for (const belt of blockedBelts) issue(`${where(belt.id)} — conveyor output blocked`);
    if (!this.diagnostics.childElementCount) issue('No currently detected machine or conveyor blockages.');
  }
}
