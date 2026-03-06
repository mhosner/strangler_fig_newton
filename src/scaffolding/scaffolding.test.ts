import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PatternRegistry, registerBuiltinPatterns, eventInterceptionPattern, legacyMimicPattern, revertToSourcePattern } from './patterns/index.js';
import { PatternRecommender } from './pattern-recommender.js';
import { SeamDesigner } from './seam-designer.js';
import { StateManager } from '../core/state.js';
import { EventBus } from '../core/events.js';
import type { SliceCandidate, MonolithProfile } from '../core/types.js';
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

function makeProfile(overrides: Partial<MonolithProfile> = {}): MonolithProfile {
  return {
    id: 'p1', rootPath: '/app', name: 'TestApp',
    detectedLanguages: [], frameworks: [],
    entryPoints: [{ filePath: 'ctrl.ts', type: 'http-controller', description: 'api' }],
    chunks: [{ id: 'c1', path: '/app/orders', name: 'orders', fileCount: 50, estimatedComplexity: 'medium', description: '', language: 'node' }],
    entities: [
      { id: 'e1', entityName: 'orders', entityType: 'table', sourceFile: '', relatedEntities: [], callers: ['api'], callees: ['payments'] },
    ],
    dataFlows: [
      { id: 'f1', name: 'API', direction: 'upstream', protocol: 'HTTP', sourceSystem: 'Client', targetSystem: 'TestApp', dataDescription: '' },
    ],
    systemContext: { centralSystem: 'TestApp', upstreamFlows: [], downstreamFlows: [], datastores: [] },
    analyzedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// =========== PatternRegistry ===========

describe('PatternRegistry', () => {
  it('registers and retrieves patterns', () => {
    const registry = new PatternRegistry();
    registry.register(eventInterceptionPattern);
    expect(registry.get('event-interception')).toBe(eventInterceptionPattern);
  });

  it('returns undefined for unknown pattern', () => {
    const registry = new PatternRegistry();
    expect(registry.get('unknown')).toBeUndefined();
  });

  it('unregisters patterns', () => {
    const registry = new PatternRegistry();
    registry.register(eventInterceptionPattern);
    registry.unregister('event-interception');
    expect(registry.get('event-interception')).toBeUndefined();
  });

  it('getAll returns all registered patterns', () => {
    const registry = new PatternRegistry();
    registerBuiltinPatterns(registry);
    const all = registry.getAll();
    expect(all).toHaveLength(3);
    expect(all.map((p) => p.name).sort()).toEqual(['event-interception', 'legacy-mimic', 'revert-to-source']);
  });
});

// =========== Event Interception Pattern ===========

describe('eventInterceptionPattern', () => {
  it('is applicable when slice has event entities', () => {
    const profile = makeProfile({
      entities: [
        { id: 'e1', entityName: 'order_events', entityType: 'topic', sourceFile: '', relatedEntities: [], callers: [], callees: [] },
      ],
    });
    const slice = makeSlice({ entityIds: ['e1'] });
    const result = eventInterceptionPattern.isApplicable(slice, profile);
    expect(result.applicable).toBe(true);
  });

  it('is applicable when profile has event handlers', () => {
    const profile = makeProfile({
      entryPoints: [{ filePath: 'handler.ts', type: 'event-handler', description: '' }],
      entities: [],
    });
    const slice = makeSlice({ entityIds: [] });
    const result = eventInterceptionPattern.isApplicable(slice, profile);
    expect(result.applicable).toBe(true);
  });

  it('is not applicable when no event patterns', () => {
    const profile = makeProfile({
      entities: [{ id: 'e1', entityName: 'orders', entityType: 'table', sourceFile: '', relatedEntities: [], callers: [], callees: [] }],
      entryPoints: [{ filePath: 'ctrl.ts', type: 'http-controller', description: '' }],
      dataFlows: [],
    });
    const slice = makeSlice({ entityIds: ['e1'], dataFlowIds: [] });
    const result = eventInterceptionPattern.isApplicable(slice, profile);
    expect(result.applicable).toBe(false);
  });

  it('designs seam with event bridge integration points', () => {
    const profile = makeProfile({
      entities: [
        { id: 'e1', entityName: 'order_events', entityType: 'topic', sourceFile: '', relatedEntities: [], callers: [], callees: [] },
      ],
    });
    const seam = eventInterceptionPattern.designSeam(makeSlice({ entityIds: ['e1'] }), profile);
    expect(seam.patternName).toBe('event-interception');
    expect(seam.integrationPoints.length).toBeGreaterThan(0);
    expect(seam.integrationPoints[0].type).toBe('event-bridge');
  });

  it('lists temporary artifacts', () => {
    const artifacts = eventInterceptionPattern.getTemporaryArtifacts();
    expect(artifacts.length).toBeGreaterThan(0);
  });
});

// =========== Legacy Mimic Pattern ===========

describe('legacyMimicPattern', () => {
  it('is applicable with HTTP entry points and external callers', () => {
    const result = legacyMimicPattern.isApplicable(makeSlice(), makeProfile());
    expect(result.applicable).toBe(true);
  });

  it('is not applicable without HTTP entry points', () => {
    const profile = makeProfile({
      entryPoints: [{ filePath: 'job.ts', type: 'scheduled', description: '' }],
      entities: [],
    });
    const result = legacyMimicPattern.isApplicable(makeSlice({ entityIds: [] }), profile);
    expect(result.applicable).toBe(false);
  });

  it('designs seam with ACL integration points', () => {
    const seam = legacyMimicPattern.designSeam(makeSlice(), makeProfile());
    expect(seam.patternName).toBe('legacy-mimic');
    expect(seam.integrationPoints.some((ip) => ip.type === 'anti-corruption-layer')).toBe(true);
  });
});

// =========== Revert to Source Pattern ===========

describe('revertToSourcePattern', () => {
  it('is applicable for low-complexity pass-through slices', () => {
    const profile = makeProfile({
      chunks: [{ id: 'c1', path: '', name: 'proxy', fileCount: 5, estimatedComplexity: 'low', description: '', language: 'node' }],
      dataFlows: [
        { id: 'f1', name: 'In', direction: 'upstream', protocol: 'HTTP', sourceSystem: 'A', targetSystem: 'App', dataDescription: '' },
        { id: 'f2', name: 'Out', direction: 'downstream', protocol: 'HTTP', sourceSystem: 'App', targetSystem: 'B', dataDescription: '' },
      ],
    });
    const slice = makeSlice({ chunkIds: ['c1'], entityIds: ['e1'], dataFlowIds: ['f1', 'f2'] });
    // Need few entities (<=3)
    const result = revertToSourcePattern.isApplicable(slice, profile);
    expect(result.applicable).toBe(true);
  });

  it('is not applicable without both upstream and downstream flows', () => {
    const profile = makeProfile({
      dataFlows: [{ id: 'f1', name: 'In', direction: 'upstream', protocol: 'HTTP', sourceSystem: 'A', targetSystem: 'App', dataDescription: '' }],
    });
    const slice = makeSlice({ dataFlowIds: ['f1'] });
    const result = revertToSourcePattern.isApplicable(slice, profile);
    expect(result.applicable).toBe(false);
  });
});

// =========== PatternRecommender ===========

describe('PatternRecommender', () => {
  let registry: PatternRegistry;
  let recommender: PatternRecommender;

  beforeEach(() => {
    registry = new PatternRegistry();
    registerBuiltinPatterns(registry);
    recommender = new PatternRecommender(registry);
  });

  it('recommends applicable patterns sorted by priority', () => {
    const recs = recommender.recommend(makeSlice(), makeProfile());
    expect(recs.length).toBeGreaterThan(0);
    // Should be sorted ascending by priority
    for (let i = 1; i < recs.length; i++) {
      expect(recs[i].priority).toBeGreaterThanOrEqual(recs[i - 1].priority);
    }
  });

  it('renderRecommendations includes pattern info', () => {
    const recs = recommender.recommend(makeSlice(), makeProfile());
    const rendered = recommender.renderRecommendations(recs);
    expect(rendered).toContain('Recommended Transitional Patterns');
  });

  it('renderRecommendations handles empty list', () => {
    const rendered = recommender.renderRecommendations([]);
    expect(rendered).toContain('No applicable transitional patterns');
  });
});

// =========== SeamDesigner ===========

describe('SeamDesigner', () => {
  let stateDir: string;
  let designer: SeamDesigner;
  let eventBus: EventBus;

  beforeEach(() => {
    stateDir = join(tmpdir(), `sfn-seam-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    eventBus = new EventBus();
    designer = new SeamDesigner(new StateManager(stateDir), eventBus);
  });

  afterEach(() => {
    try { rmSync(stateDir, { recursive: true }); } catch {}
  });

  it('creates transitional design and emits event', () => {
    const design = designer.designSeams('plan-1', makeSlice(), makeProfile(), [legacyMimicPattern]);
    expect(design.planId).toBe('plan-1');
    expect(design.seams).toHaveLength(1);
    expect(design.id).toBeDefined();

    const events = eventBus.history();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('ScaffoldingDesigned');
  });

  it('includes ACL for legacy mimic pattern', () => {
    const design = designer.designSeams('plan-1', makeSlice(), makeProfile(), [legacyMimicPattern]);
    expect(design.antiCorruptionLayers.length).toBeGreaterThan(0);
  });

  it('renders design summary', () => {
    const design = designer.designSeams('plan-1', makeSlice(), makeProfile(), [eventInterceptionPattern]);
    const summary = designer.renderDesignSummary(design);
    expect(summary).toContain('Transitional Architecture Design');
    expect(summary).toContain('Seams');
  });
});
