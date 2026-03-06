import type { StrategyRegistry } from '../strategy-registry.js';
import { stranglerFigStrategy } from './strangler-fig.js';
import { branchByAbstractionStrategy } from './branch-by-abstraction.js';
import { eventInterceptionStrategy } from './event-interception.js';
import { parallelRunStrategy } from './parallel-run.js';

export function registerBuiltinStrategies(registry: StrategyRegistry): void {
  registry.register(stranglerFigStrategy);
  registry.register(branchByAbstractionStrategy);
  registry.register(eventInterceptionStrategy);
  registry.register(parallelRunStrategy);
}

export { stranglerFigStrategy } from './strangler-fig.js';
export { branchByAbstractionStrategy } from './branch-by-abstraction.js';
export { eventInterceptionStrategy } from './event-interception.js';
export { parallelRunStrategy } from './parallel-run.js';
