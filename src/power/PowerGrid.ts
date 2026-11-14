/** Renderer-independent electrical topology. Power values are integer watts. */
export interface PowerPosition { readonly x: number; readonly y: number; readonly z: number }
export type PowerNode =
  | { readonly id: string; readonly kind: 'pole'; readonly position: PowerPosition }
  | { readonly id: string; readonly kind: 'generator'; readonly position: PowerPosition; readonly capacityWatts: number; readonly enabled: boolean }
  | { readonly id: string; readonly kind: 'consumer'; readonly position: PowerPosition; readonly demandWatts: number; readonly enabled: boolean };
export type PowerStatus = 'isolated' | 'offline' | 'overloaded' | 'online';
export interface PowerNetwork {
  /** Deterministic for current membership, but can change on merge or split. */
  readonly id: string;
  readonly poles: readonly string[];
  readonly generators: readonly string[];
  readonly consumers: readonly string[];
  readonly capacityWatts: number;
  readonly availableWatts: number;
  readonly demandWatts: number;
  readonly suppliedWatts: number;
  readonly shortfallWatts: number;
  readonly status: PowerStatus;
}

function watts(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError('Power must be a non-negative safe integer number of watts.');
}
function validNode(node: PowerNode): void {
  if (typeof node.id !== 'string' || !node.id.trim() || node.id !== node.id.trim() ||
      !node.position || ![node.position.x, node.position.y, node.position.z].every(Number.isFinite)) throw new RangeError('Invalid power node.');
  if (node.kind === 'generator') { watts(node.capacityWatts); if (typeof node.enabled !== 'boolean') throw new RangeError('Invalid generator state.'); }
  else if (node.kind === 'consumer') { watts(node.demandWatts); if (typeof node.enabled !== 'boolean') throw new RangeError('Invalid consumer state.'); }
  else if (node.kind !== 'pole') throw new RangeError('Invalid power node kind.');
}

/**
 * Explicit undirected wires connect poles to other poles or to one endpoint.
 * A generator/consumer has at most one wire and cannot bridge pole networks.
 * An underpowered connected network sheds all demand; no fractional power or
 * fuel simulation is implied. Disconnected endpoints are never powered.
 */
