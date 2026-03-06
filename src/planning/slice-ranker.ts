import type { SliceCandidate } from '../core/types.js';

/**
 * Implements the "Second Riskiest" heuristic for selecting which slice
 * to extract first. The goal: pick something meaty enough to prove value
 * but not so critical that failure endangers the business.
 *
 * The riskiest slice teaches lessons but could be catastrophic.
 * The easiest slice proves nothing.
 * The "second riskiest" is the sweet spot.
 */
export class SliceRanker {
  rank(candidates: SliceCandidate[]): SliceCandidate[] {
    if (candidates.length === 0) return [];

    const scored = candidates.map((candidate) => ({
      candidate,
      compositeScore: this.computeCompositeScore(candidate),
    }));

    // Sort by composite score descending (higher = better candidate for first extraction)
    scored.sort((a, b) => b.compositeScore - a.compositeScore);

    // Apply the "second riskiest" heuristic:
    // Skip the highest-risk candidate, skip the lowest-value candidates
    return scored.map((s, index) => ({
      ...s.candidate,
      recommendedOrder: index + 1,
      rationale: this.generateRationale(s.candidate, index, scored.length),
    }));
  }

  private computeCompositeScore(candidate: SliceCandidate): number {
    // Balance between business value and manageable risk
    // High value + moderate risk = best candidate
    // High value + extreme risk = too dangerous for first extraction
    // Low value + low risk = doesn't prove enough

    const valueWeight = 0.6;
    const riskPenalty = 0.4;

    const normalizedValue = candidate.businessValueScore / 10;
    const normalizedRisk = candidate.riskScore / 10;

    // Penalize both extremes of risk — we want moderate risk
    const riskFactor = 1 - Math.abs(normalizedRisk - 0.5) * 2;

    return normalizedValue * valueWeight + riskFactor * riskPenalty;
  }

  private generateRationale(candidate: SliceCandidate, rank: number, total: number): string {
    if (rank === 0 && total > 1) {
      return this.describeTopCandidate(candidate);
    }

    if (candidate.riskScore >= 8) {
      return `High risk (${candidate.riskScore}/10) — consider extracting this later after the team gains experience with the migration process.`;
    }

    if (candidate.businessValueScore <= 2) {
      return `Low business value (${candidate.businessValueScore}/10) — extracting this won't demonstrate meaningful progress to stakeholders.`;
    }

    return `Balanced candidate: business value ${candidate.businessValueScore}/10, risk ${candidate.riskScore}/10. ${candidate.description}`;
  }

  private describeTopCandidate(candidate: SliceCandidate): string {
    const parts: string[] = [
      `RECOMMENDED FIRST EXTRACTION.`,
      `Business value: ${candidate.businessValueScore}/10.`,
      `Risk: ${candidate.riskScore}/10.`,
    ];

    if (candidate.riskScore >= 4 && candidate.riskScore <= 7) {
      parts.push('Risk level is in the "second riskiest" sweet spot — meaty enough to prove the approach works.');
    }

    if (candidate.entityIds.length <= 3) {
      parts.push('Limited data dependencies make this a clean extraction target.');
    }

    return parts.join(' ');
  }

  generateRankingSummary(ranked: SliceCandidate[]): string {
    if (ranked.length === 0) return 'No slice candidates identified.';

    const lines = ['## Slice Extraction Order (Recommended)', ''];
    for (const candidate of ranked) {
      const marker = candidate.recommendedOrder === 1 ? '>>> ' : '    ';
      lines.push(
        `${marker}${candidate.recommendedOrder}. ${candidate.name} ` +
        `[value: ${candidate.businessValueScore}/10, risk: ${candidate.riskScore}/10]`,
      );
      lines.push(`       ${candidate.rationale}`);
      lines.push('');
    }

    return lines.join('\n');
  }
}
