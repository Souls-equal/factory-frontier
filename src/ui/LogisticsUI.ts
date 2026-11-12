import type { Inventory } from '../items/Inventory';
import type { LogisticsManager } from '../logistics/LogisticsManager';
import { createInventorySlot } from './InventorySlot';

export class LogisticsUI {
  private active: string | null = null;
  private selected: number | null = null;
  private shownRevision = -1;
  private readonly grid: HTMLElement;
  private readonly slotDetail: HTMLElement;
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
    this.grid = find('[data-logistics-grid]'); this.slotDetail = find('[data-logistics-slot-detail]');
    this.grid.addEventListener('click', this.handleGrid);
    this.details = find('[data-logistics-details]'); this.title = find('[data-logistics-title]'); this.notice = find('[data-logistics-notice]');
    this.close = find('[data-logistics-close]'); this.retrieve = find('[data-logistics-retrieve]');
    this.close.addEventListener('click', this.onClose); this.retrieve.addEventListener('click', this.handleRetrieve);
  }
  get isOpen(): boolean { return !this.root.hidden; }
  open(id: string): void { this.active = id; this.selected = null; this.shownRevision = -1; this.root.hidden = false; this.notice.textContent = ''; this.update(); this.close.focus(); }
  closePanel(): void { this.active = null; this.selected = null; this.root.hidden = true; }
  update(): void {
    if (!this.active || !this.isOpen) return;
    const segment = this.logistics.network.get(this.active), receiver = this.logistics.terminal(this.active);
    if (segment) {
      this.title.textContent = `Conveyor: ${segment.path.spec.shape}`;
      const d = segment.path.direction('output');
      const direction = d.x > 0 ? 'east' : d.x < 0 ? 'west' : d.z > 0 ? 'south' : 'north';
      this.details.textContent = `State: ${segment.state} · Direction: ${direction} · Input: ${segment.input ?? segment.source?.id ?? 'not connected'} · Output: ${segment.output ?? segment.receiver?.id ?? 'not connected'} · Items: ${segment.items.length} · Maximum throughput: ${segment.settings.throughputPerMinute} items/min · ${segment.state === 'BLOCKED' ? (segment.output || segment.receiver || this.logistics.network.isCell(segment.id) ? 'Downstream is full or occupied.' : 'Open end: connect another belt or a receiver.') : segment.state === 'DISCONNECTED' ? 'Connect the input to a source.' : !segment.output && !segment.receiver ? (this.logistics.network.dropsOpenEnds ? 'Open end: items fall off.' : 'Open end: items will stop here.') : ''}`;
      this.grid.hidden = true; this.slotDetail.textContent = ''; this.retrieve.hidden = true;
    } else if (receiver) {
      this.title.textContent = 'Receiving Terminal';
      this.details.textContent = `Capacity: ${receiver.usedSlots} / ${receiver.capacity} slots`;
      this.grid.hidden = false;
      if (this.shownRevision !== receiver.revision) this.renderSlots(receiver);
      this.retrieve.hidden = false; this.retrieve.disabled = receiver.usedSlots === 0;
    }
  }
  dispose(): void { this.grid.removeEventListener('click', this.handleGrid); this.close.removeEventListener('click', this.onClose); this.retrieve.removeEventListener('click', this.handleRetrieve); }
  private renderSlots(inventory: Inventory): void {
    const slots = inventory.snapshot();
    this.grid.replaceChildren();
    slots.forEach((slot, index) => {
      const button = createInventorySlot(this.root.ownerDocument, inventory, slot, index);
      button.classList.toggle('is-selected', this.selected === index);
      this.grid.append(button);
    });
    const selected = this.selected === null ? null : slots[this.selected];
    if (selected) {
      const item = inventory.registry.get(selected.itemId);
      this.slotDetail.textContent = `${item.name} — ${item.description} Stack: ${selected.quantity} / ${item.maxStackSize}.`;
    } else {
      this.selected = null;
      this.slotDetail.textContent = 'Select a slot to inspect. Retrieve contents transfers what fits to your inventory.';
    }
    this.shownRevision = inventory.revision;
  }
  private readonly handleGrid = (event: Event): void => {
    if (!(event.target instanceof Element) || !this.active) return;
    const button = event.target.closest<HTMLButtonElement>('button[data-slot]');
    const receiver = this.logistics.terminal(this.active);
    if (!button || !this.grid.contains(button) || !receiver) return;
    const index = Number(button.dataset.slot);
    this.selected = receiver.snapshot()[index] && this.selected !== index ? index : null;
    this.renderSlots(receiver);
  };
  private readonly handleRetrieve = (): void => {
    if (!this.active || !this.logistics.terminal(this.active)) return;
    const result = this.logistics.retrieve(this.active, this.player);
    this.notice.textContent = `Transferred ${result.moved}; ${result.remainder} remain.`; this.update();
  };
}
