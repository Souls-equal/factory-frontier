import type { Inventory } from '../items/Inventory';

/** DOM-only presentation. Inventory remains authoritative and Three-free. */
export class InventoryUI {
  private selected: number | null = null;
  private shownRevision = -1;
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
    this.split.addEventListener('click', this.handleSplit);
    this.close.addEventListener('click', this.onClose);
  }
  get isOpen(): boolean { return !this.root.hidden; }
  open(): void { this.root.hidden = false; this.selected = null; this.render(); this.close.focus(); }
  closePanel(): void { this.root.hidden = true; this.selected = null; }
  update(): void { if (this.isOpen && this.shownRevision !== this.inventory.revision) this.render(); }
  dispose(): void {
    this.grid.removeEventListener('click', this.handleGrid);
    this.split.removeEventListener('click', this.handleSplit);
    this.close.removeEventListener('click', this.onClose);
  }
  private readonly handleGrid = (event: Event): void => {
    const target = event.target as HTMLElement;
    const button = target.closest<HTMLButtonElement>('[data-slot]');
    if (!button || !this.grid.contains(button)) return;
    const index = Number(button.dataset.slot);
    const slots = this.inventory.snapshot();
    if (this.selected !== null && this.selected !== index && slots[this.selected]) {
      const moved = this.inventory.moveStack(this.selected, index);
      if (moved > 0) { this.selected = index; this.render(); return; }
    }
    this.selected = index;
    this.render();
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
      this.detail.textContent = `${item.name} — ${item.description} Stack: ${selected.quantity} / ${item.maxStackSize}. Select another slot to move or merge.`;
    } else this.detail.textContent = 'Select a slot to inspect, move, or merge. Split divides the selected stack.';
    this.split.disabled = !selected || selected.quantity < 2 || this.inventory.usedSlots === this.inventory.capacity;
    this.capacity.textContent = `Capacity: ${this.inventory.usedSlots} / ${this.inventory.capacity} slots`;
    this.shownRevision = this.inventory.revision;
  }
}
