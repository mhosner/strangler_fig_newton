import type { SliceCandidate, MonolithProfile, MigrationStep, Precondition } from '../../core/types.js';
import type { MigrationStrategy } from '../strategy.interface.js';
import { generateId } from '../../core/utils.js';

function step(
  order: number,
  name: string,
  description: string,
  type: MigrationStep['type'],
  instructions: string[],
): MigrationStep {
  return {
    id: generateId(),
    planId: '',
    order,
    name,
    description,
    type,
    status: 'pending',
    preconditions: [],
    actions: instructions.map((inst) => ({
      description: inst.split(':')[0] ?? inst,
      instruction: inst,
      completed: false,
    })),
    verificationCriteria: [],
    rollbackProcedure: { description: `Rollback ${name}`, steps: [], automated: false },
  };
}

export const parallelRunStrategy: MigrationStrategy = {
  name: 'parallel-run',
  displayName: 'Parallel Run',
  description:
    'Deploy the new service alongside the monolith and mirror production traffic to both. ' +
    'Compare outputs without serving shadow results to users. Ideal for high-risk, ' +
    'business-critical extractions that require production-level verification.',

  isApplicable(candidate: SliceCandidate): boolean {
    // Recommended for high-risk or critical slices
    return candidate.riskScore >= 7 || candidate.businessValueScore >= 8;
  },

  generateSteps(candidate: SliceCandidate): MigrationStep[] {
    return [
      step(1, 'Create Shadow Service',
        'Deploy the new microservice alongside the monolith (no production traffic yet)',
        'prepare',
        [
          'Build the new service with full business logic implementation',
          'Deploy to production environment but without serving real traffic',
          'Ensure the shadow service has read access to necessary data',
          'Set up separate logging and monitoring for the shadow service',
        ]),
      step(2, 'Traffic Mirroring',
        'Copy production traffic to the new service for read-only processing',
        'verify',
        [
          'Configure traffic mirroring at the load balancer or proxy level',
          'Mirror 100% of traffic to the shadow service (read-only mode)',
          'Shadow service processes requests but results are NOT served to users',
          'Log all shadow responses for comparison',
        ]),
      step(3, 'Output Comparison',
        'Systematically compare monolith and shadow service responses',
        'verify',
        [
          'Build comparison pipeline: match requests by ID and compare response pairs',
          'Categories of comparison: status codes, response bodies, response times',
          'Generate divergence report with categorized discrepancies',
          'Flag semantic differences vs. acceptable variations (timestamps, IDs)',
        ]),
      step(4, 'Discrepancy Analysis',
        'Investigate and fix all behavioral differences',
        'implement',
        [
          'Triage divergences by category: data-mismatch, error, timing, missing-field',
          'Fix bugs in the new service that cause divergences',
          'Re-run comparison after fixes until divergence rate is acceptable',
          `Target: <0.1% divergence rate for "${candidate.name}"`,
        ]),
      step(5, 'Canary Promotion',
        'Gradually shift real traffic to the new service',
        'cutover',
        [
          'Route 1% of real traffic to new service (canary)',
          'Monitor error rates, latency P50/P95/P99, and business metrics',
          'If metrics are healthy, increase to 5% → 25% → 50%',
          'At each stage, wait for sufficient sample size before proceeding',
        ]),
      step(6, 'Full Cutover',
        'Route 100% of traffic to the new service',
        'cutover',
        [
          'Route 100% of traffic to the new service',
          'Keep monolith running but idle for rapid rollback capability',
          'Monitor all metrics for 24-72 hours',
          'Update service discovery and DNS records',
        ]),
      step(7, 'Decommission',
        'Remove monolith code and shadow infrastructure',
        'cleanup',
        [
          `Remove "${candidate.name}" code from the monolith`,
          'Remove traffic mirroring configuration',
          'Remove shadow service comparison pipeline',
          'Archive comparison results for audit trail',
          'Run monolith tests to verify clean removal',
        ]),
    ];
  },

  getGlobalPreconditions(): Precondition[] {
    return [
      {
        description: 'Infrastructure supports traffic mirroring',
        check: 'Verify that the load balancer or proxy supports traffic mirroring/shadowing',
        met: false,
      },
      {
        description: 'Sufficient monitoring in place',
        check: 'Verify that metrics, logging, and alerting are configured for both old and new services',
        met: false,
      },
      {
        description: 'Rollback procedure is tested',
        check: 'Verify that traffic can be instantly routed back to monolith',
        met: false,
      },
    ];
  },
};
