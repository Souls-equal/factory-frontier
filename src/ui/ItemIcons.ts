import steelIngot from '../assets/items/steel-ingot.svg';
import steelPlate from '../assets/items/steel-plate.svg';
import coal from '../assets/items/coal.svg';
import copperOre from '../assets/items/copper-ore.svg';
import ironPlate from '../assets/items/iron-plate.svg';
import ironRod from '../assets/items/iron-rod.svg';
import reinforced from '../assets/items/reinforced-component.svg';
import ironIngot from '../assets/items/iron-ingot.svg';
import ironOre from '../assets/items/iron-ore.svg';
import limestone from '../assets/items/limestone.svg';
import stone from '../assets/items/stone.svg';
import wood from '../assets/items/wood.svg';

/** Artwork is presentation-only; unknown/custom items can use their registry fallback. */
const icons = new Map<string, string>([
  ['steel-ingot', steelIngot], ['steel-plate', steelPlate], ['iron-rod', ironRod], ['reinforced-component', reinforced], ['iron-plate', ironPlate], ['iron-ingot', ironIngot], ['iron-ore', ironOre], ['copper-ore', copperOre], ['limestone', limestone],
  ['coal', coal], ['stone', stone], ['wood', wood],
]);
export function itemIcon(id: string): string | undefined { return icons.get(id); }
