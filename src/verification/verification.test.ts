import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ParallelRunner } from './parallel-runner.js';
import { TrafficDiverter } from './traffic-diverter.js';
import { MonitoringGenerator } from './monitoring-generator.js';
import { RollbackManager } from './rollback-manager.js';
import { AuditTrail } from './audit-trail.js';
import { StateManager } from '../core/state.js';
import { EventBus } from '../core/events.js';
import { DEFAULT_CONFIG } from '../core/config.js';
import { MigrationError } from '../core/errors.js';
import type { MigrationPlan, MigrationStep, DivergenceReport, TrafficDiversionConfig, ParallelRunConfig } from '../core/types.js';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rmSync } from 'node:fs';

function makeStep(order: number, overrides: Partial<MigrationStep> = {}): MigrationStep {
  return {
    id: `step-${order}`, planId: 'plan-1', order,
    name: `Step ${order}`, description: '', type: 'implement', status: 'pending',
    preconditions: [], actions: [], verificationCriteria: [],
    rollbackProcedure: { description: `Rollback step ${order}`, steps: ['undo changes'], automated: false },
    ...overrides,
  };
}

function makePlan(steps: MigrationStep[]): MigrationPlan {
  return {
    id: 'plan-1', modernizationPlanId: 'mod-1', strategyName: 'strangler-fig',
    targetSlice: { id: 's1', name: 'Orders', description: '', type: 'product-line', chunkIds: [], entityIds: [], dataFlowIds: [], riskScore: 5, businessValueScore: 7, recommendedOrder: 1, rationale: '' },
    steps, status: 'in_progress',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

// =========== ParallelRunner ===========

describe('ParallelRunner', () => {
  let eventBus: EventBus;
  let runner: ParallelRunner;

  beforeEach(() => {
    eventBus = new EventBus();
    runner = new ParallelRunner(eventBus);
  });

  it('configure creates config with defaults', () => {
    const config = runner.configure('http://old:8080', 'http://new:8080');
    expect(config.oldEndpoint).toBe('http://old:8080');
    expect(config.newEndpoint).toBe('http://new:8080');
    expect(config.duration).toBe('24h');
    expect(config.sampleRate).toBe(1.0);
    expect(config.comparisonMode).toBe('semantic');
  });

  it('configure respects custom options', () => {
    const config = runner.configure('http://old', 'http://new', {
      duration: '1h',
      sampleRate: 0.5,
      comparisonMode: 'exact',
    });
    expect(config.duration).toBe('1h');
    expect(config.sampleRate).toBe(0.5);
    expect(config.comparisonMode).toBe('exact');
  });

  it('generateSetupPrompt includes endpoints and comparison rules', () => {
    const config = runner.configure('http://old', 'http://new');
    const prompt = runner.generateSetupPrompt(config);
    expect(prompt).toContain('http://old');
    expect(prompt).toContain('http://new');
    expect(prompt).toContain('semantic');
    expect(prompt).toContain('Safety');
  });

  it('generateSetupPrompt adapts to exact comparison mode', () => {
    const config = runner.configure('http://old', 'http://new', { comparisonMode: 'exact' });
    const prompt = runner.generateSetupPrompt(config);
    expect(prompt).toContain('byte-for-byte');
  });

  it('generateSetupPrompt adapts to status-code-only mode', () => {
    const config = runner.configure('http://old', 'http://new', { comparisonMode: 'status-code-only' });
    const prompt = runner.generateSetupPrompt(config);
    expect(prompt).toContain('status codes');
  });

  it('startParallelRun emits event', () => {
    const config = runner.configure('http://old', 'http://new');
    runner.startParallelRun(config, 'plan-1');
    const events = eventBus.history();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('ParallelRunStarted');
  });

  it('generateComparisonPrompt returns divergence instructions', () => {
    const config = runner.configure('http://old', 'http://new');
    const prompt = runner.generateComparisonPrompt(config);
    expect(prompt).toContain('Divergence Analysis');
    expect(prompt).toContain('divergence rate');
  });

  it('evaluateDivergence accepts zero divergence', () => {
    const report: DivergenceReport = {
      totalRequests: 1000, matchingResponses: 1000,
      divergentResponses: 0, divergenceRate: 0, divergences: [],
    };
    const result = runner.evaluateDivergence(report, 'plan-1');
    expect(result.acceptable).toBe(true);
    expect(result.message).toContain('zero');
  });

  it('evaluateDivergence accepts very low divergence', () => {
    const report: DivergenceReport = {
      totalRequests: 100000, matchingResponses: 99999,
      divergentResponses: 1, divergenceRate: 0.00001, divergences: [],
    };
    const result = runner.evaluateDivergence(report, 'plan-1');
    expect(result.acceptable).toBe(true);
  });

  it('evaluateDivergence rejects high divergence and emits event', () => {
    const report: DivergenceReport = {
      totalRequests: 100, matchingResponses: 90,
      divergentResponses: 10, divergenceRate: 0.1,
      divergences: [{ requestSummary: 'GET /orders', oldResponse: '200', newResponse: '500', category: 'error' }],
    };
    const result = runner.evaluateDivergence(report, 'plan-1');
    expect(result.acceptable).toBe(false);
    expect(result.message).toContain('exceeds');
    expect(eventBus.history()[0].type).toBe('DivergenceDetected');
  });
});

// =========== TrafficDiverter ===========

describe('TrafficDiverter', () => {
  const diverter = new TrafficDiverter(DEFAULT_CONFIG);

  it('generates diversion plan with correct number of stages', () => {
    const runConfig: ParallelRunConfig = {
      oldEndpoint: 'http://old', newEndpoint: 'http://new',
      duration: '24h', sampleRate: 1.0, comparisonMode: 'semantic',
    };
    const plan = diverter.generateDiversionPlan(runConfig);
    expect(plan.stages).toHaveLength(DEFAULT_CONFIG.trafficDiversionStages.length);
    expect(plan.stages.map((s) => s.percentage)).toEqual([1, 5, 25, 50, 100]);
    expect(plan.loadBalancerType).toBe('nginx');
  });

  it('early stages have tighter thresholds', () => {
    const runConfig: ParallelRunConfig = {
      oldEndpoint: 'http://old', newEndpoint: 'http://new',
      duration: '24h', sampleRate: 1.0, comparisonMode: 'semantic',
    };
    const plan = diverter.generateDiversionPlan(runConfig);
    const first = plan.stages[0].rollbackThreshold;
    const last = plan.stages[plan.stages.length - 1].rollbackThreshold;
    expect(first.errorRate).toBeLessThan(last.errorRate);
    expect(first.latencyP99Ms).toBeLessThan(last.latencyP99Ms);
  });

  it('generates nginx config snippet', () => {
    const runConfig: ParallelRunConfig = {
      oldEndpoint: 'old:8080', newEndpoint: 'new:8080',
      duration: '24h', sampleRate: 1.0, comparisonMode: 'semantic',
    };
    const plan = diverter.generateDiversionPlan(runConfig, 'nginx');
    expect(plan.configSnippet).toContain('upstream backend');
    expect(plan.configSnippet).toContain('old:8080');
    expect(plan.configSnippet).toContain('new:8080');
  });

  it('generates envoy config snippet', () => {
    const runConfig: ParallelRunConfig = {
      oldEndpoint: 'old:8080', newEndpoint: 'new:8080',
      duration: '24h', sampleRate: 1.0, comparisonMode: 'semantic',
    };
    const plan = diverter.generateDiversionPlan(runConfig, 'envoy');
    expect(plan.configSnippet).toContain('weighted_clusters');
  });

  it('generates AWS ALB config snippet', () => {
    const runConfig: ParallelRunConfig = {
      oldEndpoint: 'old', newEndpoint: 'new',
      duration: '24h', sampleRate: 1.0, comparisonMode: 'semantic',
    };
    const plan = diverter.generateDiversionPlan(runConfig, 'aws-alb');
    expect(plan.configSnippet).toContain('elbv2');
  });

  it('generates custom config snippet', () => {
    const runConfig: ParallelRunConfig = {
      oldEndpoint: 'old', newEndpoint: 'new',
      duration: '24h', sampleRate: 1.0, comparisonMode: 'semantic',
    };
    const plan = diverter.generateDiversionPlan(runConfig, 'custom');
    expect(plan.configSnippet).toContain('Generic');
  });

  it('renderDiversionPlan includes stages and config', () => {
    const runConfig: ParallelRunConfig = {
      oldEndpoint: 'old', newEndpoint: 'new',
      duration: '24h', sampleRate: 1.0, comparisonMode: 'semantic',
    };
    const plan = diverter.generateDiversionPlan(runConfig);
    const rendered = diverter.renderDiversionPlan(plan);
    expect(rendered).toContain('Traffic Diversion Plan');
    expect(rendered).toContain('1%');
    expect(rendered).toContain('100%');
    expect(rendered).toContain('Configuration Snippet');
  });
});

// =========== MonitoringGenerator ===========

describe('MonitoringGenerator', () => {
  const gen = new MonitoringGenerator();

  function makeDiversionConfig(): TrafficDiversionConfig {
    return {
      stages: [
        { percentage: 5, duration: '1h', rollbackThreshold: { errorRate: 0.001, latencyP99Ms: 500 } },
        { percentage: 100, duration: '24h', rollbackThreshold: { errorRate: 0.01, latencyP99Ms: 2000 } },
      ],
      loadBalancerType: 'nginx',
      configSnippet: '',
    };
  }

  it('generates monitoring config with health checks', () => {
    const config = gen.generate('order-service', makeDiversionConfig());
    expect(config.serviceName).toBe('order-service');
    expect(config.platform).toBe('prometheus');
    expect(config.healthChecks).toHaveLength(2);
    expect(config.healthChecks[0].endpoint).toBe('/health');
  });

  it('generates alerts based on diversion thresholds', () => {
    const config = gen.generate('order-service', makeDiversionConfig());
    expect(config.alerts.length).toBeGreaterThanOrEqual(3);
    expect(config.alerts.some((a) => a.severity === 'critical')).toBe(true);
    expect(config.alerts.some((a) => a.name.includes('order-service'))).toBe(true);
  });

  it('generates SLO targets', () => {
    const config = gen.generate('order-service', makeDiversionConfig());
    expect(config.sloTargets.length).toBe(3);
    expect(config.sloTargets.some((s) => s.metric === 'availability')).toBe(true);
  });

  it('generates Prometheus config snippet', () => {
    const config = gen.generate('svc', makeDiversionConfig(), 'prometheus');
    expect(config.configSnippet).toContain('Prometheus');
    expect(config.configSnippet).toContain('svc');
  });

  it('generates Datadog config snippet', () => {
    const config = gen.generate('svc', makeDiversionConfig(), 'datadog');
    expect(config.configSnippet).toContain('Datadog');
  });

  it('generates CloudWatch config snippet', () => {
    const config = gen.generate('svc', makeDiversionConfig(), 'cloudwatch');
    expect(config.configSnippet).toContain('CloudWatch');
  });

  it('generates custom platform config snippet', () => {
    const config = gen.generate('svc', makeDiversionConfig(), 'custom');
    expect(config.configSnippet).toContain('Custom monitoring');
  });

  it('renderMonitoringSetup formats all sections', () => {
    const config = gen.generate('order-service', makeDiversionConfig());
    const rendered = gen.renderMonitoringSetup(config);
    expect(rendered).toContain('Monitoring Setup');
    expect(rendered).toContain('Health Checks');
    expect(rendered).toContain('Alerts');
    expect(rendered).toContain('SLO Targets');
    expect(rendered).toContain('Configuration');
  });
});

// =========== RollbackManager ===========

describe('RollbackManager', () => {
  let stateDir: string;
  let stateManager: StateManager;
  let eventBus: EventBus;
  let manager: RollbackManager;

  beforeEach(() => {
    stateDir = join(tmpdir(), `sfn-rollback-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    stateManager = new StateManager(stateDir);
    eventBus = new EventBus();
    manager = new RollbackManager(stateManager, eventBus);
  });

  afterEach(() => {
    try { rmSync(stateDir, { recursive: true }); } catch {}
  });

  it('canRollback returns false for all-pending plan', () => {
    const plan = makePlan([makeStep(1), makeStep(2)]);
    expect(manager.canRollback(plan)).toBe(false);
  });

  it('canRollback returns true when steps have been completed', () => {
    const plan = makePlan([
      makeStep(1, { status: 'completed' }),
      makeStep(2, { status: 'in_progress' }),
    ]);
    expect(manager.canRollback(plan)).toBe(true);
  });

  it('getLastCompletedStep returns highest-order completed step', () => {
    const plan = makePlan([
      makeStep(1, { status: 'completed' }),
      makeStep(2, { status: 'completed' }),
      makeStep(3, { status: 'in_progress' }),
    ]);
    expect(manager.getLastCompletedStep(plan)?.order).toBe(2);
  });

  it('getLastCompletedStep returns null for no completed steps', () => {
    const plan = makePlan([makeStep(1)]);
    expect(manager.getLastCompletedStep(plan)).toBeNull();
  });

  it('getRollbackSequence returns steps in reverse order', () => {
    const plan = makePlan([
      makeStep(1, { status: 'completed' }),
      makeStep(2, { status: 'completed' }),
      makeStep(3, { status: 'failed' }),
    ]);
    const seq = manager.getRollbackSequence(plan);
    expect(seq.map((s) => s.order)).toEqual([3, 2, 1]);
  });

  it('getRollbackSequence excludes pending steps', () => {
    const plan = makePlan([
      makeStep(1, { status: 'completed' }),
      makeStep(2),
    ]);
    const seq = manager.getRollbackSequence(plan);
    expect(seq).toHaveLength(1);
  });

  it('rollbackStep sets status and emits event', () => {
    const plan = makePlan([makeStep(1, { status: 'completed' })]);
    const updated = manager.rollbackStep(plan, 'step-1', 'tests failing');

    expect(updated.steps[0].status).toBe('rolled_back');
    expect(updated.status).toBe('rolled_back');

    const events = eventBus.history();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('RollbackInitiated');
  });

  it('rollbackStep throws for unknown step', () => {
    const plan = makePlan([makeStep(1)]);
    expect(() => manager.rollbackStep(plan, 'nope', 'reason')).toThrow(MigrationError);
  });

  it('generateRollbackPrompt includes step instructions', () => {
    const plan = makePlan([
      makeStep(1, { status: 'completed' }),
      makeStep(2, { status: 'failed' }),
    ]);
    const prompt = manager.generateRollbackPrompt(plan);
    expect(prompt).toContain('Rollback Plan');
    expect(prompt).toContain('undo changes');
    expect(prompt).toContain('2 step(s)');
  });

  it('generateRollbackPrompt handles no steps', () => {
    const plan = makePlan([makeStep(1)]);
    const prompt = manager.generateRollbackPrompt(plan);
    expect(prompt).toContain('No steps to roll back');
  });
});

// =========== AuditTrail ===========

describe('AuditTrail', () => {
  let stateDir: string;
  let trail: AuditTrail;

  beforeEach(() => {
    stateDir = join(tmpdir(), `sfn-audit-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    trail = new AuditTrail(new StateManager(stateDir));
  });

  afterEach(() => {
    try { rmSync(stateDir, { recursive: true }); } catch {}
  });

  it('records entries with auto-generated timestamp', () => {
    trail.record({
      planId: 'plan-1', action: 'create file',
      filesAffected: ['new.ts'], description: 'Created new service file',
    });
    const entries = trail.getAllEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].timestamp).toBeDefined();
    expect(entries[0].action).toBe('create file');
  });

  it('getTrail filters by planId', () => {
    trail.record({ planId: 'plan-1', action: 'create', filesAffected: [], description: 'a' });
    trail.record({ planId: 'plan-2', action: 'modify', filesAffected: [], description: 'b' });
    trail.record({ planId: 'plan-1', action: 'delete', filesAffected: [], description: 'c' });

    const entries = trail.getTrail('plan-1');
    expect(entries).toHaveLength(2);
  });

  it('generateReport formats entries', () => {
    trail.record({
      planId: 'plan-1', stepId: 'step-1', action: 'create file',
      filesAffected: ['svc.ts'], description: 'Created service',
      diff: '+export class Service {}',
    });
    const report = trail.generateReport('plan-1');
    expect(report).toContain('Audit Trail');
    expect(report).toContain('create file');
    expect(report).toContain('svc.ts');
    expect(report).toContain('+export class Service {}');
  });

  it('generateReport handles no entries', () => {
    const report = trail.generateReport('plan-1');
    expect(report).toContain('No audit entries');
  });

  it('generateSummaryStats counts actions', () => {
    trail.record({ planId: 'p1', action: 'create file', filesAffected: ['a.ts'], description: '' });
    trail.record({ planId: 'p1', action: 'modify file', filesAffected: ['b.ts'], description: '' });
    trail.record({ planId: 'p1', action: 'edit code', filesAffected: ['c.ts'], description: '' });
    trail.record({ planId: 'p1', action: 'delete file', filesAffected: ['d.ts'], description: '' });
    trail.record({ planId: 'p2', action: 'create file', filesAffected: ['e.ts'], description: '' });

    const stats = trail.generateSummaryStats('p1');
    expect(stats.totalActions).toBe(4);
    expect(stats.filesCreated).toBe(1);
    expect(stats.filesModified).toBe(2); // modify + edit
    expect(stats.filesDeleted).toBe(1);
  });
});
