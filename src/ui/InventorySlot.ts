import type { Inventory, ItemStack } from '../items/Inventory';
import { itemIcon } from './ItemIcons';

/** Shared slot appearance and accessible item labels; callers own interaction. */
export function createInventorySlot(document: Document, inventory: Inventory, slot: ItemStack | null, index: number): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'inventory__slot'; button.dataset.slot = String(index);
  if (slot) {
    const item = inventory.registry.get(slot.itemId), icon = itemIcon(item.id);
    button.dataset.item = item.id;
    button.title = `${item.name} · ${slot.quantity} / ${item.maxStackSize}`;
    button.setAttribute('aria-label', `${item.name}, ${slot.quantity} of ${item.maxStackSize}`);
    if (icon) {
      const image = document.createElement('img');
      image.className = 'inventory__slot-icon'; image.src = icon; image.alt = ''; image.draggable = false;
      button.append(image);
    } else {
      const fallback = document.createElement('span'); fallback.className = 'inventory__slot-fallback';
      fallback.setAttribute('aria-hidden', 'true'); fallback.textContent = item.icon; button.append(fallback);
    }
    const name = document.createElement('span'); name.className = 'inventory__slot-label';
    name.textContent = `${item.name} ×${slot.quantity}`; button.append(name);
    const count = document.createElement('span'); count.className = 'inventory__slot-count';
    count.setAttribute('aria-hidden', 'true'); count.textContent = String(slot.quantity); button.append(count);
  } else {
    button.setAttribute('aria-label', `Empty slot ${index + 1}`);
  }
  return button;
}
