import type { MonolithProfile, ProductLine, CodeChunk, EntryPoint } from '../core/types.js';
import { generateId } from '../core/utils.js';

/**
 * Identifies potential product lines within the monolith.
 * A product line is a cohesive set of features that serves a distinct user group
 * or business capability and could be extracted as a standalone service.
 */
export class ProductLineExtractor {
  generateExtractionPrompt(profile: MonolithProfile): string {
    const chunks = profile.chunks
      .map((c) => `- ${c.name} (${c.path}, ${c.fileCount} files)`)
      .join('\n');
    const entries = profile.entryPoints
      .map((e) => `- ${e.filePath} (${e.type}: ${e.description})`)
      .join('\n');

    return [
      `Identify distinct product lines within "${profile.name}".`,
      '',
      'A product line is a cohesive set of features that:',
      '- Serves a specific user group or business capability',
      '- Has its own set of entry points (APIs, UIs, scheduled jobs)',
      '- Could theoretically operate as a standalone system',
      '',
      'Known modules:',
      chunks,
      '',
      'Known entry points:',
      entries,
      '',
      'For each product line, identify:',
      '1. A descriptive name',
      '2. Which modules/chunks belong to it',
      '3. Which entry points serve it',
      '4. An estimate of its user base (internal, small team, department, company-wide, external)',
      '',
      'Output as JSON array of:',
      '```json',
      '{',
      '  "name": "string",',
      '  "description": "what this product line does",',
      '  "chunkIds": ["chunk IDs"],',
      '  "entryPoints": [{"filePath": "...", "type": "...", "description": "..."}],',
      '  "estimatedUserCount": "internal | small-team | department | company-wide | external"',
      '}',
      '```',
    ].join('\n');
  }

  structureResults(
    rawProductLines: Array<Omit<ProductLine, 'id'>>,
  ): ProductLine[] {
    return rawProductLines.map((pl) => ({
      id: generateId(),
      ...pl,
    }));
  }

  createProductLine(
    name: string,
    description: string,
    chunks: CodeChunk[],
    entryPoints: EntryPoint[],
  ): ProductLine {
    return {
      id: generateId(),
      name,
      description,
      chunkIds: chunks.map((c) => c.id),
      entryPoints,
      estimatedUserCount: 'company-wide',
    };
  }
}
