import type { Inventory } from '../items/Inventory';
import type { LogisticsManager } from '../logistics/LogisticsManager';
import type { SplitterMode } from '../logistics/Splitter';
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
  private readonly retrieveSelected: HTMLButtonElement | null;
  private readonly retrieveQuantity: HTMLInputElement | null;
  private readonly depositQuantity: HTMLInputElement | null;
  private readonly retrieveQuantityGroup: HTMLElement | null;
  private readonly depositQuantityGroup: HTMLElement | null;
  private readonly deposit: HTMLButtonElement | null;
  private readonly storageSettings: HTMLElement | null;
  private readonly storageFilter: HTMLSelectElement | null;
  private readonly splitterSettings: HTMLElement | null;
  private readonly splitterMode: HTMLSelectElement | null;
  private readonly splitterPriority: HTMLSelectElement | null;
  private readonly splitterFilters: HTMLElement | null;
  private readonly splitterFilterSelects: readonly HTMLSelectElement[];
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
    this.storageSettings = root.querySelector<HTMLElement>('[data-storage-settings]');
    this.storageFilter = root.querySelector<HTMLSelectElement>('[data-storage-filter]');
    if (this.storageFilter) {
      const any = root.ownerDocument.createElement('option'); any.value = ''; any.textContent = 'Any item (first occupied slot)';
      this.storageFilter.replaceChildren(any);
      for (const item of this.player.registry.all()) {
        const option = root.ownerDocument.createElement('option'); option.value = item.id; option.textContent = item.name;
        this.storageFilter.append(option);
      }
      this.storageFilter.addEventListener('change', this.handleStorageFilter);
    }
    this.splitterSettings = root.querySelector<HTMLElement>('[data-splitter-settings]');
    this.splitterMode = root.querySelector<HTMLSelectElement>('[data-splitter-mode]');
    this.splitterPriority = root.querySelector<HTMLSelectElement>('[data-splitter-priority]');
    this.splitterFilters = root.querySelector<HTMLElement>('[data-splitter-filters]');
    this.splitterFilterSelects = [...root.querySelectorAll<HTMLSelectElement>('[data-splitter-filter]')];
    for (const select of this.splitterFilterSelects) {
      const any = root.ownerDocument.createElement('option'); any.value = ''; any.textContent = 'Unmatched items';
      select.replaceChildren(any);
      for (const item of this.player.registry.all()) {
        const option = root.ownerDocument.createElement('option'); option.value = item.id; option.textContent = item.name; select.append(option);
      }
      select.addEventListener('change', this.handleSplitterFilter);
    }
    this.splitterMode?.addEventListener('change', this.handleSplitterConfig);
    this.splitterPriority?.addEventListener('change', this.handleSplitterConfig);
    this.retrieveQuantity = root.querySelector<HTMLInputElement>('[data-logistics-retrieve-quantity]');
    this.depositQuantity = root.querySelector<HTMLInputElement>('[data-logistics-deposit-quantity]');
    this.retrieveQuantityGroup = root.querySelector<HTMLElement>('[data-logistics-retrieve-quantity-group]');
    this.depositQuantityGroup = root.querySelector<HTMLElement>('[data-logistics-deposit-quantity-group]');
    this.root.addEventListener('keydown', this.handleModalKey);
    this.retrieveSelected = root.querySelector<HTMLButtonElement>('[data-logistics-retrieve-selected]');
    this.retrieveSelected?.addEventListener('click', this.handleRetrieveSelected);
    this.deposit = root.querySelector<HTMLButtonElement>('[data-logistics-deposit]');
    this.deposit?.addEventListener('click', this.handleDeposit);
    this.close.addEventListener('click', this.onClose); this.retrieve.addEventListener('click', this.handleRetrieve);
  }
  get isOpen(): boolean { return !this.root.hidden; }
  open(id: string): void { if (this.retrieveQuantity) this.retrieveQuantity.value = ''; if (this.depositQuantity) this.depositQuantity.value = ''; this.active = id; this.selected = null; this.playerSelected = null; this.shownRevision = -1; this.shownPlayerRevision = -1; this.root.hidden = false; this.notice.textContent = ''; this.update(); this.close.focus(); }
  closePanel(): void { this.active = null; this.selected = null; this.root.hidden = true; }
  update(): void {
    if (!this.active || !this.isOpen) return;
    const segment = this.logistics.network.get(this.active), receiver = this.logistics.terminal(this.active), splitter = this.logistics.splitter(this.active), merger = this.logistics.merger(this.active);
    if (this.splitterSettings) this.splitterSettings.hidden = !splitter;
    if (this.splitterFilters) this.splitterFilters.hidden = !splitter || splitter.mode !== 'filtered';
    const isStorage = !!receiver && this.logistics.isStorage(this.active);
    if (this.retrieveSelected) this.retrieveSelected.hidden = !receiver;
    if (this.retrieveQuantityGroup) this.retrieveQuantityGroup.hidden = !receiver;
    if (this.depositQuantityGroup) this.depositQuantityGroup.hidden = !isStorage;
    if (this.storageSettings) this.storageSettings.hidden = !isStorage;
    if (this.storageFilter && isStorage) this.storageFilter.value = this.logistics.storageOutputFilter(this.active) ?? '';
    if (segment) {
      this.title.textContent = `Conveyor: ${segment.path.spec.shape}`;
      const heading = this.root.querySelector('[data-logistics-storage-heading]'), badge = this.root.querySelector('[data-logistics-storage-badge]');
      if (heading) heading.textContent = 'Conveyor';
      if (badge) badge.textContent = 'FLOW';
      const flow = this.logistics.network.flowStats(segment.id)!;
      const theoretical = Math.min(segment.settings.throughputPerMinute, 60 * segment.settings.speed / segment.settings.spacing);
      const d = segment.path.direction('output');
      const direction = d.x > 0 ? 'east' : d.x < 0 ? 'west' : d.z > 0 ? 'south' : 'north';
      this.details.textContent = `State: ${segment.state} · Direction: ${direction} · Input: ${segment.input ?? segment.source?.id ?? 'not connected'} · Output: ${segment.output ?? segment.receiver?.id ?? 'not connected'} · Items: ${segment.items.length} · Maximum throughput: ${segment.settings.throughputPerMinute} items/min · Theoretical limit: ${Number(theoretical.toFixed(1))} items/min · Observed outputs (up to 60 s, 1 s bins): ${flow.lastMinute} items / 60 s · Total sent: ${flow.total} · Simulation paused while inspecting · ${segment.state === 'BLOCKED' ? (segment.output || segment.receiver || this.logistics.network.isCell(segment.id) ? 'Downstream is full or occupied.' : 'Open end: connect another belt or a receiver.') : segment.state === 'DISCONNECTED' ? 'Connect the input to a source.' : !segment.output && !segment.receiver ? (this.logistics.network.isOutputBlocked(segment.id) ? 'Output obstructed or disconnected: items will stop here.' : this.logistics.network.dropsOpenEnds ? 'Open end: items fall off.' : 'Open end: items will stop here.') : ''}`;
      if (this.deposit) this.deposit.hidden = true;
      this.grid.hidden = true; this.playerPane.hidden = true; this.slotDetail.textContent = ''; this.retrieve.hidden = true;
    } else if (splitter) {
      this.title.textContent = 'Splitter';
      const heading = this.root.querySelector('[data-logistics-storage-heading]'), badge = this.root.querySelector('[data-logistics-storage-badge]');
      if (heading) heading.textContent = 'Splitter';
      if (badge) badge.textContent = splitter.mode.toUpperCase();
      if (this.splitterMode) this.splitterMode.value = splitter.mode;
      if (this.splitterPriority) { this.splitterPriority.value = String(splitter.priority); this.splitterPriority.disabled = splitter.mode === 'balanced' || splitter.mode === 'filtered'; }
      for (const select of this.splitterFilterSelects) select.value = splitter.filters[Number(select.dataset.splitterFilter)] ?? '';
      this.details.textContent = splitter.pending ? `Buffered: ${this.player.registry.get(splitter.pending).name}. ${splitter.mode === 'filtered' ? 'Waiting for an eligible output; check filters and connections or retrieve it.' : 'Connect an output or retrieve it.'}` : `${splitter.mode === 'balanced' ? 'Balanced distribution' : splitter.mode === 'overflow' ? 'Overflow distribution' : splitter.mode === 'priority' ? 'Strict priority' : 'Filtered distribution'} · buffer empty.`;
      this.grid.hidden = true; this.playerPane.hidden = true; this.slotDetail.textContent = '';
      if (this.deposit) this.deposit.hidden = true;
      this.retrieve.hidden = false; this.retrieve.disabled = !splitter.pending;
    } else if (merger) {
      this.title.textContent = 'Merger';
      const heading = this.root.querySelector('[data-logistics-storage-heading]'), badge = this.root.querySelector('[data-logistics-storage-badge]');
      if (heading) heading.textContent = 'Merger';
      if (badge) badge.textContent = 'FAIR INPUTS';
      this.details.textContent = `Buffered: ${merger.pending.filter(Boolean).map((id) => this.player.registry.get(id!).name).join(', ') || 'empty'} · inputs served round-robin.`;
      this.grid.hidden = true; this.playerPane.hidden = true; this.slotDetail.textContent = '';
      if (this.deposit) this.deposit.hidden = true;
      this.retrieve.hidden = false; this.retrieve.disabled = !merger.occupied;
    } else if (receiver) {
      this.title.textContent = isStorage ? 'Storage Container' : 'Receiving Terminal';
      const heading = this.root.querySelector('[data-logistics-storage-heading]'), badge = this.root.querySelector('[data-logistics-storage-badge]');
      if (heading) heading.textContent = isStorage ? 'Container' : 'Terminal';
      if (badge) badge.textContent = isStorage ? 'INPUT / OUTPUT' : 'INPUT';
      this.details.textContent = `Capacity: ${receiver.usedSlots} / ${receiver.capacity} slots`;
      this.grid.hidden = false; this.playerPane.hidden = false;
      if (this.shownPlayerRevision !== this.player.revision) { this.playerSelected = null; if (this.depositQuantity) this.depositQuantity.value = ''; this.renderPlayer(); }
      if (this.shownRevision !== receiver.revision) { this.selected = null; if (this.retrieveQuantity) this.retrieveQuantity.value = ''; this.renderSlots(receiver); }
      if (this.deposit) { this.deposit.hidden = !isStorage; this.deposit.disabled = this.playerSelected === null || !this.player.snapshot()[this.playerSelected]; }
      if (this.retrieveSelected) this.retrieveSelected.disabled = this.selected === null || !receiver.snapshot()[this.selected];
      if (this.retrieveQuantity) this.retrieveQuantity.disabled = this.selected === null;
      if (this.depositQuantity) this.depositQuantity.disabled = !isStorage || this.playerSelected === null;
      this.retrieve.hidden = false; this.retrieve.disabled = receiver.usedSlots === 0;
    }
  }
  dispose(): void { this.root.removeEventListener('keydown', this.handleModalKey); this.retrieveSelected?.removeEventListener('click', this.handleRetrieveSelected); for (const select of this.splitterFilterSelects) select.removeEventListener('change', this.handleSplitterFilter); this.storageFilter?.removeEventListener('change', this.handleStorageFilter); this.splitterMode?.removeEventListener('change', this.handleSplitterConfig); this.splitterPriority?.removeEventListener('change', this.handleSplitterConfig); this.deposit?.removeEventListener('click', this.handleDeposit); this.playerGrid.removeEventListener('click', this.handlePlayerGrid); this.grid.removeEventListener('click', this.handleGrid); this.close.removeEventListener('click', this.onClose); this.retrieve.removeEventListener('click', this.handleRetrieve); }
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
    if (this.shownPlayerRevision !== this.player.revision) { this.update(); return; }
    const button = event.target.closest<HTMLButtonElement>('button[data-slot]');
    if (!button || !this.playerGrid.contains(button)) return;
    const index = Number(button.dataset.slot);
    this.playerSelected = this.player.snapshot()[index] && this.playerSelected !== index ? index : null;
    if (this.depositQuantity) this.depositQuantity.value = '';
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
      this.slotDetail.textContent = 'Select a slot to retrieve its stack, or retrieve all contents. Only what fits is transferred.';
    }
    this.shownRevision = inventory.revision;
  }
  private readonly handleGrid = (event: Event): void => {
    if (!(event.target instanceof Element) || !this.active || !this.isOpen) return;
    const button = event.target.closest<HTMLButtonElement>('button[data-slot]');
    const receiver = this.logistics.terminal(this.active);
    if (!button || !this.grid.contains(button) || !receiver) return;
    if (this.shownRevision !== receiver.revision) { this.update(); return; }
    const index = Number(button.dataset.slot);
    this.selected = receiver.snapshot()[index] && this.selected !== index ? index : null;
    if (this.retrieveQuantity) this.retrieveQuantity.value = '';
    this.renderSlots(receiver); this.update();
  };
  private readonly handleStorageFilter = (): void => {
    if (!this.active || !this.isOpen || !this.storageFilter || !this.logistics.isStorage(this.active)) return;
    this.logistics.setStorageOutputFilter(this.active, this.storageFilter.value || null); this.update();
  };
  private readonly handleSplitterConfig = (): void => {
    if (!this.active || !this.splitterMode || !this.splitterPriority) return;
    const splitter = this.logistics.splitter(this.active); if (!splitter) return;
    splitter.configure(this.splitterMode.value as SplitterMode, Number(this.splitterPriority.value)); this.update();
  };
  private readonly handleSplitterFilter = (event: Event): void => {
    if (!this.active || !this.isOpen || !(event.currentTarget instanceof HTMLSelectElement)) return;
    const splitter = this.logistics.splitter(this.active); if (!splitter) return;
    splitter.setOutputFilter(Number(event.currentTarget.dataset.splitterFilter), event.currentTarget.value || null); this.update();
  };
  private readonly handleModalKey = (event: KeyboardEvent): void => {
    if (event.code === 'Escape' && this.isOpen) { event.preventDefault(); event.stopPropagation(); if (!event.repeat) this.onClose(); }
  };
  /** Null means invalid; undefined means the whole selected stack. */
  private requestedQuantity(input: HTMLInputElement | null, max: number): number | null | undefined {
    if (!input) return undefined;
    if (input.validity.badInput) return null;
    if (input.value === '') return undefined;
    const value = input.valueAsNumber;
    return Number.isSafeInteger(value) && value > 0 && value <= max ? value : null;
  }
  private readonly handleDeposit = (): void => {
    if (!this.active || !this.isOpen || !this.logistics.isStorage(this.active) || this.playerSelected === null) return;
    const inventory = this.logistics.terminal(this.active);
    if (!inventory) return;
    if (this.shownPlayerRevision !== this.player.revision) { this.update(); this.notice.textContent = 'Inventory changed; select a stack again.'; return; }
    const slot = this.player.snapshot()[this.playerSelected]; if (!slot) return;
    const amount = this.requestedQuantity(this.depositQuantity, slot.quantity);
    if (amount === null) { this.notice.textContent = `Choose a whole number from 1 to ${slot.quantity}, or leave blank for the whole stack.`; return; }
    const result = this.player.transferStack(inventory, this.playerSelected, amount);
    this.notice.textContent = `Stored ${result.moved}; ${slot.quantity - result.moved} remain in inventory.`; this.update();
  };
  private readonly handleRetrieveSelected = (): void => {
    if (!this.active || !this.isOpen || this.selected === null) return;
    const inventory = this.logistics.terminal(this.active); if (!inventory) return;
    if (this.shownRevision !== inventory.revision) { this.update(); this.notice.textContent = 'Storage changed; select a stack again.'; return; }
    const slot = inventory.snapshot()[this.selected]; if (!slot) return;
    const amount = this.requestedQuantity(this.retrieveQuantity, slot.quantity);
    if (amount === null) { this.notice.textContent = `Choose a whole number from 1 to ${slot.quantity}, or leave blank for the whole stack.`; return; }
    const result = inventory.transferStack(this.player, this.selected, amount);
    this.notice.textContent = `Transferred ${result.moved}; ${slot.quantity - result.moved} remain in the selected stack.`; this.update();
  };
  private readonly handleRetrieve = (): void => {
    if (!this.active || !this.isOpen || (!this.logistics.terminal(this.active) && !this.logistics.splitter(this.active) && !this.logistics.merger(this.active))) return;
    const result = this.logistics.retrieve(this.active, this.player);
    this.notice.textContent = `Transferred ${result.moved}; ${result.remainder} remain.`; this.update();
  };
}
