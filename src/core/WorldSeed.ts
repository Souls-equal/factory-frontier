/** Optional reproducible world seed. Invalid or repeated values use the configured default. */
export function worldSeedOverride(query: URLSearchParams): number | undefined {
  const values = query.getAll('seed');
  if (values.length !== 1 || !/^\d+$/.test(values[0]!)) return undefined;
  const seed = Number(values[0]);
  return Number.isSafeInteger(seed) && seed >= 0 && seed <= 2 ** 31 - 1 ? seed : undefined;
}
