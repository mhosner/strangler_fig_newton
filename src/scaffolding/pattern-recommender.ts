import type { SliceCandidate, MonolithProfile } from '../core/types.js';
import type { TransitionalPattern, ApplicabilityResult } from './patterns/pattern.interface.js';
import { PatternRegistry } from './patterns/index.js';

export interface PatternRecommendation {
  pattern: TransitionalPattern;
  applicability: ApplicabilityResult;
  priority: number;
}

/**
 * Evaluates the codebase characteristics for a given slice and recommends
 * appropriate transitional architecture patterns. The recommendations are
 * ranked by applicability and likelihood of success.
 */
export class PatternRecommender {
  constructor(private readonly registry: PatternRegistry) {}

  recommend(slice: SliceCandidate, profile: MonolithProfile): PatternRecommendation[] {
    const recommendations: PatternRecommendation[] = [];

    for (const pattern of this.registry.getAll()) {
      const applicability = pattern.isApplicable(slice, profile);
      if (applicability.applicable) {
        recommendations.push({
          pattern,
          applicability,
          priority: this.computePriority(pattern, slice),
        });
      }
    }

    recommendations.sort((a, b) => a.priority - b.priority);
    return recommendations;
  }

  private computePriority(pattern: TransitionalPattern, slice: SliceCandidate): number {
    // Revert to Source is simplest — prefer it when applicable
    if (pattern.name === 'revert-to-source') return 1;
    // Event Interception is next — non-invasive
    if (pattern.name === 'event-interception') return 2;
    // Legacy Mimic is most complex but most broadly applicable
    if (pattern.name === 'legacy-mimic') return 3;
    // Custom patterns get lower priority
    return 10;
  }

  renderRecommendations(recommendations: PatternRecommendation[]): string {
    if (recommendations.length === 0) {
      return 'No applicable transitional patterns found for this slice. Consider a direct extraction approach.';
    }

    const lines = [
      '## Recommended Transitional Patterns',
      '',
    ];

    for (const rec of recommendations) {
      lines.push(`### ${rec.priority}. ${rec.pattern.displayName}`);
      lines.push('');
      lines.push(rec.pattern.description);
      lines.push('');
      lines.push(`**Why:** ${rec.applicability.rationale}`);
      lines.push('');
      lines.push('**Temporary artifacts (will be removed post-cutover):**');
      for (const artifact of rec.pattern.getTemporaryArtifacts()) {
        lines.push(`- ${artifact}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }
}
