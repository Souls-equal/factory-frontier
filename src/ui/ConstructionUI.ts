import type { BuildingRegistry } from '../buildings/BuildingRegistry';
import type { Inventory } from '../items/Inventory';
import { createConstructionThumbnail } from '../engine/ConstructionThumbnail';

/** Accessible modal presentation; selection does not change inventory. */
export class ConstructionUI {
  private readonly list: HTMLElement;
  private readonly close: HTMLButtonElement;
  private shownRevision = -1;
  private readonly thumbnails = new Map<string, SVGElement>();
  constructor(private readonly root: HTMLElement, private readonly registry: BuildingRegistry,
    private readonly inventory: Inventory, private readonly onSelect: (id: string) => void, private readonly onClose: () => void, private readonly cellSize = 1) {
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
  dispose(): void { this.close.removeEventListener('click', this.onClose); this.list.removeEventListener('click', this.handleSelect); this.thumbnails.clear(); }
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
      if (['conveyor-auto', 'conveyor-straight', 'conveyor-curve', 'conveyor-incline'].includes(definition.id)) continue;
      const button = this.root.ownerDocument.createElement('button');
      button.type = 'button'; button.dataset.building = definition.id; button.className = 'construction__entry';
      const affordable = definition.cost.every((cost) => this.inventory.hasItem(cost.itemId, cost.quantity));
      button.disabled = !affordable;
      let thumbnail = this.thumbnails.get(definition.id);
      if (!thumbnail) { thumbnail = createConstructionThumbnail(this.registry, this.cellSize, definition.id); this.thumbnails.set(definition.id, thumbnail); }
      const visual = this.root.ownerDocument.createElement('span'); visual.className = 'construction__visual';
      visual.append(thumbnail.cloneNode(true));
      const details = this.root.ownerDocument.createElement('span'); details.className = 'construction__details';
      const title = this.root.ownerDocument.createElement('strong'); title.textContent = definition.category ? `${definition.category} · ${definition.name}` : definition.name;
      const description = this.root.ownerDocument.createElement('span'); description.textContent = definition.description;
      const cost = this.root.ownerDocument.createElement('span');
      cost.textContent = definition.cost.map((entry) => `${this.inventory.registry.get(entry.itemId).name}: ${this.inventory.getItemCount(entry.itemId)} / ${entry.quantity}`).join(' · ') + (affordable ? '' : ' — insufficient materials');
      description.className = 'construction__description'; cost.className = 'construction__cost';
      details.append(title, description, cost); button.append(visual, details); this.list.append(button);
    }
    this.shownRevision = this.inventory.revision;
  }
}
