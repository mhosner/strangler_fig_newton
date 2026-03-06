import type { ParallelRunConfig, DivergenceReport } from '../core/types.js';
import type { EventBus } from '../core/events.js';
import { isoNow } from '../core/utils.js';

/**
 * Configures and manages parallel running of old (monolith) and new (microservice)
 * systems. Generates instructions for Claude to set up traffic mirroring and
 * output comparison.
 */
export class ParallelRunner {
  constructor(private readonly eventBus: EventBus) {}

  configure(
    oldEndpoint: string,
    newEndpoint: string,
    options: Partial<Pick<ParallelRunConfig, 'duration' | 'sampleRate' | 'comparisonMode'>> = {},
  ): ParallelRunConfig {
    return {
      oldEndpoint,
      newEndpoint,
      duration: options.duration ?? '24h',
      sampleRate: options.sampleRate ?? 1.0,
      comparisonMode: options.comparisonMode ?? 'semantic',
    };
  }

  generateSetupPrompt(config: ParallelRunConfig): string {
    return [
      '## Parallel Run Setup',
      '',
      'Configure traffic mirroring to run both systems simultaneously.',
      '',
      `**Old endpoint:** ${config.oldEndpoint}`,
      `**New endpoint:** ${config.newEndpoint}`,
      `**Duration:** ${config.duration}`,
      `**Sample rate:** ${(config.sampleRate * 100).toFixed(0)}%`,
      `**Comparison mode:** ${config.comparisonMode}`,
      '',
      '### Steps:',
      '1. Configure load balancer/proxy to mirror traffic to the new endpoint',
      '2. New service processes requests in shadow mode (results NOT served to users)',
      '3. Log all response pairs (old response + new response) for comparison',
      '4. Set up a comparison pipeline that matches request IDs and diffs responses',
      '',
      '### Comparison Rules:',
      config.comparisonMode === 'exact'
        ? '- Compare response bodies byte-for-byte'
        : config.comparisonMode === 'semantic'
          ? '- Compare response bodies semantically (ignore field ordering, whitespace, generated IDs, timestamps)'
          : '- Compare only HTTP status codes (fastest, least precise)',
      '',
      '### Safety:',
      '- New service MUST NOT write to shared data stores during parallel run',
      '- New service MUST NOT send external notifications (emails, webhooks)',
      '- All new service side-effects should be logged but not executed',
    ].join('\n');
  }

  startParallelRun(config: ParallelRunConfig, planId: string): void {
    this.eventBus.emit({
      type: 'ParallelRunStarted',
      timestamp: isoNow(),
      planId,
      oldEndpoint: config.oldEndpoint,
      newEndpoint: config.newEndpoint,
    });
  }

  generateComparisonPrompt(config: ParallelRunConfig): string {
    return [
      '## Divergence Analysis',
      '',
      'Analyze the parallel run results:',
      '',
      '1. Collect all logged response pairs',
      '2. For each pair, categorize as:',
      '   - **Match** — responses are equivalent',
      '   - **Data mismatch** — different response bodies with same status',
      '   - **Error** — new service returned an error, old did not (or vice versa)',
      '   - **Timing** — same response but significantly different latency',
      '   - **Missing field** — new response missing fields present in old',
      '',
      '3. Calculate divergence rate: divergent / total',
      '4. For each divergence category, provide examples',
      '',
      'Output as JSON matching DivergenceReport structure.',
    ].join('\n');
  }

  evaluateDivergence(report: DivergenceReport, planId: string): { acceptable: boolean; message: string } {
    if (report.divergenceRate === 0) {
      return { acceptable: true, message: 'Perfect match — zero divergences detected.' };
    }

    if (report.divergenceRate < 0.001) {
      return {
        acceptable: true,
        message: `Divergence rate ${(report.divergenceRate * 100).toFixed(3)}% is within acceptable threshold (<0.1%).`,
      };
    }

    this.eventBus.emit({
      type: 'DivergenceDetected',
      timestamp: isoNow(),
      planId,
      divergenceRate: report.divergenceRate,
    });

    return {
      acceptable: false,
      message:
        `Divergence rate ${(report.divergenceRate * 100).toFixed(2)}% exceeds acceptable threshold. ` +
        `${report.divergentResponses} of ${report.totalRequests} requests diverged. ` +
        'Fix divergences before proceeding to cutover.',
    };
  }
}
