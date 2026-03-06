import type { SliceCandidate, MonolithProfile, SeamDefinition } from '../../core/types.js';
import type { TransitionalPattern, ApplicabilityResult } from './pattern.interface.js';
import { generateId } from '../../core/utils.js';

/**
 * Legacy Mimic pattern: Create an Anti-Corruption Layer so the new microservice
 * can co-exist with the monolith without either side needing to understand the
 * other's internal model.
 *
 * Two variants:
 * - Service Providing Mimic: New service hides behind a legacy-compatible interface
 * - Service Consuming Mimic: New service wraps calls to legacy APIs in its own model
 */
export const legacyMimicPattern: TransitionalPattern = {
  name: 'legacy-mimic',
  displayName: 'Legacy Mimic (Anti-Corruption Layer)',
  description:
    'Create an Anti-Corruption Layer using Service Providing Mimic (new service behind legacy interface) ' +
    'or Service Consuming Mimic (new service wraps legacy APIs). Prevents domain model pollution.',

  isApplicable(slice: SliceCandidate, profile: MonolithProfile): ApplicabilityResult {
    // Legacy Mimic is applicable when the slice has API entry points that
    // other parts of the monolith depend on (Service Providing), or when
    // the slice depends on other parts of the monolith (Service Consuming).
    const hasHttpEntryPoints = profile.entryPoints.some(
      (ep) => ep.type === 'http-controller',
    );

    const hasExternalCallers = profile.entities.some(
      (e) => slice.entityIds.includes(e.id) && e.callers.length > 0,
    );

    const hasExternalDependencies = profile.entities.some(
      (e) => slice.entityIds.includes(e.id) && e.callees.length > 0,
    );

    const applicable = hasHttpEntryPoints && (hasExternalCallers || hasExternalDependencies);

    return {
      applicable,
      rationale: applicable
        ? `This slice has API interfaces consumed by other modules${hasExternalDependencies ? ' and depends on external modules' : ''}. ` +
          'An Anti-Corruption Layer will prevent domain model pollution between old and new.'
        : 'This slice has minimal API surface or external dependencies — a simpler integration may suffice.',
    };
  },

  designSeam(slice: SliceCandidate, profile: MonolithProfile): SeamDefinition {
    const integrationPoints = [];

    // Service Providing Mimic: new service exposes legacy-compatible API
    const httpEntryPoints = profile.entryPoints.filter(
      (ep) => ep.type === 'http-controller',
    );
    if (httpEntryPoints.length > 0) {
      integrationPoints.push({
        id: generateId(),
        name: `${slice.name} Service Providing Mimic`,
        type: 'anti-corruption-layer' as const,
        monolithSide: 'Existing API consumers expect the legacy interface',
        serviceSide: 'New service implements clean domain model internally',
        protocol: 'HTTP/REST',
        description:
          'Facade layer that translates between legacy API contracts and the new service\'s domain model. ' +
          'External callers continue using the old API shape; the facade translates to/from the new model.',
      });
    }

    // Service Consuming Mimic: new service wraps calls to remaining monolith
    const externalDeps = profile.entities.filter(
      (e) => slice.entityIds.includes(e.id) && e.callees.length > 0,
    );
    if (externalDeps.length > 0) {
      integrationPoints.push({
        id: generateId(),
        name: `${slice.name} Service Consuming Mimic`,
        type: 'anti-corruption-layer' as const,
        monolithSide: 'Monolith APIs that the new service must call',
        serviceSide: 'Adapter classes that wrap legacy API calls in clean domain types',
        protocol: 'HTTP/REST',
        description:
          'Client adapter layer that wraps calls to the remaining monolith APIs. ' +
          'The new service works with its own domain model; the adapter translates to legacy API shapes.',
      });
    }

    return {
      id: generateId(),
      name: `Anti-Corruption Layer for ${slice.name}`,
      description:
        'Bi-directional Anti-Corruption Layer using Legacy Mimic pattern. ' +
        'Service Providing Mimic exposes legacy interface; Service Consuming Mimic wraps legacy dependencies.',
      patternName: 'legacy-mimic',
      integrationPoints,
      temporaryArtifacts: [
        'providing-mimic-facade/',
        'consuming-mimic-adapters/',
        'legacy-api-contracts/',
        'translation-mappers/',
      ],
    };
  },

  getTemporaryArtifacts(): string[] {
    return [
      'Service Providing Mimic facade (removed when all consumers migrate to new API)',
      'Service Consuming Mimic adapters (removed when monolith dependencies are extracted)',
      'Legacy API contract definitions (replaced by new service contracts)',
      'Domain model translation mappers',
    ];
  },
};
