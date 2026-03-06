import type { AuditEntry } from '../core/types.js';
import type { StateManager } from '../core/state.js';
import { isoNow } from '../core/utils.js';

/**
 * Records all changes made during migration for compliance and debugging.
 * Stores a chronological log of every action taken, files affected, and diffs.
 */
export class AuditTrail {
  private entries: AuditEntry[] = [];

  constructor(private readonly stateManager: StateManager) {}

  record(entry: Omit<AuditEntry, 'timestamp'>): void {
    const full: AuditEntry = { timestamp: isoNow(), ...entry };
    this.entries.push(full);
  }

  getTrail(planId: string): AuditEntry[] {
    return this.entries.filter((e) => e.planId === planId);
  }

  getAllEntries(): readonly AuditEntry[] {
    return this.entries;
  }

  generateReport(planId: string): string {
    const trail = this.getTrail(planId);
    if (trail.length === 0) return `No audit entries for plan ${planId}.`;

    const lines = [
      `# Audit Trail — Plan ${planId.slice(0, 8)}`,
      '',
      `Total entries: ${trail.length}`,
      '',
    ];

    for (const entry of trail) {
      lines.push(`## ${entry.timestamp}`);
      lines.push(`**Action:** ${entry.action}`);
      if (entry.stepId) lines.push(`**Step:** ${entry.stepId.slice(0, 8)}`);
      lines.push(`**Description:** ${entry.description}`);

      if (entry.filesAffected.length > 0) {
        lines.push('**Files affected:**');
        for (const file of entry.filesAffected) {
          lines.push(`- ${file}`);
        }
      }

      if (entry.diff) {
        lines.push('**Diff:**');
        lines.push('```diff');
        lines.push(entry.diff);
        lines.push('```');
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  generateSummaryStats(planId: string): {
    totalActions: number;
    filesCreated: number;
    filesModified: number;
    filesDeleted: number;
  } {
    const trail = this.getTrail(planId);
    const allFiles = trail.flatMap((e) => e.filesAffected);
    const actions = trail.map((e) => e.action.toLowerCase());

    return {
      totalActions: trail.length,
      filesCreated: actions.filter((a) => a.includes('create')).length,
      filesModified: actions.filter((a) => a.includes('modify') || a.includes('edit')).length,
      filesDeleted: actions.filter((a) => a.includes('delete') || a.includes('remove')).length,
    };
  }
}
