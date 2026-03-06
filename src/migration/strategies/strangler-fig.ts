import type { SliceCandidate, MonolithProfile, MigrationStep, Precondition } from '../../core/types.js';
import type { MigrationStrategy } from '../strategy.interface.js';
import { generateId } from '../../core/utils.js';

function step(
  planId: string,
  order: number,
  name: string,
  description: string,
  type: MigrationStep['type'],
  instructions: string[],
): MigrationStep {
  return {
    id: generateId(),
    planId,
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

export const stranglerFigStrategy: MigrationStrategy = {
  name: 'strangler-fig',
  displayName: 'Strangler Fig',
  description:
    'Incrementally replace monolith capabilities by routing traffic through a facade. ' +
    'New features go to the new service; old features are migrated one by one until ' +
    'the monolith is fully replaced.',

  isApplicable(): boolean {
    // Strangler Fig is the most broadly applicable strategy — always available
    return true;
  },

  generateSteps(candidate: SliceCandidate, profile: MonolithProfile): MigrationStep[] {
    const planId = ''; // Will be set by PlanGenerator
    return [
      step(planId, 1, 'Identify Facade Point',
        'Find or create the API gateway/routing layer that will direct traffic',
        'prepare',
        [
          `Identify the routing layer: Examine ${profile.name}'s entry points to find the existing API gateway, reverse proxy, or load balancer`,
          'If no facade exists: Create a lightweight routing layer (e.g., nginx config, API gateway) in front of the monolith',
          `Document all routes that serve the "${candidate.name}" slice`,
        ]),
      step(planId, 2, 'Create New Service Scaffold',
        'Set up the project structure for the new microservice',
        'prepare',
        [
          `Create new project directory: services/${candidate.name.toLowerCase().replace(/\s+/g, '-')}/`,
          'Initialize project with appropriate build tool and dependencies',
          'Set up CI/CD pipeline configuration',
          'Create health check endpoint',
        ]),
      step(planId, 3, 'Implement Feature in New Service',
        'Port business logic from monolith to the new service',
        'implement',
        [
          'Implement business logic using TDD (write tests first from executable specs)',
          'Implement API endpoints matching the slice\'s entry points',
          'Configure database/data store for the new service',
          'Ensure all executable specifications pass',
        ]),
      step(planId, 4, 'Route Traffic via Facade',
        'Configure the facade to route specific endpoints to the new service',
        'cutover',
        [
          'Update facade routing rules to direct slice-specific traffic to new service',
          'Start with a small percentage (1-5%) of traffic for canary testing',
          'Monitor error rates and latency during initial routing',
        ]),
      step(planId, 5, 'Parallel Verification',
        'Run both old and new paths simultaneously and compare outputs',
        'verify',
        [
          'Enable parallel running: send traffic to both monolith and new service',
          'Compare responses for consistency (status codes, response bodies, timing)',
          'Log and investigate any divergences',
          'Run for sufficient duration to cover edge cases',
        ]),
      step(planId, 6, 'Full Cutover',
        'Switch 100% of traffic to the new service',
        'cutover',
        [
          'Gradually increase traffic percentage: 25% → 50% → 100%',
          'Monitor at each stage, ready to rollback',
          'Update DNS/service discovery to point to new service',
          'Verify all monitoring and alerting is active',
        ]),
      step(planId, 7, 'Retire Old Code',
        'Remove the dead code from the monolith',
        'cleanup',
        [
          `Remove ${candidate.name} code from the monolith codebase`,
          'Remove unused database tables/columns (after data migration verification)',
          'Update monolith dependencies and imports',
          'Remove facade routing rules for migrated endpoints',
          'Run monolith test suite to verify nothing is broken',
        ]),
    ];
  },

  getGlobalPreconditions(): Precondition[] {
    return [
      {
        description: 'Test suite is passing',
        check: 'Run the monolith test suite and confirm all tests pass',
        met: false,
      },
      {
        description: 'Routing layer is accessible',
        check: 'Verify that a facade/gateway/proxy exists or can be created',
        met: false,
      },
    ];
  },
};
