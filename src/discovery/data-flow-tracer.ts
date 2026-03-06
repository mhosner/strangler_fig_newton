import type {
  MonolithProfile,
  EntityRelationship,
  DataFlow,
  SystemContextDiagram,
} from '../core/types.js';
import { generateId } from '../core/utils.js';

/**
 * Generates instructions for Claude to trace data flows through the monolith
 * and produces a system context diagram structure.
 */
export class DataFlowTracer {
  generateTracingPrompt(profile: MonolithProfile, entities: EntityRelationship[]): string {
    const entityList = entities.map((e) => `- ${e.entityName} (${e.entityType})`).join('\n');
    const frameworkList = profile.frameworks.map((f) => f.framework).join(', ');

    return [
      `Trace all data flows for the system "${profile.name}" (${frameworkList}).`,
      '',
      'Known entities:',
      entityList,
      '',
      'Identify:',
      '1. **Upstream systems** — external services, APIs, files, or queues that feed data INTO this system',
      '2. **Downstream consumers** — external services, APIs, files, or queues that consume data FROM this system',
      '3. **Protocols** — HTTP/REST, gRPC, AMQP, Kafka, JDBC, filesystem, SMTP, etc.',
      '',
      'Look for:',
      '- HTTP client calls (RestTemplate, axios, requests, HttpClient)',
      '- Database connection strings pointing to external databases',
      '- Message producer/consumer configurations',
      '- File import/export paths',
      '- SMTP/email configurations',
      '- External API base URLs in config files',
      '',
      'Output each flow as JSON:',
      '```json',
      '{',
      '  "name": "descriptive name",',
      '  "direction": "upstream | downstream | bidirectional",',
      '  "protocol": "HTTP | AMQP | Kafka | JDBC | etc",',
      '  "sourceSystem": "origin system name",',
      '  "targetSystem": "destination system name",',
      '  "dataDescription": "what data flows and why"',
      '}',
      '```',
    ].join('\n');
  }

  buildSystemContext(
    systemName: string,
    flows: Array<Omit<DataFlow, 'id'>>,
    datastores: EntityRelationship[],
  ): SystemContextDiagram {
    const typedFlows: DataFlow[] = flows.map((f) => ({ id: generateId(), ...f }));

    return {
      centralSystem: systemName,
      upstreamFlows: typedFlows.filter((f) => f.direction === 'upstream' || f.direction === 'bidirectional'),
      downstreamFlows: typedFlows.filter((f) => f.direction === 'downstream' || f.direction === 'bidirectional'),
      datastores: datastores.filter(
        (e) => e.entityType === 'table' || e.entityType === 'collection',
      ),
    };
  }

  renderContextDiagramAscii(diagram: SystemContextDiagram): string {
    const lines: string[] = [];
    lines.push('=== System Context Diagram ===');
    lines.push('');

    if (diagram.upstreamFlows.length > 0) {
      lines.push('UPSTREAM SYSTEMS:');
      for (const flow of diagram.upstreamFlows) {
        lines.push(`  [${flow.sourceSystem}] --${flow.protocol}--> [${diagram.centralSystem}]`);
        lines.push(`    Data: ${flow.dataDescription}`);
      }
      lines.push('');
    }

    lines.push(`  === ${diagram.centralSystem} ===`);
    lines.push('');

    if (diagram.datastores.length > 0) {
      lines.push('DATASTORES:');
      for (const ds of diagram.datastores) {
        lines.push(`  (${ds.entityType}) ${ds.entityName}`);
      }
      lines.push('');
    }

    if (diagram.downstreamFlows.length > 0) {
      lines.push('DOWNSTREAM CONSUMERS:');
      for (const flow of diagram.downstreamFlows) {
        lines.push(`  [${diagram.centralSystem}] --${flow.protocol}--> [${flow.targetSystem}]`);
        lines.push(`    Data: ${flow.dataDescription}`);
      }
    }

    return lines.join('\n');
  }
}
