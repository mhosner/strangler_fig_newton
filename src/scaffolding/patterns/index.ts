import type { TransitionalPattern } from './pattern.interface.js';
import { eventInterceptionPattern } from './event-interception.js';
import { legacyMimicPattern } from './legacy-mimic.js';
import { revertToSourcePattern } from './revert-to-source.js';

export type { TransitionalPattern, ApplicabilityResult } from './pattern.interface.js';

export class PatternRegistry {
  private patterns = new Map<string, TransitionalPattern>();

  register(pattern: TransitionalPattern): void {
    this.patterns.set(pattern.name, pattern);
  }

  unregister(name: string): void {
    this.patterns.delete(name);
  }

  get(name: string): TransitionalPattern | undefined {
    return this.patterns.get(name);
  }

  getAll(): TransitionalPattern[] {
    return Array.from(this.patterns.values());
  }
}

export function registerBuiltinPatterns(registry: PatternRegistry): void {
  registry.register(eventInterceptionPattern);
  registry.register(legacyMimicPattern);
  registry.register(revertToSourcePattern);
}

export { eventInterceptionPattern } from './event-interception.js';
export { legacyMimicPattern } from './legacy-mimic.js';
export { revertToSourcePattern } from './revert-to-source.js';
