import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StateManager } from '../../src/core/state.js';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rmSync } from 'node:fs';
import type {
  MonolithProfile,
  ModernizationPlan,
  MigrationPlan,
} from '../../src/core/types.js';

describe('State persistence — round-trip fidelity', () => {
  let stateDir: string;
  let mgr: StateManager;

  beforeEach(() => {
    stateDir = join(tmpdir(), `sfn-roundtrip-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mgr = new StateManager(stateDir);
  });

  afterEach(() => {
    try { rmSync(stateDir, { recursive: true }); } catch {}
  });

  it('round-trips a fully populated MonolithProfile', () => {
    const profile: MonolithProfile = {
      id: 'profile-full',
      rootPath: '/app/monolith',
      name: 'FullApp',
      detectedLanguages: [
        { language: 'java', confidence: 0.9, indicators: ['pom.xml found', 'src/main/java present'] },
        { language: 'node', confidence: 0.3, indicators: ['package.json in subdir'] },
      ],
      frameworks: [
        { framework: 'spring-boot', version: '3.2.1', indicators: ['application.yml found'] },
        { framework: 'react', indicators: ['package.json contains react'] },
      ],
      entryPoints: [
        { filePath: 'src/main/java/App.java', type: 'main', description: '@SpringBootApplication entry' },
        { filePath: 'src/main/java/OrderController.java', type: 'http-controller', description: '@RestController' },
        { filePath: 'src/main/java/EventListener.java', type: 'event-handler', description: '@KafkaListener' },
      ],
      chunks: [
        { id: 'chunk-1', path: '/app/api', name: 'api', fileCount: 45, estimatedComplexity: 'medium', description: 'API module', language: 'java' },
        { id: 'chunk-2', path: '/app/core', name: 'core', fileCount: 120, estimatedComplexity: 'high', description: 'Core business logic', language: 'java' },
        { id: 'chunk-3', path: '/app/web', name: 'web', fileCount: 8, estimatedComplexity: 'low', description: 'Web frontend', language: 'node' },
      ],
      entities: [
        { id: 'ent-1', entityName: 'orders', entityType: 'table', sourceFile: 'Order.java', relatedEntities: ['customers', 'payments'], callers: ['api', 'core'], callees: ['payments'] },
        { id: 'ent-2', entityName: 'order_events', entityType: 'topic', sourceFile: 'EventConfig.java', relatedEntities: [], callers: ['core'], callees: ['notifications'] },
      ],
      dataFlows: [
        { id: 'df-1', name: 'Stripe API', direction: 'downstream', protocol: 'HTTP', sourceSystem: 'FullApp', targetSystem: 'Stripe', dataDescription: 'Payment charges and refunds' },
        { id: 'df-2', name: 'Kafka Events', direction: 'bidirectional', protocol: 'Kafka', sourceSystem: 'FullApp', targetSystem: 'EventBus', dataDescription: 'Domain events' },
      ],
      systemContext: {
        centralSystem: 'FullApp',
        upstreamFlows: [
          { id: 'df-2', name: 'Kafka Events', direction: 'bidirectional', protocol: 'Kafka', sourceSystem: 'FullApp', targetSystem: 'EventBus', dataDescription: 'Domain events' },
        ],
        downstreamFlows: [
          { id: 'df-1', name: 'Stripe API', direction: 'downstream', protocol: 'HTTP', sourceSystem: 'FullApp', targetSystem: 'Stripe', dataDescription: 'Payment charges and refunds' },
          { id: 'df-2', name: 'Kafka Events', direction: 'bidirectional', protocol: 'Kafka', sourceSystem: 'FullApp', targetSystem: 'EventBus', dataDescription: 'Domain events' },
        ],
        datastores: [
          { id: 'ent-1', entityName: 'orders', entityType: 'table', sourceFile: 'Order.java', relatedEntities: ['customers', 'payments'], callers: ['api', 'core'], callees: ['payments'] },
        ],
      },
      analyzedAt: '2026-03-06T12:00:00.000Z',
    };

    mgr.saveProfile(profile);
    const loaded = mgr.loadProfile();
    expect(loaded).toEqual(profile);
  });

  it('round-trips a complete ModernizationPlan', () => {
    const plan: ModernizationPlan = {
      id: 'mod-full',
      monolithProfileId: 'profile-full',
      selectedSlice: {
        id: 'slice-1',
        name: 'Order Processing',
        description: 'Extract order management to a microservice',
        type: 'value-stream',
        chunkIds: ['chunk-1', 'chunk-2'],
        entityIds: ['ent-1', 'ent-2'],
        dataFlowIds: ['df-1', 'df-2'],
        riskScore: 6,
        businessValueScore: 9,
        recommendedOrder: 1,
        rationale: 'RECOMMENDED FIRST EXTRACTION: moderate risk with high business value',
      },
      featureParityReport: {
        sliceId: 'slice-1',
        totalFeatures: 25,
        confirmedNeeded: ['create order', 'update order', 'cancel order', 'list orders'],
        confirmedUnneeded: ['legacy CSV export', 'deprecated v1 API', 'old admin panel'],
        uncertain: ['batch import', 'custom reporting'],
        deadCodePaths: ['OrderV1Controller.java', 'LegacyOrderMapper.java'],
        legacyWorkarounds: ['dual-write sync', 'polling-based cache invalidation'],
        reductionPercentage: 28,
      },
      status: 'approved',
      createdAt: '2026-03-06T10:00:00.000Z',
      updatedAt: '2026-03-06T11:00:00.000Z',
    };

    mgr.saveModernizationPlan(plan);
    const loaded = mgr.loadModernizationPlan('mod-full');
    expect(loaded).toEqual(plan);
  });

  it('round-trips a MigrationPlan with populated steps', () => {
    const plan: MigrationPlan = {
      id: 'mig-full',
      modernizationPlanId: 'mod-full',
      strategyName: 'strangler-fig',
      targetSlice: {
        id: 'slice-1', name: 'Orders', description: 'Order processing',
        type: 'product-line', chunkIds: ['c1'], entityIds: ['e1'], dataFlowIds: ['f1'],
        riskScore: 5, businessValueScore: 8, recommendedOrder: 1, rationale: 'First slice',
      },
      steps: [
        {
          id: 'step-1',
          planId: 'mig-full',
          order: 1,
          name: 'Extract Order Interface',
          description: 'Define the service boundary',
          type: 'abstract',
          status: 'completed',
          preconditions: [
            { description: 'Monolith builds', check: 'npm run build', met: true },
            { description: 'Tests pass', check: 'npm test', met: true },
          ],
          actions: [
            { description: 'Create interface', instruction: 'Extract IOrderService interface', completed: true },
            { description: 'Add adapter', instruction: 'Implement MonolithOrderAdapter', completed: true },
          ],
          verificationCriteria: [
            { description: 'Interface compiles', instruction: 'Run type check', passed: true, evidence: 'tsc passed with 0 errors' },
          ],
          rollbackProcedure: {
            description: 'Revert interface extraction',
            steps: ['git revert HEAD', 'npm run build'],
            automated: true,
          },
          startedAt: '2026-03-06T09:00:00.000Z',
          completedAt: '2026-03-06T09:30:00.000Z',
        },
        {
          id: 'step-2',
          planId: 'mig-full',
          order: 2,
          name: 'Implement New Service',
          description: 'TDD forward-engineer the new service',
          type: 'implement',
          status: 'in_progress',
          preconditions: [
            { description: 'Interface defined', check: 'file exists: IOrderService.ts', met: true },
          ],
          actions: [
            { description: 'Write failing tests', instruction: 'Create spec from business rules', completed: true },
            { description: 'Implement service', instruction: 'Make tests pass', completed: false },
          ],
          verificationCriteria: [
            { description: 'All specs pass', instruction: 'Run test suite', passed: undefined, evidence: undefined },
          ],
          rollbackProcedure: {
            description: 'Remove new service',
            steps: ['rm -rf services/orders/', 'npm run build'],
            automated: false,
          },
          startedAt: '2026-03-06T10:00:00.000Z',
        },
      ],
      status: 'in_progress',
      createdAt: '2026-03-06T08:00:00.000Z',
      updatedAt: '2026-03-06T10:00:00.000Z',
    };

    mgr.saveMigrationPlan(plan);
    const loaded = mgr.loadMigrationPlan('mig-full');
    expect(loaded).toEqual(plan);
  });

  it('handles special characters in string fields', () => {
    const profile: MonolithProfile = {
      id: 'special-chars',
      rootPath: '/app/path with spaces/and "quotes"',
      name: 'App with émojis & spëcial chars <>\n\ttabs',
      detectedLanguages: [
        { language: 'node', confidence: 0.8, indicators: ['line1\nline2\ttabbed', 'unicode: \u00e9\u00f1\u00fc\u2603'] },
      ],
      frameworks: [{ framework: 'express', indicators: ['backslash: \\path\\to\\file'] }],
      entryPoints: [{ filePath: 'src/app.ts', type: 'main', description: 'Description with "double quotes" and \'single quotes\'' }],
      chunks: [{
        id: 'c1', path: '/app/módule', name: 'módule',
        fileCount: 1, estimatedComplexity: 'low',
        description: 'Has unicode: \u4e16\u754c \u0416 \u2764',
        language: 'node',
      }],
      entities: [],
      dataFlows: [],
      systemContext: { centralSystem: 'App', upstreamFlows: [], downstreamFlows: [], datastores: [] },
      analyzedAt: '2026-01-01T00:00:00.000Z',
    };

    mgr.saveProfile(profile);
    const loaded = mgr.loadProfile();
    expect(loaded).toEqual(profile);
  });
});
