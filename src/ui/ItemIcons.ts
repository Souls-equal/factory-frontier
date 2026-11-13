import coal from '../assets/items/coal.svg';
import copperOre from '../assets/items/copper-ore.svg';
import ironIngot from '../assets/items/iron-ingot.svg';
import ironOre from '../assets/items/iron-ore.svg';
import limestone from '../assets/items/limestone.svg';
import stone from '../assets/items/stone.svg';
import wood from '../assets/items/wood.svg';

/** Artwork is presentation-only; unknown/custom items can use their registry fallback. */
const icons = new Map<string, string>([
  ['iron-ingot', ironIngot], ['iron-ore', ironOre], ['copper-ore', copperOre], ['limestone', limestone],
  ['coal', coal], ['stone', stone], ['wood', wood],
]);
export function itemIcon(id: string): string | undefined { return icons.get(id); }
