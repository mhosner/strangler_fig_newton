import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StrategyRegistry } from './strategy-registry.js';
import { ReverseEngineer } from './reverse-engineer.js';
import { SpecGenerator } from './spec-generator.js';
import { ForwardEngineer } from './forward-engineer.js';
import { WorkflowOrchestrator } from './workflow-orchestrator.js';
import { PlanGenerator } from './plan-generator.js';
import { ProgressTracker } from './progress-tracker.js';
import { registerBuiltinStrategies } from './strategies/index.js';
import { stranglerFigStrategy } from './strategies/strangler-fig.js';
import { StateManager } from '../core/state.js';
import { EventBus } from '../core/events.js';
import { StrategyNotFoundError, PreconditionFailedError, MigrationError } from '../core/errors.js';
import type {
  SliceCandidate,
  MonolithProfile,
  MigrationPlan,
  MigrationStep,
  BusinessRule,
  ExecutableSpec,
  ExtractionResult,
} from '../core/types.js';
import { generateId } from '../core/utils.js';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rmSync } from 'node:fs';

function makeSlice(overrides: Partial<SliceCandidate> = {}): SliceCandidate {
  return {
    id: 's1', name: 'Orders', description: 'Order processing',
    type: 'product-line', chunkIds: ['c1'], entityIds: ['e1'], dataFlowIds: ['f1'],
    riskScore: 5, businessValueScore: 7, recommendedOrder: 1, rationale: '',
    ...overrides,
  };
}

function makeProfile(): MonolithProfile {
  return {
    id: 'p1', rootPath: '/app', name: 'TestApp',
    detectedLanguages: [], frameworks: [],
    entryPoints: [{ filePath: 'main.ts', type: 'main', description: 'entry' }],
    chunks: [{ id: 'c1', path: '/app/orders', name: 'orders', fileCount: 50, estimatedComplexity: 'medium', description: '', language: 'node' }],
    entities: [{ id: 'e1', entityName: 'orders', entityType: 'table', sourceFile: '', relatedEntities: [], callers: [], callees: [] }],
    dataFlows: [],
    systemContext: { centralSystem: 'TestApp', upstreamFlows: [], downstreamFlows: [], datastores: [] },
    analyzedAt: '2026-01-01T00:00:00.000Z',
  };
}

function makeStep(order: number, overrides: Partial<MigrationStep> = {}): MigrationStep {
  return {
    id: `step-${order}`,
    planId: 'plan-1',
    order,
    name: `Step ${order}`,
    description: '',
    type: 'implement',
    status: 'pending',
    preconditions: [],
    actions: [],
    verificationCriteria: [],
    rollbackProcedure: { description: '', steps: [], automated: false },
    ...overrides,
  };
}

