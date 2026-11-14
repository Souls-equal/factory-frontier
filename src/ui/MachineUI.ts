import type { Inventory } from '../items/Inventory';
import type { Miner } from '../machines/Miner';
import { Smelter, SMELTER_FUEL } from '../machines/Smelter';
import { ConstructorMachine } from '../machines/ConstructorMachine';
import { AdvancedMachine } from '../machines/AdvancedMachine';
import { Processor } from '../machines/Processor';
import type { BiomassGenerator } from '../power/BiomassGenerator';
import type { PowerNetwork } from '../power/PowerGrid';
import type { FactoryStatistics } from '../machines/MachineManager';

/** DOM-only inspection of authoritative machine state. */
export class MachineUI {
  private miner: Miner | Processor | null = null;
  private powerTarget: { id: string; generator?: BiomassGenerator } | null = null;
  private readonly feed: HTMLButtonElement;
  private readonly retrieveInput: HTMLButtonElement;
  private readonly feedFuel: HTMLButtonElement;
  private readonly retrieveFuel: HTMLButtonElement;
  private readonly details: HTMLElement;
  private readonly recipeLabel: HTMLLabelElement;
  private readonly recipeSelect: HTMLSelectElement;
  private readonly close: HTMLButtonElement;
  private readonly toggle: HTMLButtonElement;
  private readonly retrieve: HTMLButtonElement;
  private readonly notice: HTMLElement;
  constructor(private readonly root: HTMLElement, private readonly player: Inventory, private readonly onClose: () => void,
    private readonly network?: (id: string) => PowerNetwork, private readonly factory?: (itemId: string) => FactoryStatistics) {
    const find = <T extends HTMLElement>(selector: string): T => {
      const result = root.querySelector<T>(selector); if (!result) throw new Error(`Missing machine UI ${selector}`); return result;
    };
    this.details = find('[data-machine-details]'); this.close = find('[data-machine-close]');
    this.recipeLabel = root.ownerDocument.createElement('label'); this.recipeLabel.textContent = 'Recipe (empty buffers; partial progress resets): ';
    this.recipeSelect = root.ownerDocument.createElement('select'); this.recipeSelect.dataset.machineRecipe = '';
    this.recipeLabel.append(this.recipeSelect); this.details.after(this.recipeLabel);
    this.recipeSelect.addEventListener('change', this.handleRecipe);
    this.toggle = find('[data-machine-toggle]'); this.retrieve = find('[data-machine-retrieve]'); this.notice = find('[data-machine-notice]');
    this.feed = root.ownerDocument.createElement('button'); this.feed.type = 'button'; this.feed.textContent = 'Add iron ore'; this.feed.dataset.machineFeed = '';
    this.retrieveInput = root.ownerDocument.createElement('button'); this.retrieveInput.type = 'button'; this.retrieveInput.textContent = 'Retrieve input'; this.retrieveInput.dataset.machineRetrieveInput = '';
    this.feedFuel = root.ownerDocument.createElement('button'); this.feedFuel.type = 'button'; this.feedFuel.textContent = 'Add coal'; this.feedFuel.dataset.machineFeedFuel = '';
    this.retrieveFuel = root.ownerDocument.createElement('button'); this.retrieveFuel.type = 'button'; this.retrieveFuel.textContent = 'Retrieve coal'; this.retrieveFuel.dataset.machineRetrieveFuel = '';
    this.toggle.parentElement?.append(this.feed, this.retrieveInput, this.feedFuel, this.retrieveFuel);
    this.feedFuel.addEventListener('click', this.handleFeedFuel); this.retrieveFuel.addEventListener('click', this.handleRetrieveFuel);
    this.feed.addEventListener('click', this.handleFeed); this.retrieveInput.addEventListener('click', this.handleRetrieveInput);
    this.close.addEventListener('click', onClose); this.toggle.addEventListener('click', this.handleToggle);
    this.retrieve.addEventListener('click', this.handleRetrieve);
  }
  get isOpen(): boolean { return !this.root.hidden; }
  get activeMachine(): Miner | Processor | null { return this.miner; }
  open(miner: Miner | Processor): void {
    this.powerTarget = null; this.miner = miner; this.root.hidden = false; this.notice.textContent = '';
    this.recipeSelect.replaceChildren();
    if (miner instanceof ConstructorMachine) for (const recipe of miner.recipes) {
      const option = this.root.ownerDocument.createElement('option'); option.value = recipe.id; option.textContent = recipe.name;
      this.recipeSelect.append(option);
    }
    const name = miner instanceof Smelter ? 'Smelter' : miner instanceof ConstructorMachine ? 'Constructor' : miner instanceof AdvancedMachine ? miner.kind : 'Miner Mk.1';
    const title = this.root.querySelector('[data-machine-title]'); if (title) title.textContent = name;
    this.root.setAttribute('aria-label', name); this.update(); this.close.focus();
  }
  openPower(id: string, generator?: BiomassGenerator): void {
    this.miner = null; this.powerTarget = generator ? { id, generator } : { id };
    this.root.hidden = false; this.notice.textContent = '';
    const name = generator ? 'Biomass Generator' : 'Power Pole';
    const title = this.root.querySelector('[data-machine-title]'); if (title) title.textContent = name;
    this.root.setAttribute('aria-label', name); this.update(); this.close.focus();
  }
  closePanel(): void { this.miner = null; this.powerTarget = null; this.root.hidden = true; }
  private networkText(id: string): string {
    if (!this.network) return '';
    const n = this.network(id);
    return ` · Network: ${n.status} · Supply: ${n.suppliedWatts / 1000} kW · Demand: ${n.demandWatts / 1000} kW · Available: ${n.availableWatts / 1000} kW · Installed: ${n.capacityWatts / 1000} kW · Shortfall: ${n.shortfallWatts / 1000} kW · Poles: ${n.poles.length} · Generators: ${n.generators.length} · Machines: ${n.consumers.length}`;
  }
  update(): void {
    if (!this.isOpen) return;
    const power = this.powerTarget;
    if (power) {
      const generator = power.generator;
      this.recipeLabel.hidden = true;
      this.feed.hidden = true; this.retrieveInput.hidden = true; this.retrieve.hidden = true;
      this.toggle.hidden = !generator; this.feedFuel.hidden = !generator; this.retrieveFuel.hidden = !generator;
      if (generator) {
        this.feedFuel.textContent = 'Add Wood'; this.retrieveFuel.textContent = 'Retrieve Wood';
        this.feedFuel.disabled = !this.player.getItemCount('wood') || generator.fuel.getAvailableSpace('wood') === 0;
        this.retrieveFuel.disabled = !generator.fuel.getItemCount('wood');
        this.toggle.textContent = generator.enabled ? 'Disable' : 'Enable';
        this.details.textContent = `Generator: ${generator.enabled ? 'enabled' : 'disabled'} · Wood: ${generator.fuel.getItemCount('wood')} · Active fuel: ${(generator.remainingMs / 1000).toFixed(1)} s · 1 wood = 30 s · Capacity: 30 kW · Cyan rear input accepts wood · Demolition discards active burn time${this.networkText(power.id)}`;
      } else this.details.textContent = `Automatic links within 10 m; endpoints attach to their nearest pole.${this.networkText(power.id)}`;
      return;
    }
    const miner = this.miner; if (!miner) return;
    const network = this.networkText(miner.id);
    this.recipeLabel.hidden = !(miner instanceof ConstructorMachine) || miner.recipes.length < 2;
    if (miner instanceof ConstructorMachine) this.recipeSelect.value = miner.recipe.id;
    this.retrieve.hidden = false; this.toggle.hidden = false;
    this.feedFuel.textContent = 'Add coal'; this.retrieveFuel.textContent = 'Retrieve coal';
    this.feed.hidden = !(miner instanceof Processor); this.retrieveInput.hidden = !(miner instanceof Processor);
    this.feedFuel.hidden = !(miner instanceof Smelter || miner instanceof AdvancedMachine); this.retrieveFuel.hidden = !(miner instanceof Smelter || miner instanceof AdvancedMachine);
    if (miner instanceof Smelter) {
      const recipe = miner.recipe, input = this.player.registry.get(recipe.input.itemId).name, output = this.player.registry.get(recipe.output.itemId).name;
      this.details.textContent = `State: ${miner.state}${miner.state === 'NO_POWER' ? (miner.powered ? ' (add coal)' : ' (electricity unavailable)') : ''} · Recipe: ${recipe.input.quantity} ${input} + ${SMELTER_FUEL.quantity} Coal → ${recipe.output.quantity} ${output} / ${recipe.durationMs / 1000}s · Input: ${miner.input.getItemCount(recipe.input.itemId)} · Coal: ${miner.fuel.getItemCount(SMELTER_FUEL.itemId)} · Output: ${miner.output.getItemCount(recipe.output.itemId)} · Progress: ${Math.floor(miner.progress * 100)}% · Cyan input (ore and coal) at rear, yellow output at front`;
      this.feed.disabled = !this.player.getItemCount(recipe.input.itemId) || miner.input.getAvailableSpace(recipe.input.itemId) === 0;
      this.retrieveInput.disabled = !miner.input.getItemCount(recipe.input.itemId);
      this.feedFuel.disabled = !this.player.getItemCount(SMELTER_FUEL.itemId) || miner.fuel.getAvailableSpace(SMELTER_FUEL.itemId) === 0;
      this.retrieveFuel.disabled = !miner.fuel.getItemCount(SMELTER_FUEL.itemId);
      this.retrieve.disabled = !miner.output.getItemCount(recipe.output.itemId);
    } else if (miner instanceof Processor) {
      const recipe = miner.recipe, output = this.player.registry.get(recipe.output.itemId).name;
      const ingredients = [recipe.input, ...(recipe.additionalInputs ?? [])];
      const names = ingredients.map(input => `${input.quantity} ${this.player.registry.get(input.itemId).name}`).join(' + ');
      const stocks = ingredients.length === 1 ? `${miner.input.getItemCount(recipe.input.itemId)}` : ingredients.map(input => `${this.player.registry.get(input.itemId).name}: ${miner.input.getItemCount(input.itemId)}`).join(', ');
      this.details.textContent = `State: ${miner.state} · Recipe: ${names} → ${recipe.output.quantity} ${output} / ${recipe.durationMs / 1000}s · Input: ${stocks} · Output: ${miner.output.getItemCount(recipe.output.itemId)} · Progress: ${Math.floor(miner.progress * 100)}% · Cyan input at rear, yellow output at front`;
      this.feed.disabled = !this.player.getItemCount(recipe.input.itemId) || miner.inputSpace(recipe.input.itemId) === 0;
      this.retrieveInput.disabled = !miner.input.getItemCount(recipe.input.itemId);
      this.retrieve.disabled = !miner.output.getItemCount(recipe.output.itemId);
      if (miner instanceof AdvancedMachine) {
        const second = recipe.additionalInputs![0]!.itemId, name = this.player.registry.get(second).name;
        this.feedFuel.textContent = `Add ${name}`; this.retrieveFuel.textContent = `Retrieve ${name}`;
        this.feedFuel.disabled = !this.player.getItemCount(second) || miner.inputSpace(second) === 0;
        this.retrieveFuel.disabled = !miner.input.getItemCount(second);
      }
    } else {
      const deposit = miner.deposit, name = this.player.registry.get(miner.itemId).name;
      this.details.textContent = `State: ${miner.state} · Deposit: ${name} (${miner.depositId}) · Purity: ${deposit?.purity ?? 'unavailable'} · Rate: ${miner.effectiveRate} items/min · Output: ${miner.output.getItemCount(miner.itemId)} / ${miner.output.capacity * this.player.registry.get(miner.itemId).maxStackSize} ${name} · Progress: ${Math.floor(miner.progress * 100)}%`;
      this.retrieve.disabled = miner.output.getItemCount(miner.itemId) === 0;
    }
    this.details.textContent += network;
    if (miner instanceof Processor) {
      this.details.textContent += ` · Produced by this machine (${this.player.registry.get(miner.recipe.output.itemId).name}): ${miner.produced(miner.recipe.output.itemId)}`;
      this.feed.textContent = `Add ${this.player.registry.get(miner.recipe.input.itemId).name}`;
    }
    if (miner instanceof Processor) {
      const inputs = [miner.recipe.input, ...(miner.recipe.additionalInputs ?? []), ...(miner instanceof Smelter ? [SMELTER_FUEL] : [])];
      const consumption = inputs.map(input => `${this.player.registry.get(input.itemId).name}: ${miner.consumptionRate(input.itemId).toFixed(1)}/min`).join(', ');
      this.details.textContent += ` · Lifetime average: ${miner.productionRate(miner.recipe.output.itemId).toFixed(1)} produced/min · Consumed: ${consumption} · Utilization: ${(miner.utilization * 100).toFixed(1)}%`;
    } else {
      this.details.textContent += ` · Extracted: ${miner.produced} · Lifetime average: ${miner.productionRate.toFixed(1)}/min · Utilization: ${(miner.utilization * 100).toFixed(1)}%`;
    }
    if (this.factory) {
      const itemId = miner instanceof Processor ? miner.recipe.output.itemId : miner.itemId, stats = this.factory(itemId);
      this.details.textContent += ` · Factory (placed machines): ${stats.machines} · Output full: ${stats.outputFull} · Missing input: ${stats.missingInput} · No power: ${stats.noPower} · Missing coal: ${stats.missingFuel} · ${this.player.registry.get(itemId).name} produced/consumed: ${stats.productionRate.toFixed(1)}/${stats.consumptionRate.toFixed(1)} per min (lifetime averages) · Mean utilization: ${(stats.averageUtilization * 100).toFixed(1)}%`;
    }
    this.toggle.textContent = miner.enabled ? 'Disable' : 'Enable';
  }
  dispose(): void { this.recipeSelect.removeEventListener('change', this.handleRecipe); this.recipeLabel.remove(); this.feedFuel.removeEventListener('click', this.handleFeedFuel); this.retrieveFuel.removeEventListener('click', this.handleRetrieveFuel); this.feedFuel.remove(); this.retrieveFuel.remove(); this.feed.removeEventListener('click', this.handleFeed); this.retrieveInput.removeEventListener('click', this.handleRetrieveInput); this.feed.remove(); this.retrieveInput.remove(); this.close.removeEventListener('click', this.onClose); this.toggle.removeEventListener('click', this.handleToggle); this.retrieve.removeEventListener('click', this.handleRetrieve); }
  private readonly handleRecipe = (): void => {
    if (!(this.miner instanceof ConstructorMachine)) return;
    const changed = this.miner.selectRecipe(this.recipeSelect.value);
    this.notice.textContent = changed ? 'Recipe changed. Partial progress was reset.' : 'Empty both input and output before changing recipe.';
    this.update();
  };
  private readonly handleFeed = (): void => {
    if (!(this.miner instanceof Processor)) return;
    const result = this.miner.feed(this.player); this.notice.textContent = `Added ${result.moved}; ${result.remainder} remain in inventory.`; this.update();
  };
  private readonly handleRetrieveInput = (): void => {
    if (!(this.miner instanceof Processor)) return;
    const result = this.miner.retrieveInput(this.player); this.notice.textContent = `Transferred ${result.moved}; ${result.remainder} remain in input.`; this.update();
  };
  private readonly handleFeedFuel = (): void => {
    if (this.powerTarget?.generator) {
      const result = this.powerTarget.generator.feed(this.player); this.notice.textContent = `Added ${result.moved} wood; ${result.remainder} remain in inventory.`; this.update(); return;
    }
    if (this.miner instanceof AdvancedMachine) {
      const result = this.miner.feedIngredient(this.player, this.miner.recipe.additionalInputs![0]!.itemId);
      this.notice.textContent = `Added ${result.moved}; ${result.remainder} remain in inventory.`; this.update(); return;
    }
    if (!(this.miner instanceof Smelter)) return;
    const result = this.miner.feedFuel(this.player); this.notice.textContent = `Added ${result.moved} coal; ${result.remainder} remain in inventory.`; this.update();
  };
  private readonly handleRetrieveFuel = (): void => {
    if (this.powerTarget?.generator) {
      const result = this.powerTarget.generator.retrieveFuel(this.player); this.notice.textContent = `Transferred ${result.moved} wood; ${result.remainder} remain in fuel buffer.`; this.update(); return;
    }
    if (this.miner instanceof AdvancedMachine) {
      const result = this.miner.retrieveIngredient(this.player, this.miner.recipe.additionalInputs![0]!.itemId);
      this.notice.textContent = `Transferred ${result.moved}; ${result.remainder} remain in input.`; this.update(); return;
    }
    if (!(this.miner instanceof Smelter)) return;
    const result = this.miner.retrieveFuel(this.player); this.notice.textContent = `Transferred ${result.moved} coal; ${result.remainder} remain in fuel buffer.`; this.update();
  };
  private readonly handleToggle = (): void => { const target = this.miner ?? this.powerTarget?.generator; if (!target) return; target.setEnabled(!target.enabled); this.update(); };
  private readonly handleRetrieve = (): void => {
    if (!this.miner) return;
    const result = this.miner.retrieve(this.player);
    this.notice.textContent = `Transferred ${result.moved}; ${result.remainder} remain in output.`;
    this.update();
  };
}
