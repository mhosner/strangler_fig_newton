import type { SliceCandidate, MonolithProfile, MigrationStep, Precondition } from '../core/types.js';

export interface MigrationStrategy {
  readonly name: string;
  readonly displayName: string;
  readonly description: string;

  /** Check if this strategy is applicable for the given candidate */
  isApplicable(candidate: SliceCandidate, profile: MonolithProfile): boolean;

  /** Generate the ordered migration steps for this strategy */
  generateSteps(candidate: SliceCandidate, profile: MonolithProfile): MigrationStep[];

  /** Strategy-level preconditions (beyond per-step preconditions) */
  getGlobalPreconditions(): Precondition[];
}
