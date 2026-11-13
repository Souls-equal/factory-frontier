/** Supported vertical change in grid cells, in tenths. Height is fixed after placement. */
export const MAX_LIFT_HEIGHT = 8;
export function liftRise(typeId: string): number | null {
  const match = /^lift-(up|down)-([1-9]\d*(?:\.[1-9])?)$/.exec(typeId);
  if (!match) return null;
  const height = Number(match[2]);
  if (!Number.isFinite(height) || height < 1 || height > MAX_LIFT_HEIGHT || String(height) !== match[2]) return null;
  return match[1] === 'up' ? height : -height;
}
export const isLiftBuilding = (typeId: string): boolean => liftRise(typeId) !== null;
