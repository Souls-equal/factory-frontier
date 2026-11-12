import type { Inventory } from '../items/Inventory';
import type { LogisticsManager } from '../logistics/LogisticsManager';

export class LogisticsUI {
  private active: string | null = null;
  private readonly details: HTMLElement;
  private readonly title: HTMLElement;
  private readonly notice: HTMLElement;
  private readonly close: HTMLButtonElement;
  private readonly retrieve: HTMLButtonElement;
  constructor(private readonly root: HTMLElement, private readonly logistics: LogisticsManager,
    private readonly player: Inventory, private readonly onClose: () => void) {
    const find = <T extends HTMLElement>(selector: string): T => {
      const found = root.querySelector<T>(selector); if (!found) throw new Error(`Missing logistics UI ${selector}`); return found;
    };
    this.details = find('[data-logistics-details]'); this.title = find('[data-logistics-title]'); this.notice = find('[data-logistics-notice]');
    this.close = find('[data-logistics-close]'); this.retrieve = find('[data-logistics-retrieve]');
    this.close.addEventListener('click', this.onClose); this.retrieve.addEventListener('click', this.handleRetrieve);
  }
  get isOpen(): boolean { return !this.root.hidden; }
  open(id: string): void { this.active = id; this.root.hidden = false; this.notice.textContent = ''; this.update(); this.close.focus(); }
  closePanel(): void { this.active = null; this.root.hidden = true; }
  update(): void {
    if (!this.active || !this.isOpen) return;
    const segment = this.logistics.network.get(this.active), receiver = this.logistics.terminal(this.active);
    if (segment) {
      this.title.textContent = `Conveyor: ${segment.path.spec.shape}`;
      const d = segment.path.direction('output');
      const direction = d.x > 0 ? 'east' : d.x < 0 ? 'west' : d.z > 0 ? 'south' : 'north';
      this.details.textContent = `State: ${segment.state} · Direction: ${direction} · Input: ${segment.input ?? segment.source?.id ?? 'not connected'} · Output: ${segment.output ?? segment.receiver?.id ?? 'not connected'} · Items: ${segment.items.length} · Maximum throughput: ${segment.settings.throughputPerMinute} items/min · ${segment.state === 'BLOCKED' ? 'Downstream is full or occupied.' : segment.state === 'DISCONNECTED' ? 'Connect a source and receiver.' : ''}`;
      this.retrieve.hidden = true;
    } else if (receiver) {
      this.title.textContent = 'Receiving Terminal';
      const contents = receiver.snapshot().filter((entry) => entry !== null).map((entry) => `${this.player.registry.get(entry.itemId).name}: ${entry.quantity}`);
      this.details.textContent = `Capacity: ${receiver.usedSlots} / ${receiver.capacity} slots · ${contents.join(' · ') || 'Empty'}`;
      this.retrieve.hidden = false; this.retrieve.disabled = receiver.usedSlots === 0;
    }
  }
  dispose(): void { this.close.removeEventListener('click', this.onClose); this.retrieve.removeEventListener('click', this.handleRetrieve); }
  private readonly handleRetrieve = (): void => {
    if (!this.active || !this.logistics.terminal(this.active)) return;
    const result = this.logistics.retrieve(this.active, this.player);
    this.notice.textContent = `Transferred ${result.moved}; ${result.remainder} remain.`; this.update();
  };
}
