// ============================================================
// Discovery Domain (Phase 1)
// ============================================================

export type SupportedLanguage = 'java' | 'node' | 'python' | 'dotnet';

export interface LanguageDetection {
  language: SupportedLanguage;
  confidence: number;
  indicators: string[];
}

export interface FrameworkDetection {
  framework: string;
  version?: string;
  indicators: string[];
}

export interface EntryPoint {
  filePath: string;
  type: 'http-controller' | 'cli' | 'event-handler' | 'scheduled' | 'main';
  description: string;
}

export interface CodeChunk {
  id: string;
  path: string;
  name: string;
  fileCount: number;
  estimatedComplexity: 'low' | 'medium' | 'high';
  description: string;
  language: SupportedLanguage;
}

export interface EntityRelationship {
  id: string;
  entityName: string;
  entityType: 'table' | 'collection' | 'segment' | 'transaction' | 'procedure' | 'queue' | 'topic';
  sourceFile: string;
  relatedEntities: string[];
  callers: string[];
  callees: string[];
}

export interface DataFlow {
  id: string;
  name: string;
  direction: 'upstream' | 'downstream' | 'bidirectional';
  protocol: string;
  sourceSystem: string;
  targetSystem: string;
  dataDescription: string;
}

export interface SystemContextDiagram {
  centralSystem: string;
  upstreamFlows: DataFlow[];
  downstreamFlows: DataFlow[];
  datastores: EntityRelationship[];
}

export interface MonolithProfile {
  id: string;
  rootPath: string;
  name: string;
  detectedLanguages: LanguageDetection[];
  frameworks: FrameworkDetection[];
  entryPoints: EntryPoint[];
  chunks: CodeChunk[];
  entities: EntityRelationship[];
  dataFlows: DataFlow[];
  systemContext: SystemContextDiagram;
  analyzedAt: string;
}

// ============================================================
// Planning Domain (Phase 2)
// ============================================================

export interface ProductLine {
  id: string;
  name: string;
  description: string;
  chunkIds: string[];
  entryPoints: EntryPoint[];
  estimatedUserCount: string;
}

export interface ValueStream {
  id: string;
  name: string;
  description: string;
  steps: string[];
  chunkIds: string[];
  businessValue: 'low' | 'medium' | 'high' | 'critical';
}

export interface SliceCandidate {
  id: string;
  name: string;
  description: string;
  type: 'product-line' | 'value-stream';
  chunkIds: string[];
  entityIds: string[];
  dataFlowIds: string[];
  riskScore: number;
  businessValueScore: number;
  recommendedOrder: number;
  rationale: string;
}

export interface FeatureParityReport {
  sliceId: string;
  totalFeatures: number;
  confirmedNeeded: string[];
  confirmedUnneeded: string[];
  uncertain: string[];
  deadCodePaths: string[];
  legacyWorkarounds: string[];
  reductionPercentage: number;
}

