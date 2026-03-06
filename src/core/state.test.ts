import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StateManager } from './state.js';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rmSync } from 'node:fs';
import type {
  MonolithProfile,
  ModernizationPlan,
  TransitionalDesign,
  MigrationPlan,
  ExtractionResult,
} from './types.js';
import type { SfnEvent } from './events.js';

function makeProfile(): MonolithProfile {
  return {
    id: 'profile-1',
    rootPath: '/app',
    name: 'TestApp',
    detectedLanguages: [],
    frameworks: [],
    entryPoints: [],
    chunks: [],
    entities: [],
    dataFlows: [],
    systemContext: { centralSystem: 'TestApp', upstreamFlows: [], downstreamFlows: [], datastores: [] },
    analyzedAt: '2026-01-01T00:00:00.000Z',
  };
}

function makeModPlan(id: string): ModernizationPlan {
  return {
    id,
    monolithProfileId: 'profile-1',
    selectedSlice: {
      id: 's1', name: 'Slice', description: '', type: 'product-line',
      chunkIds: [], entityIds: [], dataFlowIds: [],
      riskScore: 5, businessValueScore: 7, recommendedOrder: 1, rationale: '',
    },
    featureParityReport: {
      sliceId: 's1', totalFeatures: 10, confirmedNeeded: [], confirmedUnneeded: [],
      uncertain: [], deadCodePaths: [], legacyWorkarounds: [], reductionPercentage: 0,
    },
    status: 'draft',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function makeMigrationPlan(id: string): MigrationPlan {
  return {
    id,
    modernizationPlanId: 'mod-1',
    strategyName: 'strangler-fig',
    targetSlice: {
      id: 's1', name: 'Slice', description: '', type: 'product-line',
      chunkIds: [], entityIds: [], dataFlowIds: [],
      riskScore: 5, businessValueScore: 7, recommendedOrder: 1, rationale: '',
    },
    steps: [],
    status: 'draft',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('StateManager', () => {
  let stateDir: string;
  let mgr: StateManager;

  beforeEach(() => {
    stateDir = join(tmpdir(), `sfn-state-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mgr = new StateManager(stateDir);
  });

  afterEach(() => {
    try { rmSync(stateDir, { recursive: true }); } catch {}
  });

  describe('profile', () => {
    it('saves and loads a profile', () => {
      const profile = makeProfile();
      mgr.saveProfile(profile);
      expect(mgr.loadProfile()).toEqual(profile);
    });

    it('returns null for missing profile', () => {
      expect(mgr.loadProfile()).toBeNull();
    });
  });

  describe('modernization plans', () => {
    it('saves and loads a modernization plan', () => {
      const plan = makeModPlan('mod-1');
      mgr.saveModernizationPlan(plan);
      expect(mgr.loadModernizationPlan('mod-1')).toEqual(plan);
    });

    it('returns null for missing plan', () => {
      expect(mgr.loadModernizationPlan('nope')).toBeNull();
    });

    it('lists all modernization plans', () => {
      mgr.saveModernizationPlan(makeModPlan('mod-1'));
      mgr.saveModernizationPlan(makeModPlan('mod-2'));
      const plans = mgr.listModernizationPlans();
      expect(plans.map((p) => p.id).sort()).toEqual(['mod-1', 'mod-2']);
    });

    it('returns empty array when no plans exist', () => {
      expect(mgr.listModernizationPlans()).toEqual([]);
    });
  });

  describe('transitional design', () => {
    it('saves and loads a design', () => {
      const design: TransitionalDesign = {
        id: 'd1', planId: 'mod-1', seams: [],
        antiCorruptionLayers: [], temporaryInfrastructure: [],
        createdAt: '2026-01-01T00:00:00.000Z',
      };
      mgr.saveTransitionalDesign(design);
      expect(mgr.loadTransitionalDesign('d1')).toEqual(design);
    });
  });

  describe('migration plans', () => {
    it('saves and loads a migration plan', () => {
      const plan = makeMigrationPlan('mig-1');
      mgr.saveMigrationPlan(plan);
      expect(mgr.loadMigrationPlan('mig-1')).toEqual(plan);
    });

    it('lists migration plans', () => {
      mgr.saveMigrationPlan(makeMigrationPlan('mig-1'));
      mgr.saveMigrationPlan(makeMigrationPlan('mig-2'));
      expect(mgr.listMigrationPlans().map((p) => p.id).sort()).toEqual(['mig-1', 'mig-2']);
    });
  });

  describe('extraction results', () => {
    it('saves and loads extraction result', () => {
      const result: ExtractionResult = {
        stepId: 'step-1',
        success: true,
        filesCreated: ['a.ts'],
        filesModified: [],
        filesDeleted: [],
        verificationResults: [],
        timestamp: '2026-01-01T00:00:00.000Z',
      };
      mgr.saveExtractionResult(result);
      expect(mgr.loadExtractionResult('step-1')).toEqual(result);
    });
  });

  describe('event history', () => {
    it('saves and loads event history', () => {
      const events: SfnEvent[] = [
        { type: 'PlanApproved', timestamp: '2026-01-01T00:00:00.000Z', planId: 'x', sliceName: 'y' },
      ];
      mgr.saveEventHistory(events);
      expect(mgr.loadEventHistory()).toEqual(events);
    });

    it('returns empty array when no history exists', () => {
      expect(mgr.loadEventHistory()).toEqual([]);
    });
  });
});
