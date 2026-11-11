import { DEFAULT_MINER_CONFIG, type MinerConfig } from '../core/Configuration';
export { DEFAULT_MINER_CONFIG, type MinerConfig } from '../core/Configuration';
import { Inventory, type QuantityResult } from '../items/Inventory';
import type { ItemRegistry } from '../items/ItemRegistry';
import type { ResourceDeposit } from '../resources/ResourceDeposit';

export type MachineState = 'IDLE' | 'RUNNING' | 'NO_POWER' | 'MISSING_INPUT' | 'OUTPUT_FULL' | 'DISABLED' | 'ERROR';
export interface Machine {
  readonly id: string;
  readonly state: MachineState;
  readonly output: Inventory;
  readonly enabled: boolean;
  fixedUpdate(deltaMs: number): void;
  setEnabled(enabled: boolean): void;
}

/** Deterministic extraction; the deposit lookup is re-evaluated on every tick. */
export class Miner implements Machine {
  readonly output: Inventory;
  private work = 0; // item-milliseconds/minute, 60,000 = one whole item
  private enabledValue = true;
  private started = false;
  private failed = false;
  constructor(readonly id: string, readonly depositId: string, readonly itemId: string,
    private readonly findDeposit: (id: string) => ResourceDeposit | undefined,
    items: ItemRegistry, readonly config: MinerConfig = DEFAULT_MINER_CONFIG) {
    if (!id.trim() || !depositId.trim() || !Number.isFinite(config.baseRatePerMinute) || config.baseRatePerMinute <= 0 ||
        !Number.isSafeInteger(config.outputSlots) || config.outputSlots < 1) throw new RangeError('Invalid miner configuration.');
    items.get(itemId);
    this.output = new Inventory(items, config.outputSlots);
  }
  get enabled(): boolean { return this.enabledValue; }
  setEnabled(enabled: boolean): void { this.enabledValue = enabled; }
  get deposit(): ResourceDeposit | undefined {
    const deposit = this.findDeposit(this.depositId);
    if (!deposit || deposit.id !== this.depositId || !deposit.extractionCompatible || deposit.itemId !== this.itemId ||
        !Number.isFinite(deposit.productionMultiplier) || deposit.productionMultiplier <= 0) return undefined;
    return deposit;
  }
  get effectiveRate(): number { return this.config.baseRatePerMinute * (this.deposit?.productionMultiplier ?? 0); }
  get progress(): number { return this.work / 60000; }
  get state(): MachineState {
    if (this.failed) return 'ERROR';
    if (!this.enabledValue) return 'DISABLED';
    if (!this.deposit) return 'MISSING_INPUT';
    if (this.output.getAvailableSpace(this.itemId) === 0) return 'OUTPUT_FULL';
    return this.started ? 'RUNNING' : 'IDLE';
  }
  fixedUpdate(deltaMs: number): void {
    if (!Number.isFinite(deltaMs) || deltaMs < 0) throw new RangeError('Invalid simulation duration.');
    if (deltaMs === 0) return;
    this.started = true;
    if (this.state !== 'RUNNING') return;
    const available = this.output.getAvailableSpace(this.itemId);
    // Stop work at the exact moment the last output slot fills; no extra work
    // accumulates while blocked and any existing fractional work is preserved.
    const workNeeded = Math.max(0, available * 60000 - this.work);
    this.work += Math.min(workNeeded, this.effectiveRate * deltaMs);
    const whole = Math.min(available, Math.floor((this.work + 1e-7) / 60000));
    if (whole > 0) {
      const result = this.output.addItem(this.itemId, whole);
      if (result.moved !== whole) { this.failed = true; return; }
      this.work = Math.max(0, this.work - whole * 60000);
    }
  }
  retrieve(destination: Inventory): QuantityResult {
    const count = this.output.getItemCount(this.itemId);
    return count ? this.output.transferItem(destination, this.itemId, count) : { requested: 0, moved: 0, remainder: 0 };
  }
}
