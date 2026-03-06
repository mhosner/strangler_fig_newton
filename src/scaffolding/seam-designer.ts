import type {
  SliceCandidate,
  MonolithProfile,
  SeamDefinition,
  TransitionalDesign,
} from '../core/types.js';
import type { TransitionalPattern } from './patterns/pattern.interface.js';
import type { StateManager } from '../core/state.js';
import type { EventBus } from '../core/events.js';
import { generateId, isoNow } from '../core/utils.js';

/**
 * Designs the transitional architecture — the temporary integrations that allow
 * the monolith and new microservice to co-exist during the migration.
 * All scaffolding artifacts are explicitly marked as temporary.
 */
export class SeamDesigner {
  constructor(
    private readonly stateManager: StateManager,
    private readonly eventBus: EventBus,
  ) {}

  designSeams(
    planId: string,
    slice: SliceCandidate,
    profile: MonolithProfile,
    selectedPatterns: TransitionalPattern[],
  ): TransitionalDesign {
    const seams: SeamDefinition[] = selectedPatterns.map((pattern) =>
      pattern.designSeam(slice, profile),
    );

    const allTemporaryArtifacts = selectedPatterns.flatMap((p) => p.getTemporaryArtifacts());

    const antiCorruptionLayers = selectedPatterns
      .filter((p) => p.name === 'legacy-mimic')
      .map((p) => {
        const seam = p.designSeam(slice, profile);
        return {
          name: seam.name,
          mimics: [],
          boundaryDescription: seam.description,
        };
      });

    const design: TransitionalDesign = {
      id: generateId(),
      planId,
      seams,
      antiCorruptionLayers,
      temporaryInfrastructure: allTemporaryArtifacts,
      createdAt: isoNow(),
    };

    this.stateManager.saveTransitionalDesign(design);
    this.eventBus.emit({
      type: 'ScaffoldingDesigned',
      timestamp: isoNow(),
      designId: design.id,
      patternCount: selectedPatterns.length,
    });

    return design;
  }

  renderDesignSummary(design: TransitionalDesign): string {
    const lines = [
      '# Transitional Architecture Design',
      '',
      `**Design ID:** ${design.id}`,
      `**Created:** ${design.createdAt}`,
      '',
      '## Seams',
      '',
    ];

    for (const seam of design.seams) {
      lines.push(`### ${seam.name}`);
      lines.push(`Pattern: ${seam.patternName}`);
      lines.push(seam.description);
      lines.push('');
      lines.push('**Integration Points:**');
      for (const ip of seam.integrationPoints) {
        lines.push(`- **${ip.name}** (${ip.type}, ${ip.protocol})`);
        lines.push(`  Monolith side: ${ip.monolithSide}`);
        lines.push(`  Service side: ${ip.serviceSide}`);
      }
      lines.push('');
    }

    if (design.temporaryInfrastructure.length > 0) {
      lines.push('## Temporary Infrastructure (to be removed post-cutover)');
      lines.push('');
      for (const artifact of design.temporaryInfrastructure) {
        lines.push(`- ${artifact}`);
      }
    }

    return lines.join('\n');
  }
}
