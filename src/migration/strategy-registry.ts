import type { SliceCandidate, MonolithProfile } from '../core/types.js';
import type { MigrationStrategy } from './strategy.interface.js';
import { StrategyNotFoundError } from '../core/errors.js';

export class StrategyRegistry {
  private strategies = new Map<string, MigrationStrategy>();

  register(strategy: MigrationStrategy): void {
    this.strategies.set(strategy.name, strategy);
  }

  unregister(name: string): void {
    this.strategies.delete(name);
  }

  get(name: string): MigrationStrategy {
    const strategy = this.strategies.get(name);
    if (!strategy) throw new StrategyNotFoundError(name);
    return strategy;
  }

  getAll(): MigrationStrategy[] {
    return Array.from(this.strategies.values());
  }

  findApplicable(candidate: SliceCandidate, profile: MonolithProfile): MigrationStrategy[] {
    return this.getAll().filter((s) => s.isApplicable(candidate, profile));
  }
}
