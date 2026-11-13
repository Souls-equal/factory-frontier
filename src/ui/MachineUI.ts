import type { Inventory } from '../items/Inventory';
import type { Miner } from '../machines/Miner';
import { Smelter } from '../machines/Smelter';

/** DOM-only inspection of authoritative machine state. */
export class MachineUI {
  private miner: Miner | Smelter | null = null;
  private readonly feed: HTMLButtonElement;
  private readonly retrieveInput: HTMLButtonElement;
  private readonly details: HTMLElement;
  private readonly close: HTMLButtonElement;
  private readonly toggle: HTMLButtonElement;
  private readonly retrieve: HTMLButtonElement;
  private readonly notice: HTMLElement;
  constructor(private readonly root: HTMLElement, private readonly player: Inventory, private readonly onClose: () => void) {
    const find = <T extends HTMLElement>(selector: string): T => {
      const result = root.querySelector<T>(selector); if (!result) throw new Error(`Missing machine UI ${selector}`); return result;
    };
    this.details = find('[data-machine-details]'); this.close = find('[data-machine-close]');
    this.toggle = find('[data-machine-toggle]'); this.retrieve = find('[data-machine-retrieve]'); this.notice = find('[data-machine-notice]');
    this.feed = root.ownerDocument.createElement('button'); this.feed.type = 'button'; this.feed.textContent = 'Add iron ore'; this.feed.dataset.machineFeed = '';
    this.retrieveInput = root.ownerDocument.createElement('button'); this.retrieveInput.type = 'button'; this.retrieveInput.textContent = 'Retrieve input'; this.retrieveInput.dataset.machineRetrieveInput = '';
    this.toggle.parentElement?.append(this.feed, this.retrieveInput);
    this.feed.addEventListener('click', this.handleFeed); this.retrieveInput.addEventListener('click', this.handleRetrieveInput);
    this.close.addEventListener('click', onClose); this.toggle.addEventListener('click', this.handleToggle);
    this.retrieve.addEventListener('click', this.handleRetrieve);
  }
  get isOpen(): boolean { return !this.root.hidden; }
  get activeMachine(): Miner | Smelter | null { return this.miner; }
  open(miner: Miner | Smelter): void {
    this.miner = miner; this.root.hidden = false; this.notice.textContent = '';
    const name = miner instanceof Smelter ? 'Smelter' : 'Miner Mk.1';
    const title = this.root.querySelector('[data-machine-title]'); if (title) title.textContent = name;
    this.root.setAttribute('aria-label', name); this.update(); this.close.focus();
  }
  closePanel(): void { this.miner = null; this.root.hidden = true; }
  update(): void {
    const miner = this.miner; if (!this.isOpen || !miner) return;
    this.feed.hidden = !(miner instanceof Smelter); this.retrieveInput.hidden = !(miner instanceof Smelter);
    if (miner instanceof Smelter) {
      const recipe = miner.recipe, input = this.player.registry.get(recipe.input.itemId).name, output = this.player.registry.get(recipe.output.itemId).name;
      this.details.textContent = `State: ${miner.state} · Recipe: ${recipe.input.quantity} ${input} → ${recipe.output.quantity} ${output} / ${recipe.durationMs / 1000}s · Input: ${miner.input.getItemCount(recipe.input.itemId)} · Output: ${miner.output.getItemCount(recipe.output.itemId)} · Progress: ${Math.floor(miner.progress * 100)}% · Power: not required yet · Cyan input at rear, yellow output at front`;
      this.feed.disabled = !this.player.getItemCount(recipe.input.itemId) || miner.input.getAvailableSpace(recipe.input.itemId) === 0;
      this.retrieveInput.disabled = !miner.input.getItemCount(recipe.input.itemId);
      this.retrieve.disabled = !miner.output.getItemCount(recipe.output.itemId);
    } else {
      const deposit = miner.deposit, name = this.player.registry.get(miner.itemId).name;
      this.details.textContent = `State: ${miner.state} · Deposit: ${name} (${miner.depositId}) · Purity: ${deposit?.purity ?? 'unavailable'} · Rate: ${miner.effectiveRate} items/min · Output: ${miner.output.getItemCount(miner.itemId)} / ${miner.output.capacity * this.player.registry.get(miner.itemId).maxStackSize} ${name} · Progress: ${Math.floor(miner.progress * 100)}% · Power: not required in Phase 4`;
      this.retrieve.disabled = miner.output.getItemCount(miner.itemId) === 0;
    }
    this.toggle.textContent = miner.enabled ? 'Disable' : 'Enable';
  }
  dispose(): void { this.feed.removeEventListener('click', this.handleFeed); this.retrieveInput.removeEventListener('click', this.handleRetrieveInput); this.feed.remove(); this.retrieveInput.remove(); this.close.removeEventListener('click', this.onClose); this.toggle.removeEventListener('click', this.handleToggle); this.retrieve.removeEventListener('click', this.handleRetrieve); }
  private readonly handleFeed = (): void => {
    if (!(this.miner instanceof Smelter)) return;
    const result = this.miner.feed(this.player); this.notice.textContent = `Added ${result.moved}; ${result.remainder} remain in inventory.`; this.update();
  };
  private readonly handleRetrieveInput = (): void => {
    if (!(this.miner instanceof Smelter)) return;
    const result = this.miner.retrieveInput(this.player); this.notice.textContent = `Transferred ${result.moved}; ${result.remainder} remain in input.`; this.update();
  };
  private readonly handleToggle = (): void => { if (!this.miner) return; this.miner.setEnabled(!this.miner.enabled); this.update(); };
  private readonly handleRetrieve = (): void => {
    if (!this.miner) return;
    const result = this.miner.retrieve(this.player);
    this.notice.textContent = `Transferred ${result.moved}; ${result.remainder} remain in output.`;
    this.update();
  };
}
