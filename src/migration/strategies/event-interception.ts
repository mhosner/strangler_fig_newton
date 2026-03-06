import type { SliceCandidate, MonolithProfile, MigrationStep, Precondition } from '../../core/types.js';
import type { MigrationStrategy } from '../strategy.interface.js';
import { generateId } from '../../core/utils.js';

function step(
  order: number,
  name: string,
  description: string,
  type: MigrationStep['type'],
  instructions: string[],
): MigrationStep {
  return {
    id: generateId(),
    planId: '',
    order,
    name,
    description,
    type,
    status: 'pending',
    preconditions: [],
    actions: instructions.map((inst) => ({
      description: inst.split(':')[0] ?? inst,
      instruction: inst,
      completed: false,
    })),
    verificationCriteria: [],
    rollbackProcedure: { description: `Rollback ${name}`, steps: [], automated: false },
  };
}

export const eventInterceptionStrategy: MigrationStrategy = {
  name: 'event-interception',
  displayName: 'Event Interception',
  description:
    'Intercept events from message queues, webhooks, or buses to route processing ' +
    'to the new service. Ideal for event-driven boundaries where the monolith ' +
    'communicates via messages.',

  isApplicable(_candidate: SliceCandidate, profile: MonolithProfile): boolean {
    return profile.entryPoints.some((ep) => ep.type === 'event-handler') ||
      profile.entities.some((e) => e.entityType === 'queue' || e.entityType === 'topic');
  },

  generateSteps(candidate: SliceCandidate, profile: MonolithProfile): MigrationStep[] {
    return [
      step(1, 'Map Event Flows',
        'Identify all events/messages flowing through this slice',
        'prepare',
        [
          `Trace all message queues, topics, and event channels used by "${candidate.name}"`,
          'Document message formats, schemas, and serialization',
          'Identify producers and consumers for each event channel',
          'Map event ordering and delivery guarantees',
        ]),
      step(2, 'Introduce Event Bridge',
        'Set up messaging infrastructure for routing events to the new service',
        'prepare',
        [
          'Create an event bridge/router between monolith and new service',
          'Configure dual-subscription: both monolith and new service receive events',
          'Ensure message ordering is preserved through the bridge',
          'Set up dead-letter queues for failed messages',
        ]),
      step(3, 'Create Event Consumer Service',
        'Build the new service that subscribes to intercepted events',
        'implement',
        [
          'Create new service with event consumer implementations',
          'Implement message deserialization matching monolith formats',
          'Build business logic using TDD against executable specifications',
          'Add idempotency handling for duplicate messages',
        ]),
      step(4, 'Dual-Write Phase',
        'Run both monolith and new service processing the same events',
        'verify',
        [
          'Enable dual processing: both monolith and new service consume events',
          'New service processes but does not write to production data stores yet',
          'Compare processing results between monolith and new service',
          'Log discrepancies for investigation',
        ]),
      step(5, 'Verify Consistency',
        'Ensure new service produces identical results to the monolith',
        'verify',
        [
          'Compare outputs from both processing paths',
          'Verify data consistency and completeness',
          'Check edge cases: out-of-order messages, retries, failures',
          'Run for sufficient duration to build confidence',
        ]),
      step(6, 'Cutover',
        'Stop monolith event processing; new service becomes sole consumer',
        'cutover',
        [
          'Switch new service to write to production data stores',
          'Disable monolith event consumers for this slice',
          'Update routing rules in event bridge',
          'Monitor for processing errors and data inconsistencies',
        ]),
      step(7, 'Clean Up',
        'Remove monolith event handlers and the temporary event bridge',
        'cleanup',
        [
          'Remove monolith event handler code for migrated events',
          'Remove or simplify the event bridge (direct subscription)',
          'Clean up dual-subscription configurations',
          'Verify all events are processed solely by the new service',
        ]),
    ];
  },

  getGlobalPreconditions(): Precondition[] {
    return [
      {
        description: 'Message broker is accessible',
        check: 'Verify connectivity to the message broker (Kafka, RabbitMQ, SQS, etc.)',
        met: false,
      },
      {
        description: 'Event schemas are documented',
        check: 'Verify that message formats and schemas are known or can be reverse-engineered',
        met: false,
      },
    ];
  },
};
