export class SfnError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'SfnError';
  }
}

export class AnalysisError extends SfnError {
  constructor(message: string) {
    super(message, 'ANALYSIS_ERROR');
    this.name = 'AnalysisError';
  }
}

export class DiscoveryError extends SfnError {
  constructor(message: string) {
    super(message, 'DISCOVERY_ERROR');
    this.name = 'DiscoveryError';
  }
}

export class PlanningError extends SfnError {
  constructor(message: string) {
    super(message, 'PLANNING_ERROR');
    this.name = 'PlanningError';
  }
}

export class ScaffoldingError extends SfnError {
  constructor(message: string) {
    super(message, 'SCAFFOLDING_ERROR');
    this.name = 'ScaffoldingError';
  }
}

export class MigrationError extends SfnError {
  constructor(message: string) {
    super(message, 'MIGRATION_ERROR');
    this.name = 'MigrationError';
  }
}

export class VerificationError extends SfnError {
  constructor(message: string) {
    super(message, 'VERIFICATION_ERROR');
    this.name = 'VerificationError';
  }
}

export class StateError extends SfnError {
  constructor(message: string) {
    super(message, 'STATE_ERROR');
    this.name = 'StateError';
  }
}

export class StrategyNotFoundError extends SfnError {
  constructor(strategyName: string) {
    super(`Strategy not found: ${strategyName}`, 'STRATEGY_NOT_FOUND');
    this.name = 'StrategyNotFoundError';
  }
}

export class PatternNotFoundError extends SfnError {
  constructor(patternName: string) {
    super(`Transitional pattern not found: ${patternName}`, 'PATTERN_NOT_FOUND');
    this.name = 'PatternNotFoundError';
  }
}

export class PreconditionFailedError extends SfnError {
  constructor(
    public readonly precondition: string,
    public readonly details: string
  ) {
    super(`Precondition failed: ${precondition} — ${details}`, 'PRECONDITION_FAILED');
    this.name = 'PreconditionFailedError';
  }
}
