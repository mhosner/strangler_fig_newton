import type { MonolithProfile, SliceCandidate, FeatureParityReport } from '../core/types.js';

/**
 * The Feature Parity Trap guard. This is a critical checkpoint that prevents
 * teams from blindly rebuilding 100% of legacy functionality. Many legacy features
 * are dead code, obsolete workarounds, or rarely-used capabilities that should
 * be pruned rather than migrated.
 */
export class FeatureParityChecker {
  generateCheckPrompt(profile: MonolithProfile, targetSlice: SliceCandidate): string {
    const sliceChunks = profile.chunks.filter((c) => targetSlice.chunkIds.includes(c.id));
    const chunkPaths = sliceChunks.map((c) => `- ${c.name} (${c.path})`).join('\n');
    const sliceEntities = profile.entities.filter((e) => targetSlice.entityIds.includes(e.id));
    const entityList = sliceEntities.map((e) => `- ${e.entityName} (${e.entityType})`).join('\n');

    return [
      '## FEATURE PARITY TRAP CHECK',
      '',
      `Analyzing slice: "${targetSlice.name}"`,
      '',
      'Modules in this slice:',
      chunkPaths,
      '',
      'Entities in this slice:',
      entityList,
      '',
      '### CRITICAL: Do NOT assume all features need to be migrated!',
      '',
      'For each feature/endpoint/capability found in these modules, determine:',
      '',
      '1. **Is it actively used?** Look for:',
      '   - Dead code (unreachable branches, commented-out blocks, TODO/FIXME markers)',
      '   - Endpoints with no callers or routes',
      '   - Database tables with no recent migration or write paths',
      '   - Configuration flags that are always off',
      '',
      '2. **Is it a legacy workaround?** Look for:',
      '   - Comments mentioning "workaround", "hack", "temporary", "legacy"',
      '   - Code that transforms data between incompatible formats',
      '   - Retry/fallback logic for systems that may no longer exist',
      '',
      '3. **Is it needed in the new world?** Ask the user:',
      '   - "Feature X processes Y — is this still required?"',
      '   - "This endpoint serves Z — does anyone still call it?"',
      '   - "This scheduled job runs every N hours — is the output still consumed?"',
      '',
      'Output as JSON:',
      '```json',
      '{',
      '  "totalFeatures": number,',
      '  "confirmedNeeded": ["feature descriptions that are definitely needed"],',
      '  "confirmedUnneeded": ["feature descriptions that can be dropped"],',
      '  "uncertain": ["feature descriptions that need user validation"],',
      '  "deadCodePaths": ["file:line descriptions of dead code"],',
      '  "legacyWorkarounds": ["descriptions of workarounds that can be eliminated"]',
      '}',
      '```',
    ].join('\n');
  }

  calculateReduction(report: Omit<FeatureParityReport, 'sliceId' | 'reductionPercentage'>): number {
    if (report.totalFeatures === 0) return 0;
    const removable = report.confirmedUnneeded.length + report.deadCodePaths.length + report.legacyWorkarounds.length;
    return Math.round((removable / report.totalFeatures) * 100);
  }

  structureReport(sliceId: string, raw: Omit<FeatureParityReport, 'sliceId' | 'reductionPercentage'>): FeatureParityReport {
    return {
      sliceId,
      ...raw,
      reductionPercentage: this.calculateReduction(raw),
    };
  }

  generateUserValidationQuestions(report: FeatureParityReport): string[] {
    return report.uncertain.map(
      (feature, i) => `${i + 1}. Is this feature still needed? → ${feature}`,
    );
  }
}