export class PowerGrid {
  private readonly nodes = new Map<string, PowerNode>();
  private readonly neighbours = new Map<string, Set<string>>();
  private revisionValue = 0;
  constructor(readonly wireRange: number) {
    if (!Number.isFinite(wireRange) || wireRange <= 0) throw new RangeError('Wire range must be positive and finite.');
  }
  get revision(): number { return this.revisionValue; }
  private require(id: string): PowerNode {
    const node = this.nodes.get(id); if (!node) throw new RangeError(`Unknown power node: ${id}`); return node;
  }
  /** Bound total sums so all network statistics are exact safe integers. */
  private checkTotals(replacement: PowerNode, replacingId?: string): void {
    let capacity = 0, demand = 0;
    const all = [...this.nodes.values()].filter(node => node.id !== replacingId); all.push(replacement);
    for (const node of all) {
      if (node.kind === 'generator') {
        if (node.capacityWatts > Number.MAX_SAFE_INTEGER - capacity) throw new RangeError('Total generator capacity exceeds safe integer range.');
        capacity += node.capacityWatts;
      } else if (node.kind === 'consumer') {
        if (node.demandWatts > Number.MAX_SAFE_INTEGER - demand) throw new RangeError('Total consumer demand exceeds safe integer range.');
        demand += node.demandWatts;
      }
    }
  }
  add(node: PowerNode): void {
    validNode(node);
    if (this.nodes.has(node.id)) throw new RangeError(`Duplicate power node: ${node.id}`);
    this.checkTotals(node);
    this.nodes.set(node.id, { ...node, position: { ...node.position } });
    this.neighbours.set(node.id, new Set()); this.revisionValue++;
  }
  remove(id: string): boolean {
    if (!this.nodes.has(id)) return false;
    for (const other of this.neighbours.get(id)!) this.neighbours.get(other)!.delete(id);
    this.neighbours.delete(id); this.nodes.delete(id); this.revisionValue++; return true;
  }
  /** Return false for an existing wire; invalid operations throw without mutation. */
  connect(a: string, b: string): boolean {
    const left = this.require(a), right = this.require(b);
    if (a === b || (left.kind !== 'pole' && right.kind !== 'pole')) throw new RangeError('A wire must connect distinct nodes including a pole.');
    if (this.neighbours.get(a)!.has(b)) return false;
    if ((left.kind !== 'pole' && this.neighbours.get(a)!.size) || (right.kind !== 'pole' && this.neighbours.get(b)!.size)) throw new RangeError('A generator or consumer can connect to only one pole.');
    const distance = Math.hypot(left.position.x - right.position.x, left.position.y - right.position.y, left.position.z - right.position.z);
    if (distance > this.wireRange) throw new RangeError('Nodes are outside wire range.');
    this.neighbours.get(a)!.add(b); this.neighbours.get(b)!.add(a); this.revisionValue++; return true;
  }
  disconnect(a: string, b: string): boolean {
    this.require(a); this.require(b);
    if (!this.neighbours.get(a)!.delete(b)) return false;
    this.neighbours.get(b)!.delete(a); this.revisionValue++; return true;
  }
  setEnabled(id: string, enabled: boolean): void {
    const node = this.require(id);
    if (node.kind === 'pole' || typeof enabled !== 'boolean') throw new RangeError('Only generators and consumers have an enabled state.');
    if (node.enabled === enabled) return;
    this.nodes.set(id, { ...node, enabled }); this.revisionValue++;
  }
  setWatts(id: string, value: number): void {
    const node = this.require(id); watts(value);
    if (node.kind === 'pole') throw new RangeError('Poles do not produce or consume power.');
    if ((node.kind === 'generator' ? node.capacityWatts : node.demandWatts) === value) return;
    const changed = node.kind === 'generator' ? { ...node, capacityWatts: value } : { ...node, demandWatts: value };
    this.checkTotals(changed, id); this.nodes.set(id, changed); this.revisionValue++;
  }
  /** Independent snapshots; mutating returned arrays cannot affect the grid. */
  networks(): readonly PowerNetwork[] {
    const remaining = new Set([...this.nodes.keys()].sort()), networks: PowerNetwork[] = [];
    while (remaining.size) {
      const first = remaining.values().next().value!; remaining.delete(first);
      const pending = [first], members: string[] = [];
      while (pending.length) {
        const id = pending.pop()!; members.push(id);
        for (const other of this.neighbours.get(id)!) if (remaining.delete(other)) pending.push(other);
      }
      members.sort();
      const poles: string[] = [], generators: string[] = [], consumers: string[] = [];
      let capacityWatts = 0, availableWatts = 0, demandWatts = 0;
      for (const id of members) {
        const node = this.require(id);
        if (node.kind === 'pole') poles.push(id);
        else if (node.kind === 'generator') { generators.push(id); capacityWatts += node.capacityWatts; if (node.enabled) availableWatts += node.capacityWatts; }
        else { consumers.push(id); if (node.enabled) demandWatts += node.demandWatts; }
      }
      // A standalone generator has installed capacity but no energized network.
      if (!poles.length) availableWatts = 0;
      const status: PowerStatus = !poles.length ? 'isolated' : availableWatts === 0 ? 'offline' : demandWatts > availableWatts ? 'overloaded' : 'online';
      networks.push({ id: members[0]!, poles, generators, consumers, capacityWatts, availableWatts, demandWatts,
        suppliedWatts: status === 'online' ? demandWatts : 0, shortfallWatts: Math.max(0, demandWatts - availableWatts), status });
    }
    return networks;
  }
  networkFor(id: string): PowerNetwork {
    this.require(id);
    return this.networks().find(network => network.poles.includes(id) || network.generators.includes(id) || network.consumers.includes(id))!;
  }
  isPowered(id: string): boolean {
    const node = this.require(id);
    if (node.kind !== 'consumer') throw new RangeError('Only consumers receive power.');
    return node.enabled && this.networkFor(id).status === 'online';
  }
}