export interface ModernizationPlan {
  id: string;
  monolithProfileId: string;
  selectedSlice: SliceCandidate;
  featureParityReport: FeatureParityReport;
  status: 'draft' | 'approved' | 'in_progress' | 'completed' | 'abandoned';
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Scaffolding Domain (Phase 3)
// ============================================================

export interface SeamDefinition {
  id: string;
  name: string;
  description: string;
  patternName: string;
  integrationPoints: IntegrationPoint[];
  temporaryArtifacts: string[];
}

export interface IntegrationPoint {
  id: string;
  name: string;
  type: 'api-gateway' | 'event-bridge' | 'anti-corruption-layer' | 'shared-database' | 'direct-source';
  monolithSide: string;
  serviceSide: string;
  protocol: string;
  description: string;
}

export interface MimicSpec {
  type: 'service-providing' | 'service-consuming';
  legacyInterface: string;
  newImplementation: string;
  translationRules: string[];
}

export interface AntiCorruptionLayer {
  name: string;
  mimics: MimicSpec[];
  boundaryDescription: string;
}

export interface TransitionalDesign {
  id: string;
  planId: string;
  seams: SeamDefinition[];
  antiCorruptionLayers: AntiCorruptionLayer[];
  temporaryInfrastructure: string[];
  createdAt: string;
}

// ============================================================
// Migration Domain (Phase 4)
// ============================================================

export interface BusinessRule {
  id: string;
  name: string;
  description: string;
  inputs: string[];
  outputs: string[];
  constraints: string[];
  sourceChunkId: string;
  sourceFiles: string[];
}

export interface ExecutableSpec {
  id: string;
  businessRuleId: string;
  testName: string;
  description: string;
  inputFixture: string;
  expectedOutput: string;
  assertionType: 'exact' | 'equivalent' | 'within-tolerance';
}

export interface TDDCycle {
  order: number;
  specId: string;
  redPhase: string;
  greenPhase: string;
  refactorPhase: string;
}

export interface Precondition {
  description: string;
  check: string;
  met: boolean;
}

export interface StepAction {
  description: string;
  instruction: string;
  completed: boolean;
}

export interface VerificationCriterion {
  description: string;
  instruction: string;
  passed?: boolean;
  evidence?: string;
}

export interface RollbackProcedure {
  description: string;
  steps: string[];
  automated: boolean;
}

export interface MigrationStep {
  id: string;
  planId: string;
  order: number;
  name: string;
  description: string;
  type: 'prepare' | 'abstract' | 'implement' | 'verify' | 'cutover' | 'cleanup';
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'rolled_back';
  preconditions: Precondition[];
  actions: StepAction[];
  verificationCriteria: VerificationCriterion[];
  rollbackProcedure: RollbackProcedure;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface MigrationPlan {
  id: string;
  modernizationPlanId: string;
  strategyName: string;
  targetSlice: SliceCandidate;
  steps: MigrationStep[];
  status: 'draft' | 'approved' | 'in_progress' | 'completed' | 'rolled_back';
  createdAt: string;
  updatedAt: string;
}

export interface ExtractionResult {
  stepId: string;
  success: boolean;
  filesCreated: string[];
  filesModified: string[];
  filesDeleted: string[];
  verificationResults: VerificationCriterion[];
  timestamp: string;
}

// ============================================================
// Verification Domain (Phase 5)
// ============================================================

export interface ParallelRunConfig {
  oldEndpoint: string;
  newEndpoint: string;
  duration: string;
  sampleRate: number;
  comparisonMode: 'exact' | 'semantic' | 'status-code-only';
}

export interface DivergenceReport {
  totalRequests: number;
  matchingResponses: number;
  divergentResponses: number;
  divergenceRate: number;
  divergences: Array<{
    requestSummary: string;
    oldResponse: string;
    newResponse: string;
    category: 'data-mismatch' | 'error' | 'timing' | 'missing-field';
  }>;
}

export interface TrafficDiversionConfig {
  stages: Array<{
    percentage: number;
    duration: string;
    rollbackThreshold: { errorRate: number; latencyP99Ms: number };
  }>;
  loadBalancerType: 'nginx' | 'envoy' | 'aws-alb' | 'custom';
  configSnippet: string;
}

export interface MonitoringConfig {
  serviceName: string;
  platform: 'prometheus' | 'datadog' | 'cloudwatch' | 'custom';
  healthChecks: Array<{ endpoint: string; interval: string; timeout: string }>;
  alerts: Array<{ name: string; condition: string; severity: 'info' | 'warning' | 'critical' }>;
  sloTargets: Array<{ metric: string; target: number; window: string }>;
  configSnippet: string;
}

// ============================================================
// Shared
// ============================================================

export interface CheckResult {
  passed: boolean;
  message: string;
  instruction: string;
}

export interface ProgressSummary {
  planId: string;
  strategyName: string;
  totalSteps: number;
  completedSteps: number;
  currentStep: MigrationStep | null;
  percentComplete: number;
  blockers: string[];
}

export interface AuditEntry {
  timestamp: string;
  planId: string;
  stepId?: string;
  action: string;
  filesAffected: string[];
  description: string;
  diff?: string;
}

export interface TimelineEntry {
  timestamp: string;
  eventType: string;
  description: string;
  metadata?: Record<string, unknown>;
}
