import type { SliceCandidate, MonolithProfile, SeamDefinition } from '../../core/types.js';
import type { TransitionalPattern, ApplicabilityResult } from './pattern.interface.js';
import { generateId } from '../../core/utils.js';

/**
 * Revert to Source pattern: When the monolith is acting as a middleman
 * (just passing data through from an upstream source to downstream consumers),
 * bypass the monolith entirely and connect directly to the source system.
 *
 * This is often the simplest and fastest displacement strategy, but only
 * applies when the monolith adds little or no transformation to the data.
 */
export const revertToSourcePattern: TransitionalPattern = {
  name: 'revert-to-source',
  displayName: 'Revert to Source',
  description:
    'Bypass the monolith when it acts as a data middleman. Connect downstream consumers ' +
    'directly to the upstream source system, eliminating the monolith from the data path.',

  isApplicable(slice: SliceCandidate, profile: MonolithProfile): ApplicabilityResult {
    // Look for pass-through patterns: upstream flows in, downstream flows out,
    // with minimal transformation (few entities, low complexity chunks)
    const sliceFlows = profile.dataFlows.filter((f) => slice.dataFlowIds.includes(f.id));
    const hasUpstream = sliceFlows.some((f) => f.direction === 'upstream');
    const hasDownstream = sliceFlows.some((f) => f.direction === 'downstream');

    const sliceChunks = profile.chunks.filter((c) => slice.chunkIds.includes(c.id));
    const isLowComplexity = sliceChunks.every((c) => c.estimatedComplexity !== 'high');
    const hasFewEntities = slice.entityIds.length <= 3;

    const applicable = hasUpstream && hasDownstream && isLowComplexity && hasFewEntities;

    return {
      applicable,
      rationale: applicable
        ? 'This slice appears to be a data pass-through: it receives data from upstream, stores minimally, ' +
          'and forwards to downstream consumers. Consider connecting consumers directly to the source.'
        : hasUpstream && hasDownstream
          ? 'This slice has both upstream and downstream flows, but adds significant transformation ' +
            '(high complexity or many entities). Revert to Source would lose business logic.'
          : 'This slice does not exhibit a clear pass-through pattern (needs both upstream and downstream flows).',
    };
  },

  designSeam(slice: SliceCandidate, profile: MonolithProfile): SeamDefinition {
    const upstreamFlows = profile.dataFlows.filter(
      (f) => slice.dataFlowIds.includes(f.id) && f.direction === 'upstream',
    );
    const downstreamFlows = profile.dataFlows.filter(
      (f) => slice.dataFlowIds.includes(f.id) && f.direction === 'downstream',
    );

    const integrationPoints = upstreamFlows.map((upstream) => ({
      id: generateId(),
      name: `Direct connection: ${upstream.sourceSystem}`,
      type: 'direct-source' as const,
      monolithSide: `Current: ${upstream.sourceSystem} → monolith → downstream`,
      serviceSide: `Target: ${upstream.sourceSystem} → downstream (direct)`,
      protocol: upstream.protocol,
      description:
        `Redirect downstream consumers to connect directly to ${upstream.sourceSystem} ` +
        `via ${upstream.protocol}, bypassing the monolith entirely.`,
    }));

    return {
      id: generateId(),
      name: `Revert to Source for ${slice.name}`,
      description:
        'Eliminate the monolith from the data path by connecting downstream consumers ' +
        'directly to upstream source systems.',
      patternName: 'revert-to-source',
      integrationPoints,
      temporaryArtifacts: [
        'dual-path-router (sends to both monolith and direct during transition)',
        'data-consistency-checker (verifies direct path matches monolith path)',
      ],
    };
  },

  getTemporaryArtifacts(): string[] {
    return [
      'Dual-path router (routes traffic to both old and new paths during validation)',
      'Data consistency checker (compares outputs of both paths)',
      'Temporary API adapter (if source system API differs from what consumers expect)',
    ];
  },
};
