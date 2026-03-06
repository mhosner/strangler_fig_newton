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

export const branchByAbstractionStrategy: MigrationStrategy = {
  name: 'branch-by-abstraction',
  displayName: 'Branch by Abstraction',
  description:
    'Introduce an abstraction layer at the seam boundary, then swap the implementation ' +
    'behind it. Ideal for tightly coupled components where a clean routing-based split is difficult.',

  isApplicable(candidate: SliceCandidate): boolean {
    // Best for tightly coupled slices
    return candidate.riskScore >= 5;
  },

  generateSteps(candidate: SliceCandidate): MigrationStep[] {
    return [
      step(1, 'Create Abstraction Layer',
        'Define interfaces at the seam boundary between the slice and the rest of the monolith',
        'abstract',
        [
          `Identify all points where "${candidate.name}" code is called by other modules`,
          'Define interfaces/contracts for each call point',
          'Create the abstraction layer (interface definitions, abstract classes)',
        ]),
      step(2, 'Refactor Monolith to Use Abstraction',
        'Modify the monolith to call through the new interfaces instead of direct implementations',
        'abstract',
        [
          'Replace direct calls with calls through the abstraction layer',
          'Ensure existing tests still pass through the abstraction',
          'This is a refactoring — behavior should not change',
        ]),
      step(3, 'Verify Abstraction',
        'Confirm the monolith works correctly through the new abstraction layer',
        'verify',
        [
          'Run full test suite — all tests must pass',
          'Verify no performance regression from the indirection layer',
          'Check that the abstraction covers all usage points',
        ]),
      step(4, 'Create New Implementation',
        'Build the extracted service that implements the same abstraction',
        'implement',
        [
          'Create new service project implementing the abstraction interfaces',
          'Use TDD to build the implementation against executable specifications',
          'Ensure the new implementation is API-compatible with the abstraction',
        ]),
      step(5, 'Add Feature Toggle',
        'Introduce a toggle to switch between old and new implementations',
        'prepare',
        [
          'Add a feature flag/toggle to switch between monolith and new service implementations',
          'Default to monolith implementation (toggle off)',
          'Ensure toggle can be changed without redeployment (config, env var, or feature flag service)',
        ]),
      step(6, 'Gradual Migration',
        'Progressively shift traffic from old to new implementation using the toggle',
        'cutover',
        [
          'Enable toggle for a small percentage of traffic or specific user segments',
          'Monitor for errors, latency changes, and data inconsistencies',
          'Gradually increase the percentage: 10% → 25% → 50% → 100%',
          'At each stage, compare metrics between old and new paths',
        ]),
      step(7, 'Remove Old Implementation',
        'Clean up the monolith by removing the old implementation and the abstraction layer',
        'cleanup',
        [
          'Remove the feature toggle (new implementation is now the only one)',
          'Remove the old implementation code from the monolith',
          'Optionally remove the abstraction layer if no longer needed',
          'Run all tests to verify clean removal',
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
        description: 'Seam boundaries are identified',
        check: 'Verify that the transitional scaffolding phase has identified integration points',
        met: false,
      },
    ];
  },
};
