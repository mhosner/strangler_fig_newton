import type { SliceCandidate, MonolithProfile, SeamDefinition } from '../../core/types.js';

export interface ApplicabilityResult {
  applicable: boolean;
  rationale: string;
}

export interface TransitionalPattern {
  readonly name: string;
  readonly displayName: string;
  readonly description: string;

  /** Determine if this pattern fits the given slice and monolith characteristics */
  isApplicable(slice: SliceCandidate, profile: MonolithProfile): ApplicabilityResult;

  /** Design the seam (temporary integration) for this pattern */
  designSeam(slice: SliceCandidate, profile: MonolithProfile): SeamDefinition;

  /** List temporary artifacts that will be removed after full cutover */
  getTemporaryArtifacts(): string[];
}
