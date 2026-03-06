// Core
export * from './core/types.js';
export * from './core/events.js';
export * from './core/errors.js';
export * from './core/config.js';
export { StateManager } from './core/state.js';
export { generateId, isoNow, readJsonFile, writeJsonFile, ensureDir } from './core/utils.js';

// Discovery (Phase 1)
export {
  CodebaseChunker,
  EntityExtractor,
  DataFlowTracer,
  ALL_PROFILES,
  detectLanguages,
  detectAllFrameworks,
  detectAllEntryPoints,
  type LanguageProfile,
} from './discovery/index.js';

// Planning (Phase 2)
export {
  ProductLineExtractor,
  ValueStreamExtractor,
  FeatureParityChecker,
  SliceRanker,
  ModernizationPlanGenerator,
} from './planning/index.js';

// Scaffolding (Phase 3)
export {
  PatternRecommender,
  SeamDesigner,
  PatternRegistry,
  registerBuiltinPatterns,
  type TransitionalPattern,
} from './scaffolding/index.js';

// Migration (Phase 4)
export {
  type MigrationStrategy,
  StrategyRegistry,
  registerBuiltinStrategies,
  ReverseEngineer,
  SpecGenerator,
  ForwardEngineer,
  WorkflowOrchestrator,
  ProgressTracker,
  PlanGenerator,
} from './migration/index.js';

// Verification (Phase 5)
export {
  ParallelRunner,
  TrafficDiverter,
  MonitoringGenerator,
  RollbackManager,
  AuditTrail,
} from './verification/index.js';
