import type { Inventory } from '../items/Inventory';
import type { Miner } from '../machines/Miner';

/** DOM-only inspection of authoritative machine state. */
export class MachineUI {
  private miner: Miner | null = null;
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
    this.close.addEventListener('click', onClose); this.toggle.addEventListener('click', this.handleToggle);
    this.retrieve.addEventListener('click', this.handleRetrieve);
  }
  get isOpen(): boolean { return !this.root.hidden; }
  get activeMachine(): Miner | null { return this.miner; }
  open(miner: Miner): void { this.miner = miner; this.root.hidden = false; this.notice.textContent = ''; this.update(); this.close.focus(); }
  closePanel(): void { this.miner = null; this.root.hidden = true; }
  update(): void {
    const miner = this.miner; if (!this.isOpen || !miner) return;
    const deposit = miner.deposit;
    const name = this.player.registry.get(miner.itemId).name;
    this.details.textContent = `State: ${miner.state} · Deposit: ${name} (${miner.depositId}) · Purity: ${deposit?.purity ?? 'unavailable'} · Rate: ${miner.effectiveRate} items/min · Output: ${miner.output.getItemCount(miner.itemId)} / ${miner.output.capacity * this.player.registry.get(miner.itemId).maxStackSize} ${name} · Progress: ${Math.floor(miner.progress * 100)}% · Power: not required in Phase 4`;
    this.toggle.textContent = miner.enabled ? 'Disable' : 'Enable';
    this.retrieve.disabled = miner.output.getItemCount(miner.itemId) === 0;
  }
  dispose(): void { this.close.removeEventListener('click', this.onClose); this.toggle.removeEventListener('click', this.handleToggle); this.retrieve.removeEventListener('click', this.handleRetrieve); }
  private readonly handleToggle = (): void => { if (!this.miner) return; this.miner.setEnabled(!this.miner.enabled); this.update(); };
  private readonly handleRetrieve = (): void => {
    if (!this.miner) return;
    const result = this.miner.retrieve(this.player);
    this.notice.textContent = `Transferred ${result.moved}; ${result.remainder} remain in output.`;
    this.update();
  };
}
