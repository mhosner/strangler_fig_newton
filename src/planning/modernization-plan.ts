import type { SliceCandidate, FeatureParityReport, ModernizationPlan } from '../core/types.js';
import type { StateManager } from '../core/state.js';
import type { EventBus } from '../core/events.js';
import { generateId, isoNow } from '../core/utils.js';

export class ModernizationPlanGenerator {
  constructor(
    private readonly stateManager: StateManager,
    private readonly eventBus: EventBus,
  ) {}

  generate(
    monolithProfileId: string,
    selectedSlice: SliceCandidate,
    featureParityReport: FeatureParityReport,
  ): ModernizationPlan {
    const plan: ModernizationPlan = {
      id: generateId(),
      monolithProfileId,
      selectedSlice,
      featureParityReport,
      status: 'draft',
      createdAt: isoNow(),
      updatedAt: isoNow(),
    };

    this.stateManager.saveModernizationPlan(plan);
    return plan;
  }

  approve(plan: ModernizationPlan): ModernizationPlan {
    const updated: ModernizationPlan = {
      ...plan,
      status: 'approved',
      updatedAt: isoNow(),
    };

    this.stateManager.saveModernizationPlan(updated);
    this.eventBus.emit({
      type: 'PlanApproved',
      timestamp: isoNow(),
      planId: updated.id,
      sliceName: updated.selectedSlice.name,
    });

    return updated;
  }

  renderPlanSummary(plan: ModernizationPlan): string {
    const { selectedSlice, featureParityReport } = plan;

    const lines = [
      `# Modernization Plan: ${selectedSlice.name}`,
      '',
      `**Status:** ${plan.status}`,
      `**Created:** ${plan.createdAt}`,
      '',
      '## Selected Slice',
      `- **Name:** ${selectedSlice.name}`,
      `- **Type:** ${selectedSlice.type}`,
      `- **Business Value:** ${selectedSlice.businessValueScore}/10`,
      `- **Risk:** ${selectedSlice.riskScore}/10`,
      `- **Modules:** ${selectedSlice.chunkIds.length}`,
      `- **Entities:** ${selectedSlice.entityIds.length}`,
      `- **Data Flows:** ${selectedSlice.dataFlowIds.length}`,
      '',
      '## Feature Parity Analysis',
      `- **Total features identified:** ${featureParityReport.totalFeatures}`,
      `- **Confirmed needed:** ${featureParityReport.confirmedNeeded.length}`,
      `- **Can be dropped:** ${featureParityReport.confirmedUnneeded.length}`,
      `- **Needs validation:** ${featureParityReport.uncertain.length}`,
      `- **Dead code paths:** ${featureParityReport.deadCodePaths.length}`,
      `- **Legacy workarounds:** ${featureParityReport.legacyWorkarounds.length}`,
      `- **Scope reduction:** ${featureParityReport.reductionPercentage}%`,
      '',
      '## Rationale',
      selectedSlice.rationale,
    ];

    if (featureParityReport.reductionPercentage > 20) {
      lines.push('');
      lines.push(`> **Note:** ${featureParityReport.reductionPercentage}% of features can be eliminated. This is a significant scope reduction that will accelerate the migration.`);
    }

    return lines.join('\n');
  }
}
