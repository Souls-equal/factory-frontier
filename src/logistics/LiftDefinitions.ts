/** Supported vertical change in grid cells. Height is fixed for each placed lift. */
export const MAX_LIFT_HEIGHT = 8;
export function liftRise(typeId: string): number | null {
  const match = /^lift-(up|down)-([1-9]\d*)$/.exec(typeId);
  if (!match) return null;
  const height = Number(match[2]);
  if (!Number.isSafeInteger(height) || height > MAX_LIFT_HEIGHT || String(height) !== match[2]) return null;
  return match[1] === 'up' ? height : -height;
}
export const isLiftBuilding = (typeId: string): boolean => liftRise(typeId) !== null;
