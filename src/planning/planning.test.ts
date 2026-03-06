import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProductLineExtractor } from './product-line-extractor.js';
import { ValueStreamExtractor } from './value-stream-extractor.js';
import { FeatureParityChecker } from './feature-parity-checker.js';
import { SliceRanker } from './slice-ranker.js';
import { ModernizationPlanGenerator } from './modernization-plan.js';
import { StateManager } from '../core/state.js';
import { EventBus } from '../core/events.js';
import type {
  MonolithProfile,
  SliceCandidate,
  FeatureParityReport,
  CodeChunk,
  ProductLine,
  ValueStream,
} from '../core/types.js';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rmSync } from 'node:fs';

function makeProfile(overrides: Partial<MonolithProfile> = {}): MonolithProfile {
  return {
    id: 'p1', rootPath: '/app', name: 'TestApp',
    detectedLanguages: [], frameworks: [],
    entryPoints: [{ filePath: 'main.ts', type: 'main', description: 'entry' }],
    chunks: [
      { id: 'c1', path: '/app/orders', name: 'orders', fileCount: 50, estimatedComplexity: 'medium', description: '', language: 'node' },
      { id: 'c2', path: '/app/payments', name: 'payments', fileCount: 30, estimatedComplexity: 'medium', description: '', language: 'node' },
    ],
    entities: [
      { id: 'e1', entityName: 'orders', entityType: 'table', sourceFile: '', relatedEntities: ['payments'], callers: ['api'], callees: ['payments'] },
    ],
    dataFlows: [
      { id: 'f1', name: 'API', direction: 'upstream', protocol: 'HTTP', sourceSystem: 'Client', targetSystem: 'TestApp', dataDescription: '' },
    ],
    systemContext: { centralSystem: 'TestApp', upstreamFlows: [], downstreamFlows: [], datastores: [] },
    analyzedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeSlice(overrides: Partial<SliceCandidate> = {}): SliceCandidate {
  return {
    id: 's1', name: 'Orders', description: 'Order processing',
    type: 'product-line', chunkIds: ['c1'], entityIds: ['e1'], dataFlowIds: ['f1'],
    riskScore: 5, businessValueScore: 7, recommendedOrder: 1, rationale: '',
    ...overrides,
  };
}

// =========== ProductLineExtractor ===========

describe('ProductLineExtractor', () => {
  const extractor = new ProductLineExtractor();

  it('generates prompt containing chunk info and entry points', () => {
    const prompt = extractor.generateExtractionPrompt(makeProfile());
    expect(prompt).toContain('orders');
    expect(prompt).toContain('payments');
    expect(prompt).toContain('main.ts');
    expect(prompt).toContain('product line');
  });

  it('structureResults adds IDs', () => {
    const raw: Array<Omit<ProductLine, 'id'>> = [
      { name: 'Orders', description: '', chunkIds: ['c1'], entryPoints: [], estimatedUserCount: 'company-wide' },
    ];
    const result = extractor.structureResults(raw);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBeDefined();
    expect(result[0].name).toBe('Orders');
  });

  it('createProductLine builds a complete product line', () => {
    const chunks: CodeChunk[] = [
      { id: 'c1', path: '', name: 'orders', fileCount: 10, estimatedComplexity: 'low', description: '', language: 'node' },
    ];
    const pl = extractor.createProductLine('Orders', 'desc', chunks, []);
    expect(pl.name).toBe('Orders');
    expect(pl.chunkIds).toEqual(['c1']);
    expect(pl.estimatedUserCount).toBe('company-wide');
    expect(pl.id).toBeDefined();
  });
});

// =========== ValueStreamExtractor ===========

describe('ValueStreamExtractor', () => {
  const extractor = new ValueStreamExtractor();

  it('generates prompt with entities and flows', () => {
    const prompt = extractor.generateExtractionPrompt(makeProfile());
    expect(prompt).toContain('orders');
    expect(prompt).toContain('API');
    expect(prompt).toContain('value stream');
  });

  it('structureResults adds IDs', () => {
    const raw: Array<Omit<ValueStream, 'id'>> = [
      { name: 'Order Fulfillment', description: '', steps: ['step1'], chunkIds: ['c1'], businessValue: 'high' },
    ];
    const result = extractor.structureResults(raw);
    expect(result[0].id).toBeDefined();
    expect(result[0].name).toBe('Order Fulfillment');
  });

  it('createValueStream builds a complete value stream', () => {
    const vs = extractor.createValueStream('Checkout', 'desc', ['s1', 's2'], ['c1'], 'critical');
    expect(vs.name).toBe('Checkout');
    expect(vs.steps).toEqual(['s1', 's2']);
    expect(vs.businessValue).toBe('critical');
  });
});

// =========== FeatureParityChecker ===========

describe('FeatureParityChecker', () => {
  const checker = new FeatureParityChecker();

  it('generates check prompt with slice info', () => {
    const prompt = checker.generateCheckPrompt(makeProfile(), makeSlice());
    expect(prompt).toContain('FEATURE PARITY TRAP CHECK');
    expect(prompt).toContain('Orders');
    expect(prompt).toContain('orders');
  });

  it('calculates reduction percentage', () => {
    const report = {
      totalFeatures: 20,
      confirmedNeeded: ['a', 'b'],
      confirmedUnneeded: ['c', 'd', 'e'],
      uncertain: ['f'],
      deadCodePaths: ['g', 'h'],
      legacyWorkarounds: ['i'],
    };
    // removable = 3 + 2 + 1 = 6, 6/20 = 30%
    expect(checker.calculateReduction(report)).toBe(30);
  });

  it('returns 0 for zero total features', () => {
    const report = {
      totalFeatures: 0,
      confirmedNeeded: [],
      confirmedUnneeded: [],
      uncertain: [],
      deadCodePaths: [],
      legacyWorkarounds: [],
    };
    expect(checker.calculateReduction(report)).toBe(0);
  });

  it('structureReport includes calculated reduction', () => {
    const raw = {
      totalFeatures: 10,
      confirmedNeeded: ['a'],
      confirmedUnneeded: ['b', 'c'],
      uncertain: [],
      deadCodePaths: ['d'],
      legacyWorkarounds: [],
    };
    const report = checker.structureReport('s1', raw);
    expect(report.sliceId).toBe('s1');
    expect(report.reductionPercentage).toBe(30);
  });

  it('generates user validation questions', () => {
    const report: FeatureParityReport = {
      sliceId: 's1', totalFeatures: 5,
      confirmedNeeded: [], confirmedUnneeded: [],
      uncertain: ['Feature X', 'Feature Y'],
      deadCodePaths: [], legacyWorkarounds: [], reductionPercentage: 0,
    };
    const questions = checker.generateUserValidationQuestions(report);
    expect(questions).toHaveLength(2);
    expect(questions[0]).toContain('Feature X');
    expect(questions[1]).toContain('Feature Y');
  });
});

// =========== SliceRanker ===========

describe('SliceRanker', () => {
  const ranker = new SliceRanker();

  it('returns empty array for no candidates', () => {
    expect(ranker.rank([])).toEqual([]);
  });

  it('ranks candidates by composite score', () => {
    const candidates: SliceCandidate[] = [
      makeSlice({ id: 'low', name: 'Low', riskScore: 1, businessValueScore: 2 }),
      makeSlice({ id: 'mid', name: 'Mid', riskScore: 5, businessValueScore: 7 }),
      makeSlice({ id: 'high', name: 'High', riskScore: 9, businessValueScore: 9 }),
    ];

    const ranked = ranker.rank(candidates);
    expect(ranked).toHaveLength(3);
    expect(ranked[0].recommendedOrder).toBe(1);
    expect(ranked[1].recommendedOrder).toBe(2);
    expect(ranked[2].recommendedOrder).toBe(3);
    // The moderate-risk, high-value candidate should rank highest
    expect(ranked[0].name).toBe('Mid');
  });

  it('assigns rationale to each candidate', () => {
    const candidates = [
      makeSlice({ riskScore: 5, businessValueScore: 7 }),
      makeSlice({ id: 's2', name: 'S2', riskScore: 9, businessValueScore: 3 }),
    ];
    const ranked = ranker.rank(candidates);
    expect(ranked[0].rationale).toContain('RECOMMENDED FIRST EXTRACTION');
  });

  it('flags high risk candidates', () => {
    const candidates = [
      makeSlice({ id: 's1', riskScore: 9, businessValueScore: 8 }),
      makeSlice({ id: 's2', riskScore: 5, businessValueScore: 7 }),
    ];
    const ranked = ranker.rank(candidates);
    const highRisk = ranked.find((c) => c.riskScore === 9);
    if (highRisk && highRisk.recommendedOrder !== 1) {
      expect(highRisk.rationale).toContain('High risk');
    }
  });

  it('generateRankingSummary formats output', () => {
    const candidates = [makeSlice()];
    const ranked = ranker.rank(candidates);
    const summary = ranker.generateRankingSummary(ranked);
    expect(summary).toContain('Slice Extraction Order');
    expect(summary).toContain('Orders');
  });

  it('generateRankingSummary handles empty list', () => {
    expect(ranker.generateRankingSummary([])).toBe('No slice candidates identified.');
  });
});

// =========== ModernizationPlanGenerator ===========

describe('ModernizationPlanGenerator', () => {
  let stateDir: string;
  let stateManager: StateManager;
  let eventBus: EventBus;
  let generator: ModernizationPlanGenerator;

  beforeEach(() => {
    stateDir = join(tmpdir(), `sfn-modplan-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    stateManager = new StateManager(stateDir);
    eventBus = new EventBus();
    generator = new ModernizationPlanGenerator(stateManager, eventBus);
  });

  it('generates a draft plan', () => {
    const slice = makeSlice();
    const report: FeatureParityReport = {
      sliceId: 's1', totalFeatures: 10,
      confirmedNeeded: ['a'], confirmedUnneeded: ['b'],
      uncertain: [], deadCodePaths: [], legacyWorkarounds: [],
      reductionPercentage: 10,
    };

    const plan = generator.generate('p1', slice, report);
    expect(plan.status).toBe('draft');
    expect(plan.monolithProfileId).toBe('p1');
    expect(plan.selectedSlice).toEqual(slice);
    expect(plan.featureParityReport).toEqual(report);
    expect(plan.id).toBeDefined();

    // Persisted
    const loaded = stateManager.loadModernizationPlan(plan.id);
    expect(loaded).toEqual(plan);
  });

  it('approve transitions status and emits event', () => {
    const slice = makeSlice();
    const report: FeatureParityReport = {
      sliceId: 's1', totalFeatures: 5,
      confirmedNeeded: [], confirmedUnneeded: [],
      uncertain: [], deadCodePaths: [], legacyWorkarounds: [],
      reductionPercentage: 0,
    };

    const draft = generator.generate('p1', slice, report);
    const approved = generator.approve(draft);

    expect(approved.status).toBe('approved');
    const events = eventBus.history();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('PlanApproved');
  });

  it('renderPlanSummary includes key information', () => {
    const slice = makeSlice();
    const report: FeatureParityReport = {
      sliceId: 's1', totalFeatures: 20,
      confirmedNeeded: Array(10).fill('x'), confirmedUnneeded: Array(5).fill('y'),
      uncertain: ['z'], deadCodePaths: ['d1', 'd2'], legacyWorkarounds: ['w1'],
      reductionPercentage: 40,
    };

    const plan = generator.generate('p1', slice, report);
    const summary = generator.renderPlanSummary(plan);

    expect(summary).toContain('Orders');
    expect(summary).toContain('draft');
    expect(summary).toContain('40%');
    expect(summary).toContain('Scope reduction');
  });

  afterEach(() => {
    try { rmSync(stateDir, { recursive: true }); } catch {}
  });
});
