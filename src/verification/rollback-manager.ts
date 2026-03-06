import type { MigrationPlan, MigrationStep } from '../core/types.js';
import type { StateManager } from '../core/state.js';
import type { EventBus } from '../core/events.js';
import { MigrationError } from '../core/errors.js';
import { isoNow } from '../core/utils.js';

/**
 * Manages rollback procedures for failed migration steps.
 * Steps are rolled back in reverse order, and each step's rollback procedure
 * provides Claude with instructions for undoing the changes.
 */
export class RollbackManager {
  constructor(
    private readonly stateManager: StateManager,
    private readonly eventBus: EventBus,
  ) {}

  canRollback(plan: MigrationPlan): boolean {
    return plan.steps.some(
      (s) => s.status === 'completed' || s.status === 'failed' || s.status === 'in_progress',
    );
  }

  getLastCompletedStep(plan: MigrationPlan): MigrationStep | null {
    const completed = plan.steps
      .filter((s) => s.status === 'completed')
      .sort((a, b) => b.order - a.order);
    return completed[0] ?? null;
  }

  getRollbackSequence(plan: MigrationPlan): MigrationStep[] {
    // Return completed and in-progress steps in reverse order
    return plan.steps
      .filter((s) => s.status === 'completed' || s.status === 'in_progress' || s.status === 'failed')
      .sort((a, b) => b.order - a.order);
  }

  rollbackStep(plan: MigrationPlan, stepId: string, reason: string): MigrationPlan {
    const step = plan.steps.find((s) => s.id === stepId);
    if (!step) throw new MigrationError(`Step ${stepId} not found in plan ${plan.id}`);

    this.eventBus.emit({
      type: 'RollbackInitiated',
      timestamp: isoNow(),
      planId: plan.id,
      stepId,
      reason,
    });

    const updated: MigrationPlan = {
      ...plan,
      steps: plan.steps.map((s) =>
        s.id === stepId ? { ...s, status: 'rolled_back' as const } : s,
      ),
      status: 'rolled_back',
      updatedAt: isoNow(),
    };

    this.stateManager.saveMigrationPlan(updated);
    return updated;
  }

  generateRollbackPrompt(plan: MigrationPlan): string {
    const sequence = this.getRollbackSequence(plan);
    if (sequence.length === 0) {
      return 'No steps to roll back — no migration work has been completed.';
    }

    const lines = [
      '## Rollback Plan',
      '',
      `Rolling back ${sequence.length} step(s) in reverse order.`,
      '',
    ];

    for (const step of sequence) {
      lines.push(`### Rollback Step ${step.order}: ${step.name}`);
      lines.push(`Current status: ${step.status}`);
      lines.push('');

      if (step.rollbackProcedure.steps.length > 0) {
        lines.push('**Rollback instructions:**');
        for (const instruction of step.rollbackProcedure.steps) {
          lines.push(`1. ${instruction}`);
        }
      } else {
        lines.push('**Rollback instructions:** (auto-generated)');
        lines.push(`1. Revert all changes made during "${step.name}"`);
        lines.push('2. Verify the monolith is functioning correctly');
        lines.push('3. Run the test suite to confirm no regressions');
      }

      lines.push('');
      lines.push(step.rollbackProcedure.automated
        ? '(This rollback can be automated)'
        : '(This rollback requires manual verification)');
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    return lines.join('\n');
  }
}
