import type { MonolithProfile, ValueStream } from '../core/types.js';
import { generateId } from '../core/utils.js';

/**
 * Identifies value streams — end-to-end business processes that deliver value
 * to a customer or stakeholder. These cross-cut product lines and represent
 * the flow of work through the system.
 */
export class ValueStreamExtractor {
  generateExtractionPrompt(profile: MonolithProfile): string {
    const entities = profile.entities
      .map((e) => `- ${e.entityName} (${e.entityType})`)
      .join('\n');
    const flows = profile.dataFlows
      .map((f) => `- ${f.name}: ${f.sourceSystem} → ${f.targetSystem} (${f.protocol})`)
      .join('\n');

    return [
      `Identify distinct value streams within "${profile.name}".`,
      '',
      'A value stream is an end-to-end business process that:',
      '- Starts with a trigger (user action, external event, scheduled job)',
      '- Flows through multiple steps/modules',
      '- Delivers a business outcome (order fulfilled, payment processed, report generated)',
      '',
      'Known entities:',
      entities,
      '',
      'Known data flows:',
      flows,
      '',
      'For each value stream, identify:',
      '1. A descriptive name (e.g., "Order Fulfillment", "User Onboarding")',
      '2. The sequence of steps from trigger to outcome',
      '3. Which modules/chunks are involved',
      '4. Business value: low, medium, high, or critical',
      '',
      'Output as JSON array of:',
      '```json',
      '{',
      '  "name": "string",',
      '  "description": "end-to-end description of this value stream",',
      '  "steps": ["Step 1: ...", "Step 2: ...", "..."],',
      '  "chunkIds": ["chunk IDs involved"],',
      '  "businessValue": "low | medium | high | critical"',
      '}',
      '```',
    ].join('\n');
  }

  structureResults(rawStreams: Array<Omit<ValueStream, 'id'>>): ValueStream[] {
    return rawStreams.map((vs) => ({
      id: generateId(),
      ...vs,
    }));
  }

  createValueStream(
    name: string,
    description: string,
    steps: string[],
    chunkIds: string[],
    businessValue: ValueStream['businessValue'],
  ): ValueStream {
    return {
      id: generateId(),
      name,
      description,
      steps,
      chunkIds,
      businessValue,
    };
  }
}
