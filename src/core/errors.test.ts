import { describe, it, expect } from 'vitest';
import {
  SfnError,
  AnalysisError,
  DiscoveryError,
  PlanningError,
  ScaffoldingError,
  MigrationError,
  VerificationError,
  StateError,
  StrategyNotFoundError,
  PatternNotFoundError,
  PreconditionFailedError,
} from './errors.js';

describe('SfnError', () => {
  it('stores message and code', () => {
    const err = new SfnError('something broke', 'TEST_CODE');
    expect(err.message).toBe('something broke');
    expect(err.code).toBe('TEST_CODE');
    expect(err.name).toBe('SfnError');
    expect(err).toBeInstanceOf(Error);
  });
});

describe('domain-specific errors', () => {
  const cases: Array<[string, new (msg: string) => SfnError, string]> = [
    ['AnalysisError', AnalysisError, 'ANALYSIS_ERROR'],
    ['DiscoveryError', DiscoveryError, 'DISCOVERY_ERROR'],
    ['PlanningError', PlanningError, 'PLANNING_ERROR'],
    ['ScaffoldingError', ScaffoldingError, 'SCAFFOLDING_ERROR'],
    ['MigrationError', MigrationError, 'MIGRATION_ERROR'],
    ['VerificationError', VerificationError, 'VERIFICATION_ERROR'],
    ['StateError', StateError, 'STATE_ERROR'],
  ];

  it.each(cases)('%s has correct name and code', (name, ErrorClass, code) => {
    const err = new ErrorClass('test message');
    expect(err.name).toBe(name);
    expect(err.code).toBe(code);
    expect(err.message).toBe('test message');
    expect(err).toBeInstanceOf(SfnError);
    expect(err).toBeInstanceOf(Error);
  });
});

describe('StrategyNotFoundError', () => {
  it('includes strategy name in message', () => {
    const err = new StrategyNotFoundError('my-strategy');
    expect(err.message).toBe('Strategy not found: my-strategy');
    expect(err.code).toBe('STRATEGY_NOT_FOUND');
    expect(err.name).toBe('StrategyNotFoundError');
  });
});

describe('PatternNotFoundError', () => {
  it('includes pattern name in message', () => {
    const err = new PatternNotFoundError('my-pattern');
    expect(err.message).toBe('Transitional pattern not found: my-pattern');
    expect(err.code).toBe('PATTERN_NOT_FOUND');
    expect(err.name).toBe('PatternNotFoundError');
  });
});

describe('PreconditionFailedError', () => {
  it('includes precondition and details', () => {
    const err = new PreconditionFailedError('tests must pass', 'suite failed');
    expect(err.message).toBe('Precondition failed: tests must pass — suite failed');
    expect(err.code).toBe('PRECONDITION_FAILED');
    expect(err.precondition).toBe('tests must pass');
    expect(err.details).toBe('suite failed');
  });
});
