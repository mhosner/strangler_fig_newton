import type { MigrationPlan, ProgressSummary, TimelineEntry } from '../core/types.js';
import type { SfnEvent } from '../core/events.js';
import type { StateManager } from '../core/state.js';

export class ProgressTracker {
  constructor(private readonly stateManager: StateManager) {}

  getSummary(planId: string): ProgressSummary | null {
    const plan = this.stateManager.loadMigrationPlan(planId);
    if (!plan) return null;

    return this.buildSummary(plan);
  }

  getAllSummaries(): ProgressSummary[] {
    return this.stateManager
      .listMigrationPlans()
      .map((plan) => this.buildSummary(plan));
  }

  getTimeline(planId: string): TimelineEntry[] {
    const events = this.stateManager.loadEventHistory();
    return events
      .filter((e): e is SfnEvent & { planId: string } => 'planId' in e && (e as { planId: string }).planId === planId)
      .map((e) => ({
        timestamp: e.timestamp,
        eventType: e.type,
        description: this.describeEvent(e),
        metadata: { ...e } as Record<string, unknown>,
      }));
  }

  renderDashboard(summaries: ProgressSummary[]): string {
    if (summaries.length === 0) return 'No active migration plans.';

    const lines = ['# Migration Dashboard', ''];

    for (const summary of summaries) {
      const bar = this.renderProgressBar(summary.percentComplete);
      lines.push(`## ${summary.strategyName} — Plan ${summary.planId.slice(0, 8)}`);
      lines.push(`Progress: ${bar} ${summary.percentComplete}%`);
      lines.push(`Steps: ${summary.completedSteps}/${summary.totalSteps} completed`);

      if (summary.currentStep) {
        lines.push(`Current: ${summary.currentStep.name} (${summary.currentStep.status})`);
      }

      if (summary.blockers.length > 0) {
        lines.push('Blockers:');
        for (const blocker of summary.blockers) {
          lines.push(`  - ${blocker}`);
        }
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  private buildSummary(plan: MigrationPlan): ProgressSummary {
    const completedSteps = plan.steps.filter((s) => s.status === 'completed').length;
    const totalSteps = plan.steps.length;
    const currentStep = plan.steps.find(
      (s) => s.status === 'in_progress' || s.status === 'failed',
    ) ?? null;

    const blockers: string[] = [];
    if (currentStep?.status === 'failed') {
      blockers.push(`Step "${currentStep.name}" failed: ${currentStep.error ?? 'unknown error'}`);
    }
    for (const step of plan.steps) {
      for (const pre of step.preconditions) {
        if (!pre.met && step.status === 'pending') {
          blockers.push(`${step.name}: ${pre.description}`);
        }
      }
    }

    return {
      planId: plan.id,
      strategyName: plan.strategyName,
      totalSteps,
      completedSteps,
      currentStep,
      percentComplete: totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0,
      blockers,
    };
  }

  private renderProgressBar(pct: number): string {
    const filled = Math.floor(pct / 5);
    return '[' + '='.repeat(filled) + '-'.repeat(20 - filled) + ']';
  }

  private describeEvent(event: SfnEvent): string {
    switch (event.type) {
      case 'MigrationStepStarted':
        return `Started step: ${event.stepName}`;
      case 'MigrationStepCompleted':
        return `Completed step: ${event.stepId} (success: ${event.success})`;
      case 'RollbackInitiated':
        return `Rollback initiated: ${event.reason}`;
      default:
        return event.type;
    }
  }
}
