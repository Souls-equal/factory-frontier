import type { Inventory } from '../items/Inventory';
import type { LogisticsManager } from '../logistics/LogisticsManager';
import { createInventorySlot } from './InventorySlot';

export class LogisticsUI {
  private active: string | null = null;
  private selected: number | null = null;
  private shownRevision = -1;
  private readonly playerGrid: HTMLElement;
  private readonly playerPane: HTMLElement;
  private readonly playerCapacity: HTMLElement;
  private readonly playerDetail: HTMLElement;
  private shownPlayerRevision = -1;
  private playerSelected: number | null = null;
  private readonly grid: HTMLElement;
  private readonly slotDetail: HTMLElement;
  private readonly details: HTMLElement;
  private readonly title: HTMLElement;
  private readonly notice: HTMLElement;
  private readonly close: HTMLButtonElement;
  private readonly retrieve: HTMLButtonElement;
  private readonly deposit: HTMLButtonElement | null;
  constructor(private readonly root: HTMLElement, private readonly logistics: LogisticsManager,
    private readonly player: Inventory, private readonly onClose: () => void) {
    const find = <T extends HTMLElement>(selector: string): T => {
      const found = root.querySelector<T>(selector); if (!found) throw new Error(`Missing logistics UI ${selector}`); return found;
    };
    this.playerGrid = find('[data-logistics-player-grid]'); this.playerPane = find('[data-logistics-player-pane]');
    this.playerCapacity = find('[data-logistics-player-capacity]'); this.playerDetail = find('[data-logistics-player-detail]');
    this.playerGrid.addEventListener('click', this.handlePlayerGrid);
    this.grid = find('[data-logistics-grid]'); this.slotDetail = find('[data-logistics-slot-detail]');
    this.grid.addEventListener('click', this.handleGrid);
    this.details = find('[data-logistics-details]'); this.title = find('[data-logistics-title]'); this.notice = find('[data-logistics-notice]');
    this.close = find('[data-logistics-close]'); this.retrieve = find('[data-logistics-retrieve]');
    this.deposit = root.querySelector<HTMLButtonElement>('[data-logistics-deposit]');
    this.deposit?.addEventListener('click', this.handleDeposit);
    this.close.addEventListener('click', this.onClose); this.retrieve.addEventListener('click', this.handleRetrieve);
  }
  get isOpen(): boolean { return !this.root.hidden; }
  open(id: string): void { this.active = id; this.selected = null; this.playerSelected = null; this.shownRevision = -1; this.shownPlayerRevision = -1; this.root.hidden = false; this.notice.textContent = ''; this.update(); this.close.focus(); }
  closePanel(): void { this.active = null; this.selected = null; this.root.hidden = true; }
  update(): void {
    if (!this.active || !this.isOpen) return;
    const segment = this.logistics.network.get(this.active), receiver = this.logistics.terminal(this.active);
    if (segment) {
      this.title.textContent = `Conveyor: ${segment.path.spec.shape}`;
      const d = segment.path.direction('output');
      const direction = d.x > 0 ? 'east' : d.x < 0 ? 'west' : d.z > 0 ? 'south' : 'north';
      this.details.textContent = `State: ${segment.state} · Direction: ${direction} · Input: ${segment.input ?? segment.source?.id ?? 'not connected'} · Output: ${segment.output ?? segment.receiver?.id ?? 'not connected'} · Items: ${segment.items.length} · Maximum throughput: ${segment.settings.throughputPerMinute} items/min · ${segment.state === 'BLOCKED' ? (segment.output || segment.receiver || this.logistics.network.isCell(segment.id) ? 'Downstream is full or occupied.' : 'Open end: connect another belt or a receiver.') : segment.state === 'DISCONNECTED' ? 'Connect the input to a source.' : !segment.output && !segment.receiver ? (this.logistics.network.dropsOpenEnds ? 'Open end: items fall off.' : 'Open end: items will stop here.') : ''}`;
      if (this.deposit) this.deposit.hidden = true;
      this.grid.hidden = true; this.playerPane.hidden = true; this.slotDetail.textContent = ''; this.retrieve.hidden = true;
    } else if (receiver) {
      const isStorage = this.logistics.isStorage(this.active);
      this.title.textContent = isStorage ? 'Storage Container' : 'Receiving Terminal';
      const heading = this.root.querySelector('[data-logistics-storage-heading]'), badge = this.root.querySelector('[data-logistics-storage-badge]');
      if (heading) heading.textContent = isStorage ? 'Container' : 'Terminal';
      if (badge) badge.textContent = isStorage ? 'INPUT / OUTPUT' : 'INPUT';
      if (this.deposit) { this.deposit.hidden = !isStorage; this.deposit.disabled = this.playerSelected === null || !this.player.snapshot()[this.playerSelected]; }
      this.details.textContent = `Capacity: ${receiver.usedSlots} / ${receiver.capacity} slots`;
      this.grid.hidden = false; this.playerPane.hidden = false;
      if (this.shownPlayerRevision !== this.player.revision) this.renderPlayer();
      if (this.shownRevision !== receiver.revision) this.renderSlots(receiver);
      this.retrieve.hidden = false; this.retrieve.disabled = receiver.usedSlots === 0;
    }
  }
  dispose(): void { this.deposit?.removeEventListener('click', this.handleDeposit); this.playerGrid.removeEventListener('click', this.handlePlayerGrid); this.grid.removeEventListener('click', this.handleGrid); this.close.removeEventListener('click', this.onClose); this.retrieve.removeEventListener('click', this.handleRetrieve); }
  private renderPlayer(): void {
    const slots = this.player.snapshot();
    this.playerGrid.replaceChildren();
    slots.forEach((slot, index) => {
      const button = createInventorySlot(this.root.ownerDocument, this.player, slot, index);
      button.classList.toggle('is-selected', this.playerSelected === index);
      this.playerGrid.append(button);
    });
    this.playerCapacity.textContent = `Capacity: ${this.player.usedSlots} / ${this.player.capacity} slots`;
    const selected = this.playerSelected === null ? null : slots[this.playerSelected];
    if (selected) {
      const item = this.player.registry.get(selected.itemId);
      this.playerDetail.textContent = `${item.name} — ${item.description} Stack: ${selected.quantity} / ${item.maxStackSize}.`;
    } else { this.playerSelected = null; this.playerDetail.textContent = 'Items carried by you. Select a slot to inspect.'; }
    this.shownPlayerRevision = this.player.revision;
  }
  private readonly handlePlayerGrid = (event: Event): void => {
    if (!(event.target instanceof Element) || !this.isOpen || this.playerPane.hidden) return;
    const button = event.target.closest<HTMLButtonElement>('button[data-slot]');
    if (!button || !this.playerGrid.contains(button)) return;
    const index = Number(button.dataset.slot);
    this.playerSelected = this.player.snapshot()[index] && this.playerSelected !== index ? index : null;
    this.renderPlayer(); this.update();
  };
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
  private readonly handleDeposit = (): void => {
    if (!this.active || !this.logistics.isStorage(this.active) || this.playerSelected === null) return;
    const inventory = this.logistics.terminal(this.active), slot = this.player.snapshot()[this.playerSelected];
    if (!inventory || !slot) return;
    const result = this.player.transferItem(inventory, slot.itemId, slot.quantity);
    this.notice.textContent = `Stored ${result.moved}; ${result.remainder} remain in inventory.`; this.update();
  };
  private readonly handleRetrieve = (): void => {
    if (!this.active || !this.logistics.terminal(this.active)) return;
    const result = this.logistics.retrieve(this.active, this.player);
    this.notice.textContent = `Transferred ${result.moved}; ${result.remainder} remain.`; this.update();
  };
}