function makeMigrationPlan(steps: MigrationStep[]): MigrationPlan {
  return {
    id: 'plan-1',
    modernizationPlanId: 'mod-1',
    strategyName: 'strangler-fig',
    targetSlice: makeSlice(),
    steps,
    status: 'draft',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

// =========== StrategyRegistry ===========

describe('StrategyRegistry', () => {
  it('registers and retrieves strategies', () => {
    const registry = new StrategyRegistry();
    registry.register(stranglerFigStrategy);
    expect(registry.get('strangler-fig')).toBe(stranglerFigStrategy);
  });

  it('throws StrategyNotFoundError for missing strategy', () => {
    const registry = new StrategyRegistry();
    expect(() => registry.get('nope')).toThrow(StrategyNotFoundError);
  });

  it('unregisters strategies', () => {
    const registry = new StrategyRegistry();
    registry.register(stranglerFigStrategy);
    registry.unregister('strangler-fig');
    expect(() => registry.get('strangler-fig')).toThrow();
  });

  it('getAll returns all strategies', () => {
    const registry = new StrategyRegistry();
    registerBuiltinStrategies(registry);
    const all = registry.getAll();
    expect(all.length).toBe(4);
  });

  it('findApplicable filters by isApplicable', () => {
    const registry = new StrategyRegistry();
    registerBuiltinStrategies(registry);
    const applicable = registry.findApplicable(makeSlice(), makeProfile());
    // Strangler fig is always applicable
    expect(applicable.some((s) => s.name === 'strangler-fig')).toBe(true);
  });
});

// =========== Strategies ===========

describe('stranglerFigStrategy', () => {
  it('is always applicable', () => {
    expect(stranglerFigStrategy.isApplicable(makeSlice(), makeProfile())).toBe(true);
  });

  it('generates 7 ordered steps', () => {
    const steps = stranglerFigStrategy.generateSteps(makeSlice(), makeProfile());
    expect(steps).toHaveLength(7);
    expect(steps[0].order).toBe(1);
    expect(steps[6].order).toBe(7);
    expect(steps.every((s) => s.status === 'pending')).toBe(true);
  });

  it('has global preconditions', () => {
    const pre = stranglerFigStrategy.getGlobalPreconditions();
    expect(pre.length).toBeGreaterThan(0);
    expect(pre.every((p) => p.met === false)).toBe(true);
  });
});

// =========== ReverseEngineer ===========

describe('ReverseEngineer', () => {
  const re = new ReverseEngineer();

  it('generates analysis prompt with chunk info', () => {
    const prompt = re.generateAnalysisPrompt({
      id: 'c1', path: '/app/orders', name: 'orders',
      fileCount: 50, estimatedComplexity: 'high', description: '', language: 'java',
    });
    expect(prompt).toContain('/app/orders');
    expect(prompt).toContain('java');
    expect(prompt).toContain('Business Rules');
  });

  it('structureResults adds IDs and chunkId', () => {
    const raw = [
      { name: 'calc-total', description: 'Calc total', inputs: ['items'], outputs: ['total'], constraints: [], sourceFiles: ['Order.java'] },
    ];
    const result = re.structureResults('c1', raw);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBeDefined();
    expect(result[0].sourceChunkId).toBe('c1');
    expect(result[0].name).toBe('calc-total');
  });

  it('generates boilerplate report', () => {
    const report = re.generateBoilerplateReport({
      id: 'c1', path: '/app', name: 'orders',
      fileCount: 50, estimatedComplexity: 'high', description: '', language: 'java',
    });
    expect(report).toContain('Boilerplate Analysis');
    expect(report).toContain('orders');
  });
});

// =========== SpecGenerator ===========

describe('SpecGenerator', () => {
  const gen = new SpecGenerator();

  const rules: BusinessRule[] = [
    { id: 'r1', name: 'calc-total', description: 'Calculate order total', inputs: ['items: OrderItem[]'], outputs: ['total: number'], constraints: ['total >= 0'], sourceChunkId: 'c1', sourceFiles: ['Order.java'] },
  ];

  it('generates spec prompt from business rules', () => {
    const prompt = gen.generateSpecPrompt(rules);
    expect(prompt).toContain('calc-total');
    expect(prompt).toContain('items: OrderItem[]');
    expect(prompt).toContain('Happy path');
    expect(prompt).toContain('Edge case');
  });

  it('structureResults adds IDs', () => {
    const raw: Array<Omit<ExecutableSpec, 'id'>> = [
      { businessRuleId: 'r1', testName: 'test_total', description: 'Tests total', inputFixture: '[]', expectedOutput: '0', assertionType: 'exact' },
    ];
    const result = gen.structureResults(raw);
    expect(result[0].id).toBeDefined();
    expect(result[0].testName).toBe('test_total');
  });

  it('generates spec summary grouped by rule', () => {
    const specs: ExecutableSpec[] = [
      { id: 'sp1', businessRuleId: 'r1', testName: 'test_empty', description: 'Empty list', inputFixture: '[]', expectedOutput: '0', assertionType: 'exact' },
      { id: 'sp2', businessRuleId: 'r1', testName: 'test_one', description: 'One item', inputFixture: '[item]', expectedOutput: '10', assertionType: 'exact' },
    ];
    const summary = gen.generateSpecSummary(specs, rules);
    expect(summary).toContain('calc-total');
    expect(summary).toContain('2 specs');
    expect(summary).toContain('test_empty');
  });
});

// =========== ForwardEngineer ===========

describe('ForwardEngineer', () => {
  const fe = new ForwardEngineer();

  const specs: ExecutableSpec[] = [
    { id: 'sp1', businessRuleId: 'r1', testName: 'test_empty', description: 'Empty', inputFixture: '[]', expectedOutput: '0', assertionType: 'exact' },
    { id: 'sp2', businessRuleId: 'r1', testName: 'test_one', description: 'One item', inputFixture: '[x]', expectedOutput: '10', assertionType: 'exact' },
    { id: 'sp3', businessRuleId: 'r1', testName: 'test_many', description: 'Many items', inputFixture: '[x,y]', expectedOutput: '20', assertionType: 'equivalent' },
  ];

  it('generates TDD cycles for each spec', () => {
    const cycles = fe.generateTDDPlan(specs);
    expect(cycles).toHaveLength(3);
    expect(cycles[0].order).toBe(1);
    expect(cycles[0].specId).toBe('sp1');
    expect(cycles[2].order).toBe(3);
  });

  it('red phase contains test name and fixtures', () => {
    const cycles = fe.generateTDDPlan(specs);
    expect(cycles[0].redPhase).toContain('test_empty');
    expect(cycles[0].redPhase).toContain('[]');
    expect(cycles[0].redPhase).toContain('MUST fail');
  });

  it('green phase instructs simplest implementation', () => {
    const cycles = fe.generateTDDPlan(specs);
    expect(cycles[0].greenPhase).toContain('SIMPLEST');
  });

  it('refactor phase is minimal for first 2 cycles', () => {
    const cycles = fe.generateTDDPlan(specs);
    expect(cycles[0].refactorPhase).toContain('premature');
    expect(cycles[1].refactorPhase).toContain('premature');
    expect(cycles[2].refactorPhase).toContain('REFACTOR');
  });

  it('generateTDDPrompt formats all cycles', () => {
    const cycles = fe.generateTDDPlan(specs);
    const prompt = fe.generateTDDPrompt(cycles);
    expect(prompt).toContain('TDD Implementation Plan');
    expect(prompt).toContain('Cycle 1');
    expect(prompt).toContain('Cycle 3');
  });

  it('generateProgressSummary shows completion', () => {
    const cycles = fe.generateTDDPlan(specs);
    const completed = new Set(['sp1', 'sp2']);
    const summary = fe.generateProgressSummary(cycles, completed);
    expect(summary).toContain('67%');
    expect(summary).toContain('2/3');
    expect(summary).toContain('[PASS]');
    expect(summary).toContain('[    ]');
  });
});

// =========== WorkflowOrchestrator ===========

describe('WorkflowOrchestrator', () => {
  let stateDir: string;
  let stateManager: StateManager;
  let eventBus: EventBus;
  let orchestrator: WorkflowOrchestrator;

  beforeEach(() => {
    stateDir = join(tmpdir(), `sfn-orch-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    stateManager = new StateManager(stateDir);
    eventBus = new EventBus();
    orchestrator = new WorkflowOrchestrator(stateManager, eventBus);
  });

  afterEach(() => {
    try { rmSync(stateDir, { recursive: true }); } catch {}
  });

  it('canProceed returns ok for first step with no preconditions', () => {
    const plan = makeMigrationPlan([makeStep(1)]);
    const result = orchestrator.canProceed(plan, 'step-1');
    expect(result.ok).toBe(true);
    expect(result.blockers).toEqual([]);
  });

  it('canProceed blocks when previous step incomplete', () => {
    const plan = makeMigrationPlan([makeStep(1), makeStep(2)]);
    const result = orchestrator.canProceed(plan, 'step-2');
    expect(result.ok).toBe(false);
    expect(result.blockers[0]).toContain('not completed');
  });

  it('canProceed blocks on unmet preconditions', () => {
    const step = makeStep(1, {
      preconditions: [{ description: 'Tests pass', check: 'run tests', met: false }],
    });
    const plan = makeMigrationPlan([step]);
    const result = orchestrator.canProceed(plan, 'step-1');
    expect(result.ok).toBe(false);
    expect(result.blockers[0]).toContain('Tests pass');
  });

  it('canProceed returns false for unknown step', () => {
    const plan = makeMigrationPlan([makeStep(1)]);
    const result = orchestrator.canProceed(plan, 'nope');
    expect(result.ok).toBe(false);
  });

  it('startStep transitions status and emits event', () => {
    const plan = makeMigrationPlan([makeStep(1)]);
    const updated = orchestrator.startStep(plan, 'step-1');

    expect(updated.steps[0].status).toBe('in_progress');
    expect(updated.steps[0].startedAt).toBeDefined();
    expect(updated.status).toBe('in_progress');

    const events = eventBus.history();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('MigrationStepStarted');
  });

  it('startStep throws when preconditions not met', () => {
    const plan = makeMigrationPlan([makeStep(1), makeStep(2)]);
    expect(() => orchestrator.startStep(plan, 'step-2')).toThrow(PreconditionFailedError);
  });

  it('completeStep transitions status and saves result', () => {
    const plan = makeMigrationPlan([makeStep(1, { status: 'in_progress' })]);
    const result: ExtractionResult = {
      stepId: 'step-1', success: true,
      filesCreated: ['a.ts'], filesModified: [], filesDeleted: [],
      verificationResults: [], timestamp: '2026-01-01T00:00:00.000Z',
    };

    const updated = orchestrator.completeStep(plan, 'step-1', result);
    expect(updated.steps[0].status).toBe('completed');
    expect(updated.steps[0].completedAt).toBeDefined();

    const events = eventBus.history();
    expect(events[0].type).toBe('MigrationStepCompleted');
  });

  it('completeStep marks plan as completed when all steps done', () => {
    const plan = makeMigrationPlan([makeStep(1, { status: 'in_progress' })]);
    const result: ExtractionResult = {
      stepId: 'step-1', success: true,
      filesCreated: [], filesModified: [], filesDeleted: [],
      verificationResults: [], timestamp: '2026-01-01T00:00:00.000Z',
    };

    const updated = orchestrator.completeStep(plan, 'step-1', result);
    expect(updated.status).toBe('completed');
  });

  it('failStep marks step as failed', () => {
    const plan = makeMigrationPlan([makeStep(1, { status: 'in_progress' })]);
    const updated = orchestrator.failStep(plan, 'step-1', 'compilation error');
    expect(updated.steps[0].status).toBe('failed');
    expect(updated.steps[0].error).toBe('compilation error');
  });

  it('failStep throws for unknown step', () => {
    const plan = makeMigrationPlan([makeStep(1)]);
    expect(() => orchestrator.failStep(plan, 'nope', 'err')).toThrow(MigrationError);
  });

  it('getNextStep returns first pending step', () => {
    const plan = makeMigrationPlan([
      makeStep(1, { status: 'completed' }),
      makeStep(2),
      makeStep(3),
    ]);
    expect(orchestrator.getNextStep(plan)?.id).toBe('step-2');
  });

  it('getNextStep returns null when all completed', () => {
    const plan = makeMigrationPlan([makeStep(1, { status: 'completed' })]);
    expect(orchestrator.getNextStep(plan)).toBeNull();
  });
});

// =========== PlanGenerator ===========

describe('PlanGenerator', () => {
  let stateDir: string;
  let generator: PlanGenerator;

  beforeEach(() => {
    stateDir = join(tmpdir(), `sfn-plangen-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const registry = new StrategyRegistry();
    registerBuiltinStrategies(registry);
    generator = new PlanGenerator(registry, new StateManager(stateDir));
  });

  afterEach(() => {
    try { rmSync(stateDir, { recursive: true }); } catch {}
  });

  it('generates a plan with steps from strategy', () => {
    const plan = generator.generate('mod-1', makeSlice(), 'strangler-fig', makeProfile());
    expect(plan.strategyName).toBe('strangler-fig');
    expect(plan.status).toBe('draft');
    expect(plan.steps.length).toBe(7);
    expect(plan.steps.every((s) => s.planId === plan.id)).toBe(true);
  });

  it('throws for unknown strategy', () => {
    expect(() =>
      generator.generate('mod-1', makeSlice(), 'nope', makeProfile()),
    ).toThrow(StrategyNotFoundError);
  });

  it('renderPlanPreview includes strategy and steps', () => {
    const plan = generator.generate('mod-1', makeSlice(), 'strangler-fig', makeProfile());
    const preview = generator.renderPlanPreview(plan);
    expect(preview).toContain('strangler-fig');
    expect(preview).toContain('Orders');
    expect(preview).toContain('Steps');
  });
});

// =========== ProgressTracker ===========

describe('ProgressTracker', () => {
  let stateDir: string;
  let stateManager: StateManager;
  let tracker: ProgressTracker;

  beforeEach(() => {
    stateDir = join(tmpdir(), `sfn-progress-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    stateManager = new StateManager(stateDir);
    tracker = new ProgressTracker(stateManager);
  });

  afterEach(() => {
    try { rmSync(stateDir, { recursive: true }); } catch {}
  });

  it('returns null for unknown plan', () => {
    expect(tracker.getSummary('nope')).toBeNull();
  });

  it('builds summary from saved plan', () => {
    const plan = makeMigrationPlan([
      makeStep(1, { status: 'completed' }),
      makeStep(2, { status: 'in_progress' }),
      makeStep(3),
    ]);
    stateManager.saveMigrationPlan(plan);

    const summary = tracker.getSummary('plan-1');
    expect(summary).not.toBeNull();
    expect(summary!.totalSteps).toBe(3);
    expect(summary!.completedSteps).toBe(1);
    expect(summary!.percentComplete).toBe(33);
    expect(summary!.currentStep?.id).toBe('step-2');
  });

  it('identifies blockers from failed steps', () => {
    const plan = makeMigrationPlan([
      makeStep(1, { status: 'failed', error: 'build failed' }),
    ]);
    stateManager.saveMigrationPlan(plan);

    const summary = tracker.getSummary('plan-1')!;
    expect(summary.blockers.length).toBeGreaterThan(0);
    expect(summary.blockers[0]).toContain('build failed');
  });

  it('identifies blockers from unmet preconditions', () => {
    const plan = makeMigrationPlan([
      makeStep(1, {
        preconditions: [{ description: 'DB ready', check: '', met: false }],
      }),
    ]);
    stateManager.saveMigrationPlan(plan);

    const summary = tracker.getSummary('plan-1')!;
    expect(summary.blockers.some((b) => b.includes('DB ready'))).toBe(true);
  });

  it('getAllSummaries lists all plans', () => {
    stateManager.saveMigrationPlan(makeMigrationPlan([makeStep(1)]));
    const summaries = tracker.getAllSummaries();
    expect(summaries).toHaveLength(1);
  });

  it('renderDashboard formats summaries', () => {
    stateManager.saveMigrationPlan(makeMigrationPlan([
      makeStep(1, { status: 'completed' }),
      makeStep(2),
    ]));
    const summaries = tracker.getAllSummaries();
    const dashboard = tracker.renderDashboard(summaries);
    expect(dashboard).toContain('Migration Dashboard');
    expect(dashboard).toContain('50%');
  });

  it('renderDashboard handles empty list', () => {
    expect(tracker.renderDashboard([])).toBe('No active migration plans.');
  });

  it('getTimeline filters events by planId', () => {
    stateManager.saveEventHistory([
      { type: 'MigrationStepStarted', timestamp: '2026-01-01T00:00:00.000Z', planId: 'plan-1', stepId: 'step-1', stepName: 'Step 1' },
      { type: 'PlanApproved', timestamp: '2026-01-01T00:00:00.000Z', planId: 'plan-2', sliceName: 'Other' },
    ]);

    const timeline = tracker.getTimeline('plan-1');
    expect(timeline).toHaveLength(1);
    expect(timeline[0].eventType).toBe('MigrationStepStarted');
    expect(timeline[0].description).toContain('Step 1');
  });
});
