import type { BusinessRule, ExecutableSpec } from '../core/types.js';
import { generateId } from '../core/utils.js';

/**
 * Generates executable specifications from business rules and legacy I/O samples.
 * These specs become the contract between old and new — the test suite that the
 * forward-engineered service must pass. This ensures behavioral equivalence
 * without copying implementation details.
 */
export class SpecGenerator {
  generateSpecPrompt(rules: BusinessRule[]): string {
    const ruleList = rules
      .map((r) => {
        const inputs = r.inputs.map((i) => `    - ${i}`).join('\n');
        const outputs = r.outputs.map((o) => `    - ${o}`).join('\n');
        const constraints = r.constraints.map((c) => `    - ${c}`).join('\n');
        return [
          `  **${r.name}**: ${r.description}`,
          '  Inputs:',
          inputs,
          '  Outputs:',
          outputs,
          '  Constraints:',
          constraints,
        ].join('\n');
      })
      .join('\n\n');

    return [
      '## Generate Executable Specifications',
      '',
      'For each business rule below, create test cases that verify correct behavior.',
      'These specs will be used as the acceptance criteria for the new microservice.',
      '',
      '### Business Rules:',
      ruleList,
      '',
      '### For each rule, generate:',
      '',
      '1. **Happy path test** — normal input, expected output',
      '2. **Edge case tests** — boundary values, empty inputs, maximum values',
      '3. **Constraint violation tests** — inputs that should be rejected',
      '4. **Error handling tests** — what happens when dependencies fail',
      '',
      '### Output each spec as JSON:',
      '```json',
      '{',
      '  "businessRuleId": "id of the rule this tests",',
      '  "testName": "descriptive_test_name",',
      '  "description": "What this test verifies",',
      '  "inputFixture": "JSON or description of test input",',
      '  "expectedOutput": "JSON or description of expected output",',
      '  "assertionType": "exact | equivalent | within-tolerance"',
      '}',
      '```',
      '',
      'Use "exact" for deterministic outputs, "equivalent" for semantically-equal outputs',
      '(e.g., different field ordering), and "within-tolerance" for numeric/timing comparisons.',
    ].join('\n');
  }

  structureResults(rawSpecs: Array<Omit<ExecutableSpec, 'id'>>): ExecutableSpec[] {
    return rawSpecs.map((spec) => ({
      id: generateId(),
      ...spec,
    }));
  }

  generateSpecSummary(specs: ExecutableSpec[], rules: BusinessRule[]): string {
    const ruleMap = new Map(rules.map((r) => [r.id, r]));
    const byRule = new Map<string, ExecutableSpec[]>();

    for (const spec of specs) {
      const existing = byRule.get(spec.businessRuleId) ?? [];
      existing.push(spec);
      byRule.set(spec.businessRuleId, existing);
    }

    const lines = [
      '## Executable Specification Summary',
      '',
      `Total specs: ${specs.length} across ${rules.length} business rules`,
      '',
    ];

    for (const [ruleId, ruleSpecs] of byRule) {
      const rule = ruleMap.get(ruleId);
      lines.push(`### ${rule?.name ?? ruleId} (${ruleSpecs.length} specs)`);
      for (const spec of ruleSpecs) {
        lines.push(`- ${spec.testName}: ${spec.description} [${spec.assertionType}]`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }
}
