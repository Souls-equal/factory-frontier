import type { Inventory } from '../items/Inventory';

/** DOM-only presentation. Inventory remains authoritative and Three-free. */
export class InventoryUI {
  private selected: number | null = null;
  private shownRevision = -1;
  private dragSource: { readonly slot: number; readonly revision: number } | null = null;
  private readonly grid: HTMLElement;
  private readonly detail: HTMLElement;
  private readonly capacity: HTMLElement;
  private readonly split: HTMLButtonElement;
  private readonly close: HTMLButtonElement;
  constructor(private readonly root: HTMLElement, private readonly inventory: Inventory,
    private readonly onClose: () => void) {
    const find = <T extends HTMLElement>(selector: string): T => {
      const element = root.querySelector<T>(selector);
      if (!element) throw new Error(`Missing inventory element ${selector}`);
      return element;
    };
    this.grid = find('[data-inventory-grid]');
    this.detail = find('[data-inventory-detail]');
    this.capacity = find('[data-inventory-capacity]');
    this.split = find('[data-inventory-split]');
    this.close = find('[data-inventory-close]');
    this.grid.addEventListener('click', this.handleGrid);
    this.grid.addEventListener('dragstart', this.handleDragStart);
    this.grid.addEventListener('dragover', this.handleDragOver);
    this.grid.addEventListener('drop', this.handleDrop);
    this.grid.addEventListener('dragend', this.handleDragEnd);
    this.root.addEventListener('click', this.handleBackgroundClick);
    this.split.addEventListener('click', this.handleSplit);
    this.close.addEventListener('click', this.onClose);
  }
  get isOpen(): boolean { return !this.root.hidden; }
  open(): void { this.root.hidden = false; this.selected = null; this.dragSource = null; this.render(); this.close.focus(); }
  closePanel(): void { this.root.hidden = true; this.selected = null; this.dragSource = null; }
  update(): void {
    if (this.isOpen && this.shownRevision !== this.inventory.revision) {
      this.dragSource = null; // Cancel rather than acting on a stale source slot.
      this.render();
    }
  }
  dispose(): void {
    this.dragSource = null;
    this.grid.removeEventListener('click', this.handleGrid);
    this.grid.removeEventListener('dragstart', this.handleDragStart);
    this.grid.removeEventListener('dragover', this.handleDragOver);
    this.grid.removeEventListener('drop', this.handleDrop);
    this.grid.removeEventListener('dragend', this.handleDragEnd);
    this.root.removeEventListener('click', this.handleBackgroundClick);
    this.split.removeEventListener('click', this.handleSplit);
    this.close.removeEventListener('click', this.onClose);
  }
  private slotButton(event: Event): HTMLButtonElement | null {
    const target = event.target;
    if (!(target instanceof Element)) return null;
    const button = target.closest<HTMLButtonElement>('button[data-slot]');
    return button && this.grid.contains(button) ? button : null;
  }
  private readonly handleGrid = (event: Event): void => {
    const button = this.slotButton(event);
    if (!button) return;
    const index = Number(button.dataset.slot);
    // Selection is inspection only. No inventory mutation can result from clicks.
    this.selected = this.inventory.snapshot()[index] && this.selected !== index ? index : null;
    this.render();
  };
  private readonly handleBackgroundClick = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof Element) || target.closest('button')) return;
    if (this.selected !== null) { this.selected = null; this.render(); }
  };
  private readonly handleDragStart = (event: DragEvent): void => {
    const button = this.slotButton(event);
    const index = button ? Number(button.dataset.slot) : -1;
    if (!this.isOpen || !button || !this.inventory.snapshot()[index]) {
      event.preventDefault();
      return;
    }
    this.dragSource = { slot: index, revision: this.inventory.revision };
    button.classList.add('is-dragging');
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      // Some browsers require drag data for a drag to begin; the source is still
      // validated against our own state, not this externally supplied value.
      event.dataTransfer.setData('text/plain', 'inventory-slot');
    }
  };
  private readonly handleDragOver = (event: DragEvent): void => {
    if (!this.isOpen || !this.dragSource || !this.slotButton(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  };
  private readonly handleDrop = (event: DragEvent): void => {
    const button = this.slotButton(event);
    const source = this.dragSource;
    this.dragSource = null;
    if (!this.isOpen || !button || !source || source.revision !== this.inventory.revision) return;
    event.preventDefault();
    const destination = Number(button.dataset.slot);
    const slots = this.inventory.snapshot();
    const from = slots[source.slot], to = slots[destination];
    if (!from || source.slot === destination) { this.render(); return; }
    if (to && to.itemId !== from.itemId) this.inventory.swapSlots(source.slot, destination);
    else this.inventory.moveStack(source.slot, destination);
    this.selected = destination;
    this.render();
  };
  private readonly handleDragEnd = (): void => {
    this.dragSource = null;
    this.grid.querySelectorAll('.is-dragging').forEach((element) => element.classList.remove('is-dragging'));
  };
  private readonly handleSplit = (): void => {
    if (this.selected === null) return;
    const slot = this.inventory.snapshot()[this.selected];
    if (slot && slot.quantity > 1) this.inventory.splitStack(this.selected, Math.floor(slot.quantity / 2));
    this.render();
  };
  private render(): void {
    const slots = this.inventory.snapshot();
    this.grid.replaceChildren();
    slots.forEach((slot, index) => {
      const button = this.root.ownerDocument.createElement('button');
      button.type = 'button'; button.className = 'inventory__slot'; button.dataset.slot = String(index);
      button.classList.toggle('is-selected', index === this.selected);
      button.draggable = slot !== null;
      if (slot) {
        const item = this.inventory.registry.get(slot.itemId);
        button.textContent = `${item.icon} · ${item.name} ×${slot.quantity}`;
        button.setAttribute('aria-label', `${item.name}, ${slot.quantity} of ${item.maxStackSize}`);
      } else { button.textContent = 'Empty'; button.setAttribute('aria-label', `Empty slot ${index + 1}`); }
      this.grid.append(button);
    });
    const selected = this.selected === null ? null : slots[this.selected];
    if (selected) {
      const item = this.inventory.registry.get(selected.itemId);
      this.detail.textContent = `${item.name} — ${item.description} Stack: ${selected.quantity} / ${item.maxStackSize}. Drag to move, merge or swap.`;
    } else this.detail.textContent = 'Select a slot to inspect. Drag to move, merge or swap. Split divides the selected stack.';
    this.split.disabled = !selected || selected.quantity < 2 || this.inventory.usedSlots === this.inventory.capacity;
    this.capacity.textContent = `Capacity: ${this.inventory.usedSlots} / ${this.inventory.capacity} slots`;
    this.shownRevision = this.inventory.revision;
  }
}
