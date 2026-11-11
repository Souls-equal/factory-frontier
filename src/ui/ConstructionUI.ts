import type { BuildingRegistry } from '../buildings/BuildingRegistry';
import type { Inventory } from '../items/Inventory';

/** Accessible modal presentation; selection does not change inventory. */
export class ConstructionUI {
  private readonly list: HTMLElement;
  private readonly close: HTMLButtonElement;
  private shownRevision = -1;
  constructor(private readonly root: HTMLElement, private readonly registry: BuildingRegistry,
    private readonly inventory: Inventory, private readonly onSelect: (id: string) => void, private readonly onClose: () => void) {
    const list = root.querySelector<HTMLElement>('[data-construction-list]');
    const close = root.querySelector<HTMLButtonElement>('[data-construction-close]');
    if (!list || !close) throw new Error('Missing construction menu elements.');
    this.list = list; this.close = close;
    this.close.addEventListener('click', this.onClose);
    this.list.addEventListener('click', this.handleSelect);
  }
  get isOpen(): boolean { return !this.root.hidden; }
  open(): void { this.root.hidden = false; this.render(); this.close.focus(); }
  closePanel(): void { this.root.hidden = true; }
  update(): void { if (this.isOpen && this.shownRevision !== this.inventory.revision) this.render(); }
  dispose(): void { this.close.removeEventListener('click', this.onClose); this.list.removeEventListener('click', this.handleSelect); }
  private readonly handleSelect = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest<HTMLButtonElement>('button[data-building]');
    if (!button || button.disabled || !this.list.contains(button)) return;
    const id = button.dataset.building!;
    const definition = this.registry.get(id);
    if (definition.cost.every((cost) => this.inventory.hasItem(cost.itemId, cost.quantity))) this.onSelect(id);
    else this.render();
  };
  private render(): void {
    this.list.replaceChildren();
    for (const definition of this.registry.all()) {
      const button = this.root.ownerDocument.createElement('button');
      button.type = 'button'; button.dataset.building = definition.id; button.className = 'construction__entry';
      const affordable = definition.cost.every((cost) => this.inventory.hasItem(cost.itemId, cost.quantity));
      button.disabled = !affordable;
      const title = this.root.ownerDocument.createElement('strong'); title.textContent = definition.name;
      const description = this.root.ownerDocument.createElement('span'); description.textContent = definition.description;
      const cost = this.root.ownerDocument.createElement('span');
      cost.textContent = definition.cost.map((entry) => `${this.inventory.registry.get(entry.itemId).name}: ${this.inventory.getItemCount(entry.itemId)} / ${entry.quantity}`).join(' · ') + (affordable ? '' : ' — insufficient materials');
      button.append(title, description, cost); this.list.append(button);
    }
    this.shownRevision = this.inventory.revision;
  }
}
