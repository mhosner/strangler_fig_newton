import type { SliceCandidate, MonolithProfile, SeamDefinition } from '../../core/types.js';
import type { TransitionalPattern, ApplicabilityResult } from './pattern.interface.js';
import { generateId } from '../../core/utils.js';

/**
 * Event Interception pattern: When the monolith communicates via message queues,
 * webhooks, or reverse proxies, intercept these events to route traffic to the
 * new microservice without modifying the legacy system's core logic.
 */
export const eventInterceptionPattern: TransitionalPattern = {
  name: 'event-interception',
  displayName: 'Event Interception',
  description:
    'Intercept events from message queues, webhooks, or reverse proxies to route ' +
    'traffic to the new service without modifying the monolith\'s core logic.',

  isApplicable(slice: SliceCandidate, profile: MonolithProfile): ApplicabilityResult {
    const hasEventEntities = profile.entities.some(
      (e) =>
        slice.entityIds.includes(e.id) &&
        (e.entityType === 'queue' || e.entityType === 'topic'),
    );

    const hasEventFlows = profile.dataFlows.some(
      (f) =>
        slice.dataFlowIds.includes(f.id) &&
        ['AMQP', 'Kafka', 'SQS', 'SNS', 'webhook'].some((p) =>
          f.protocol.toLowerCase().includes(p.toLowerCase()),
        ),
    );

    const hasEventEntryPoints = profile.entryPoints.some(
      (ep) => ep.type === 'event-handler',
    );

    const applicable = hasEventEntities || hasEventFlows || hasEventEntryPoints;

    return {
      applicable,
      rationale: applicable
        ? 'This slice uses message queues, event handlers, or webhook integrations. ' +
          'Event Interception allows routing events to the new service without touching the monolith.'
        : 'No event-based communication patterns detected in this slice.',
    };
  },

  designSeam(slice: SliceCandidate, profile: MonolithProfile): SeamDefinition {
    const eventEntities = profile.entities.filter(
      (e) =>
        slice.entityIds.includes(e.id) &&
        (e.entityType === 'queue' || e.entityType === 'topic'),
    );

    return {
      id: generateId(),
      name: `Event Interception for ${slice.name}`,
      description:
        'Introduce an event bridge that intercepts messages from the monolith and ' +
        'routes them to either the old or new service based on routing rules.',
      patternName: 'event-interception',
      integrationPoints: eventEntities.map((entity) => ({
        id: generateId(),
        name: `${entity.entityName} bridge`,
        type: 'event-bridge' as const,
        monolithSide: `Original ${entity.entityType} producer/consumer`,
        serviceSide: `New service ${entity.entityType} consumer`,
        protocol: entity.entityType === 'topic' ? 'Kafka/SNS' : 'AMQP/SQS',
        description: `Bridge for ${entity.entityName}: intercept messages and route to new service`,
      })),
      temporaryArtifacts: [
        'event-bridge-config.json',
        'routing-rules.json',
        'dual-consumer-adapter.ts',
      ],
    };
  },

  getTemporaryArtifacts(): string[] {
    return [
      'Event bridge / router service',
      'Dual-consumer adapter (reads from both old and new)',
      'Routing rules configuration',
      'Message format translation layer',
    ];
  },
};
