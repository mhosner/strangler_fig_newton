import type { CodeChunk, EntityRelationship } from '../core/types.js';
import { generateId } from '../core/utils.js';

/**
 * Provides structured instructions for Claude to extract entities and relationships
 * from code chunks. The actual deep analysis is done by Claude via subagents —
 * this class generates the prompts and structures the results.
 */
export class EntityExtractor {
  generateExtractionPrompt(chunks: CodeChunk[]): string {
    const chunkList = chunks
      .map((c) => `- ${c.name} (${c.path}, ${c.fileCount} files, ${c.language})`)
      .join('\n');

    return [
      'Analyze the following code modules and extract all entities and their relationships.',
      '',
      'Modules to analyze:',
      chunkList,
      '',
      'For each module, identify:',
      '1. **Database tables/collections**: Look for ORM models, schema definitions, SQL migrations, CREATE TABLE statements',
      '2. **Transactions/Procedures**: Named business operations that span multiple entities',
      '3. **Message queues/topics**: Kafka topics, RabbitMQ queues, SQS queues, event channels',
      '4. **Call relationships**: Which modules call which other modules (imports, HTTP calls, RPC)',
      '',
      'Output each entity as JSON matching this structure:',
      '```json',
      '{',
      '  "entityName": "string",',
      '  "entityType": "table | collection | segment | transaction | procedure | queue | topic",',
      '  "sourceFile": "path/to/file",',
      '  "relatedEntities": ["other entity names"],',
      '  "callers": ["modules that use this entity"],',
      '  "callees": ["modules this entity depends on"]',
      '}',
      '```',
    ].join('\n');
  }

  structureResults(rawEntities: Array<Omit<EntityRelationship, 'id'>>): EntityRelationship[] {
    return rawEntities.map((entity) => ({
      id: generateId(),
      ...entity,
    }));
  }

  createEmptyEntity(name: string, type: EntityRelationship['entityType'], sourceFile: string): EntityRelationship {
    return {
      id: generateId(),
      entityName: name,
      entityType: type,
      sourceFile,
      relatedEntities: [],
      callers: [],
      callees: [],
    };
  }
}
