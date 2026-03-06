import type { MigrationPlan, MigrationStep, ExtractionResult } from '../core/types.js';
import type { StateManager } from '../core/state.js';
import type { EventBus } from '../core/events.js';
import { MigrationError, PreconditionFailedError } from '../core/errors.js';
import { isoNow } from '../core/utils.js';

/**
 * Manages the step-by-step execution of a migration plan.
 * Does NOT execute actions itself — it manages state transitions and emits events.
 * The Claude Code skill reads step instructions and has Claude perform the work.
 */
export class WorkflowOrchestrator {
  constructor(
    private readonly stateManager: StateManager,
    private readonly eventBus: EventBus,
  ) {}

  canProceed(plan: MigrationPlan, stepId: string): { ok: boolean; blockers: string[] } {
    const step = plan.steps.find((s) => s.id === stepId);
    if (!step) return { ok: false, blockers: [`Step ${stepId} not found in plan`] };

    const blockers: string[] = [];

    // Check that all previous steps are completed
    const previousSteps = plan.steps.filter((s) => s.order < step.order);
    for (const prev of previousSteps) {
      if (prev.status !== 'completed') {
        blockers.push(`Previous step "${prev.name}" (order ${prev.order}) is not completed (status: ${prev.status})`);
      }
    }

    // Check step preconditions
    for (const pre of step.preconditions) {
      if (!pre.met) {
        blockers.push(`Precondition not met: ${pre.description}`);
      }
    }

    return { ok: blockers.length === 0, blockers };
  }

  startStep(plan: MigrationPlan, stepId: string): MigrationPlan {
    const { ok, blockers } = this.canProceed(plan, stepId);
    if (!ok) {
      throw new PreconditionFailedError(
        `Cannot start step ${stepId}`,
        blockers.join('; '),
      );
    }

    const updated = this.updateStepStatus(plan, stepId, 'in_progress');
    const step = updated.steps.find((s) => s.id === stepId)!;
    step.startedAt = isoNow();

    if (updated.status === 'draft' || updated.status === 'approved') {
      updated.status = 'in_progress';
    }
    updated.updatedAt = isoNow();

    this.stateManager.saveMigrationPlan(updated);
    this.eventBus.emit({
      type: 'MigrationStepStarted',
      timestamp: isoNow(),
      planId: plan.id,
      stepId,
      stepName: step.name,
    });

    return updated;
  }

  completeStep(plan: MigrationPlan, stepId: string, result: ExtractionResult): MigrationPlan {
    const updated = this.updateStepStatus(plan, stepId, 'completed');
    const step = updated.steps.find((s) => s.id === stepId)!;
    step.completedAt = isoNow();
    updated.updatedAt = isoNow();

    // Check if all steps are complete
    if (updated.steps.every((s) => s.status === 'completed')) {
      updated.status = 'completed';
    }

    this.stateManager.saveMigrationPlan(updated);
    this.stateManager.saveExtractionResult(result);
    this.eventBus.emit({
      type: 'MigrationStepCompleted',
      timestamp: isoNow(),
      planId: plan.id,
      stepId,
      success: result.success,
    });

    return updated;
  }

  failStep(plan: MigrationPlan, stepId: string, error: string): MigrationPlan {
    const updated = this.updateStepStatus(plan, stepId, 'failed');
    const step = updated.steps.find((s) => s.id === stepId)!;
    step.error = error;
    updated.updatedAt = isoNow();

    this.stateManager.saveMigrationPlan(updated);
    this.eventBus.emit({
      type: 'MigrationStepCompleted',
      timestamp: isoNow(),
      planId: plan.id,
      stepId,
      success: false,
    });

    return updated;
  }

  getNextStep(plan: MigrationPlan): MigrationStep | null {
    return plan.steps.find((s) => s.status === 'pending') ?? null;
  }

  private updateStepStatus(
    plan: MigrationPlan,
    stepId: string,
    status: MigrationStep['status'],
  ): MigrationPlan {
    const step = plan.steps.find((s) => s.id === stepId);
    if (!step) throw new MigrationError(`Step ${stepId} not found in plan ${plan.id}`);

    return {
      ...plan,
      steps: plan.steps.map((s) =>
        s.id === stepId ? { ...s, status } : s,
      ),
    };
  }
}
