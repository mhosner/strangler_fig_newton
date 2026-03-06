import type { SliceCandidate, MonolithProfile, MigrationPlan } from '../core/types.js';
import type { StateManager } from '../core/state.js';
import type { StrategyRegistry } from './strategy-registry.js';
import { generateId, isoNow } from '../core/utils.js';

export class PlanGenerator {
  constructor(
    private readonly registry: StrategyRegistry,
    private readonly stateManager: StateManager,
  ) {}

  generate(
    modernizationPlanId: string,
    candidate: SliceCandidate,
    strategyName: string,
    profile: MonolithProfile,
  ): MigrationPlan {
    const strategy = this.registry.get(strategyName);
    const steps = strategy.generateSteps(candidate, profile);
    const planId = generateId();

    // Assign the planId to all steps
    const stepsWithPlanId = steps.map((step) => ({ ...step, planId }));

    const plan: MigrationPlan = {
      id: planId,
      modernizationPlanId,
      strategyName,
      targetSlice: candidate,
      steps: stepsWithPlanId,
      status: 'draft',
      createdAt: isoNow(),
      updatedAt: isoNow(),
    };

    this.stateManager.saveMigrationPlan(plan);
    return plan;
  }

  renderPlanPreview(plan: MigrationPlan): string {
    const lines = [
      `# Migration Plan: ${plan.targetSlice.name}`,
      '',
      `**Strategy:** ${plan.strategyName}`,
      `**Status:** ${plan.status}`,
      `**Steps:** ${plan.steps.length}`,
      '',
      '## Steps',
      '',
    ];

    for (const step of plan.steps) {
      lines.push(`### ${step.order}. ${step.name} [${step.type}]`);
      lines.push(step.description);
      lines.push('');

      if (step.actions.length > 0) {
        lines.push('Actions:');
        for (const action of step.actions) {
          lines.push(`- ${action.instruction}`);
        }
        lines.push('');
      }

      if (step.preconditions.length > 0) {
        lines.push('Preconditions:');
        for (const pre of step.preconditions) {
          lines.push(`- [${pre.met ? 'x' : ' '}] ${pre.description}`);
        }
        lines.push('');
      }
    }

    return lines.join('\n');
  }
}
