import type { ExecutableSpec, TDDCycle } from '../core/types.js';

/**
 * Generates the TDD plan for building the new microservice. Each executable
 * specification becomes a RED-GREEN-REFACTOR cycle. This ensures the new
 * service is built test-first — never by blind translation of legacy code.
 */
export class ForwardEngineer {
  generateTDDPlan(specs: ExecutableSpec[]): TDDCycle[] {
    return specs.map((spec, index) => ({
      order: index + 1,
      specId: spec.id,
      redPhase: this.generateRedPhase(spec),
      greenPhase: this.generateGreenPhase(spec),
      refactorPhase: this.generateRefactorPhase(spec, index),
    }));
  }

  private generateRedPhase(spec: ExecutableSpec): string {
    return [
      `## RED: Write failing test for "${spec.testName}"`,
      '',
      `Write a test that verifies: ${spec.description}`,
      '',
      'Test setup:',
      `- Input fixture: ${spec.inputFixture}`,
      `- Expected output: ${spec.expectedOutput}`,
      `- Assertion type: ${spec.assertionType}`,
      '',
      'The test MUST fail initially (no implementation exists yet).',
      'Run the test suite and confirm this specific test fails with a clear error.',
    ].join('\n');
  }

  private generateGreenPhase(spec: ExecutableSpec): string {
    return [
      `## GREEN: Implement minimum code to pass "${spec.testName}"`,
      '',
      'Write the SIMPLEST implementation that makes this test pass.',
      'Do not anticipate future requirements or add unnecessary complexity.',
      '',
      'Guidelines:',
      '- Implement ONLY what this test requires',
      '- It is okay to hardcode values if only one test case exists',
      '- Do NOT copy legacy code — implement from the business rule description',
      '- Run the test suite and confirm this test (and all previous tests) pass',
    ].join('\n');
  }

  private generateRefactorPhase(spec: ExecutableSpec, index: number): string {
    if (index < 2) {
      return 'Review the code for clarity. With few tests, major refactoring is premature.';
    }

    return [
      '## REFACTOR: Improve code quality while keeping all tests green',
      '',
      'Now that multiple tests pass, look for:',
      '- Duplicated logic that can be extracted into shared functions',
      '- Magic values that should be named constants',
      '- Complex conditionals that can be simplified',
      '- Missing abstractions that would clarify intent',
      '',
      'After refactoring, run the FULL test suite to confirm nothing is broken.',
    ].join('\n');
  }

  generateTDDPrompt(cycles: TDDCycle[]): string {
    const lines = [
      '## TDD Implementation Plan',
      '',
      `Total cycles: ${cycles.length}`,
      '',
      'Execute each cycle in order. Do NOT skip ahead or implement multiple specs at once.',
      '',
    ];

    for (const cycle of cycles) {
      lines.push(`### Cycle ${cycle.order}`);
      lines.push('');
      lines.push(cycle.redPhase);
      lines.push('');
      lines.push(cycle.greenPhase);
      lines.push('');
      lines.push(cycle.refactorPhase);
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    return lines.join('\n');
  }

  generateProgressSummary(cycles: TDDCycle[], completedSpecIds: Set<string>): string {
    const completed = cycles.filter((c) => completedSpecIds.has(c.specId)).length;
    const total = cycles.length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

    const bar = '='.repeat(Math.floor(pct / 5)) + '-'.repeat(20 - Math.floor(pct / 5));

    return [
      `TDD Progress: [${bar}] ${pct}% (${completed}/${total} specs)`,
      '',
      ...cycles.map((c) => {
        const status = completedSpecIds.has(c.specId) ? '[PASS]' : '[    ]';
        return `  ${status} Cycle ${c.order}: ${c.specId}`;
      }),
    ].join('\n');
  }
}
