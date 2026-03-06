import type { CodeChunk, BusinessRule } from '../core/types.js';
import { generateId } from '../core/utils.js';

/**
 * Generates instructions for the reverse-engineer subagent to extract
 * business rules from legacy code. The key discipline: separate core
 * algorithms from framework boilerplate, configuration, and dead code.
 * We extract the "what" (business rules) not the "how" (implementation details).
 */
export class ReverseEngineer {
  generateAnalysisPrompt(chunk: CodeChunk): string {
    return [
      '## Reverse Engineering Task',
      '',
      `Analyze the code in: ${chunk.path}`,
      `Language: ${chunk.language}`,
      `Estimated complexity: ${chunk.estimatedComplexity}`,
      '',
      '### Goal: Extract Business Rules, Not Code',
      '',
      'Do NOT copy code. Instead, identify and describe:',
      '',
      '1. **Business Rules** — the actual logic that matters:',
      '   - What decisions does this code make?',
      '   - What calculations does it perform?',
      '   - What validations does it enforce?',
      '   - What state transitions does it manage?',
      '',
      '2. **Inputs and Outputs** for each rule:',
      '   - What data goes in? (parameters, database reads, external calls)',
      '   - What comes out? (return values, database writes, events emitted)',
      '   - What constraints/invariants must hold?',
      '',
      '3. **Separate and discard:**',
      '   - Framework boilerplate (dependency injection, servlet config, ORM setup)',
      '   - Logging and monitoring instrumentation',
      '   - Dead code (unreachable branches, commented-out blocks)',
      '   - Legacy workarounds that are no longer needed',
      '   - Configuration and environment-specific code',
      '',
      'Output each business rule as JSON:',
      '```json',
      '{',
      '  "name": "descriptive-rule-name",',
      '  "description": "Plain English description of what this rule does",',
      '  "inputs": ["input1: type and description", "input2: type and description"],',
      '  "outputs": ["output1: type and description"],',
      '  "constraints": ["invariant or validation that must hold"],',
      '  "sourceFiles": ["file paths where this rule is implemented"]',
      '}',
      '```',
    ].join('\n');
  }

  structureResults(
    chunkId: string,
    rawRules: Array<Omit<BusinessRule, 'id' | 'sourceChunkId'>>,
  ): BusinessRule[] {
    return rawRules.map((rule) => ({
      id: generateId(),
      sourceChunkId: chunkId,
      ...rule,
    }));
  }

  generateBoilerplateReport(chunk: CodeChunk): string {
    return [
      `## Boilerplate Analysis for ${chunk.name}`,
      '',
      'Identify and categorize non-business code:',
      '',
      '| Category | Examples to Look For |',
      '|----------|---------------------|',
      '| Framework config | DI containers, servlet config, middleware setup |',
      '| ORM boilerplate | Entity mappings, migration scripts, connection pooling |',
      '| Logging | Log statements, audit trail instrumentation |',
      '| Error handling | Generic catch blocks, retry logic, circuit breakers |',
      '| Legacy workarounds | Comments with "hack", "workaround", "temporary" |',
      '| Dead code | Unused methods, commented blocks, feature flags always off |',
      '',
      'For each category, estimate what percentage of the codebase it represents.',
      'This helps quantify how much simpler the new service will be.',
    ].join('\n');
  }
}
