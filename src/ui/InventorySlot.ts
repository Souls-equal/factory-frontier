import type { Inventory, ItemStack } from '../items/Inventory';

/** Shared slot appearance and accessible item labels; callers own interaction. */
export function createInventorySlot(document: Document, inventory: Inventory, slot: ItemStack | null, index: number): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'inventory__slot'; button.dataset.slot = String(index);
  if (slot) {
    const item = inventory.registry.get(slot.itemId);
    button.textContent = `${item.icon} · ${item.name} ×${slot.quantity}`;
    button.dataset.item = item.id; button.dataset.icon = item.icon; button.dataset.quantity = String(slot.quantity);
    button.title = `${item.name} · ${slot.quantity} / ${item.maxStackSize}`;
    button.setAttribute('aria-label', `${item.name}, ${slot.quantity} of ${item.maxStackSize}`);
  } else {
    button.textContent = 'Empty'; button.setAttribute('aria-label', `Empty slot ${index + 1}`);
  }
  return button;
}
