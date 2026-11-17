import { DEFAULT_RENDER_CONFIG, type RenderConfig } from './Configuration';

/** Optional URL setting for finite, camera-centred terrain streaming. Invalid values leave the default unchanged. */
export function viewDistanceOverride(query: URLSearchParams): Pick<RenderConfig, 'fogNear' | 'fogFar'> | undefined {
  const values = query.getAll('viewDistance');
  if (values.length !== 1 || !/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(values[0]!)) return undefined;
  const distance = Number(values[0]);
  if (!Number.isFinite(distance) || distance < 16 || distance > 500) return undefined;
  return { fogFar: distance, fogNear: Math.min(DEFAULT_RENDER_CONFIG.fogNear,
    distance * DEFAULT_RENDER_CONFIG.fogNear / DEFAULT_RENDER_CONFIG.fogFar) };
}
