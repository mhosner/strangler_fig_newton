import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rmSync } from 'node:fs';
import { createToyMonolith } from '../fixtures/create-toy-monolith.js';
import { CodebaseChunker } from '../../src/discovery/codebase-chunker.js';
import { EntityExtractor } from '../../src/discovery/entity-extractor.js';
import { DataFlowTracer } from '../../src/discovery/data-flow-tracer.js';
import { detectLanguages, detectAllFrameworks, detectAllEntryPoints } from '../../src/discovery/language-profiles/index.js';
import { ProductLineExtractor } from '../../src/planning/product-line-extractor.js';
import { ValueStreamExtractor } from '../../src/planning/value-stream-extractor.js';
import { FeatureParityChecker } from '../../src/planning/feature-parity-checker.js';
import { SliceRanker } from '../../src/planning/slice-ranker.js';
import { ModernizationPlanGenerator } from '../../src/planning/modernization-plan.js';
import { StateManager } from '../../src/core/state.js';
import { EventBus } from '../../src/core/events.js';
import type { MonolithProfile, SliceCandidate } from '../../src/core/types.js';

const MONOLITH_ROOT = join(tmpdir(), `sfn-cross-phase-${Date.now()}`);

function runDiscovery(): MonolithProfile {
  const languages = detectLanguages(MONOLITH_ROOT);
  const frameworks = detectAllFrameworks(MONOLITH_ROOT);
  const entryPoints = detectAllEntryPoints(MONOLITH_ROOT);

  const profile: MonolithProfile = {
    id: 'cross-phase-test',
    rootPath: MONOLITH_ROOT,
    name: 'AcmeMonolith',
    detectedLanguages: languages,
    frameworks,
    entryPoints,
    chunks: [],
    entities: [],
    dataFlows: [],
    systemContext: { centralSystem: 'AcmeMonolith', upstreamFlows: [], downstreamFlows: [], datastores: [] },
    analyzedAt: new Date().toISOString(),
  };

  const chunker = new CodebaseChunker();
  profile.chunks = chunker.chunk(MONOLITH_ROOT, profile);

  const extractor = new EntityExtractor();
  profile.entities = extractor.structureResults([
    { entityName: 'customers', entityType: 'table', sourceFile: 'customer.model.ts', relatedEntities: ['orders'], callers: ['customers'], callees: [] },
    { entityName: 'orders', entityType: 'table', sourceFile: 'order.model.ts', relatedEntities: ['customers', 'order_items', 'payments'], callers: ['orders'], callees: ['payments'] },
    { entityName: 'order_items', entityType: 'table', sourceFile: 'order-item.model.ts', relatedEntities: ['orders'], callers: ['orders'], callees: [] },
    { entityName: 'payments', entityType: 'table', sourceFile: 'payment.model.ts', relatedEntities: ['orders'], callers: ['payments'], callees: [] },
    { entityName: 'order_events', entityType: 'topic', sourceFile: 'events.ts', relatedEntities: [], callers: ['orders'], callees: ['notifications'] },
  ]);

  const tracer = new DataFlowTracer();
  const flows = [
    { name: 'Stripe Payment Gateway', direction: 'downstream' as const, protocol: 'HTTP', sourceSystem: 'AcmeMonolith', targetSystem: 'Stripe', dataDescription: 'Payment charges' },
    { name: 'Shipping Service', direction: 'downstream' as const, protocol: 'HTTP', sourceSystem: 'AcmeMonolith', targetSystem: 'ShippingService', dataDescription: 'Shipment requests' },
    { name: 'Email via SendGrid', direction: 'downstream' as const, protocol: 'SMTP', sourceSystem: 'AcmeMonolith', targetSystem: 'SendGrid', dataDescription: 'Order confirmation emails' },
    { name: 'Order Events', direction: 'bidirectional' as const, protocol: 'AMQP', sourceSystem: 'AcmeMonolith', targetSystem: 'RabbitMQ', dataDescription: 'Order lifecycle events' },
  ];
  profile.dataFlows = flows.map((f, i) => ({ id: `flow-${i}`, ...f }));
  profile.systemContext = tracer.buildSystemContext('AcmeMonolith', flows, profile.entities);

  return profile;
}

describe('Discovery → Planning cross-phase integration', () => {
  let profile: MonolithProfile;

  beforeAll(() => {
    createToyMonolith(MONOLITH_ROOT);
    profile = runDiscovery();
  });

  afterAll(() => {
    rmSync(MONOLITH_ROOT, { recursive: true, force: true });
  });

  describe('ProductLineExtractor with discovery output', () => {
    const extractor = new ProductLineExtractor();

    it('generates prompt referencing all discovered chunks and entry points', () => {
      const prompt = extractor.generateExtractionPrompt(profile);
      for (const chunk of profile.chunks) {
        expect(prompt).toContain(chunk.name);
      }
      expect(prompt).toContain('product line');
    });

    it('creates product lines with real chunk IDs from discovery', () => {
      const ordersChunk = profile.chunks.find((c) => c.name === 'orders')!;
      const paymentsChunk = profile.chunks.find((c) => c.name === 'payments')!;

      const pl = extractor.createProductLine(
        'Order Processing',
        'Handles order lifecycle',
        [ordersChunk, paymentsChunk],
        profile.entryPoints.filter((e) => e.type === 'http-controller'),
      );

      expect(pl.chunkIds).toContain(ordersChunk.id);
      expect(pl.chunkIds).toContain(paymentsChunk.id);
      expect(pl.id).toBeDefined();
    });
  });

  describe('ValueStreamExtractor with discovery output', () => {
    const extractor = new ValueStreamExtractor();

    it('generates prompt referencing discovered entities and flows', () => {
      const prompt = extractor.generateExtractionPrompt(profile);
      expect(prompt).toContain('orders');
      expect(prompt).toContain('payments');
      expect(prompt).toContain('Stripe');
      expect(prompt).toContain('value stream');
    });

    it('creates value streams with real chunk IDs from discovery', () => {
      const chunkIds = profile.chunks.map((c) => c.id);
      const vs = extractor.createValueStream(
        'Order Fulfillment',
        'End-to-end order processing',
        ['Place order', 'Process payment', 'Ship order', 'Send confirmation'],
        chunkIds.slice(0, 2),
        'critical',
      );
      expect(vs.chunkIds).toEqual(chunkIds.slice(0, 2));
    });
  });

  describe('FeatureParityChecker with discovery output', () => {
    const checker = new FeatureParityChecker();

    it('generates check prompt that resolves chunk and entity IDs', () => {
      const slice: SliceCandidate = {
        id: 'slice-orders',
        name: 'Order Processing',
        description: 'Order lifecycle management',
        type: 'product-line',
        chunkIds: profile.chunks.filter((c) => c.name === 'orders' || c.name === 'payments').map((c) => c.id),
        entityIds: profile.entities.filter((e) => e.entityName === 'orders' || e.entityName === 'payments').map((e) => e.id),
        dataFlowIds: [profile.dataFlows[0].id],
        riskScore: 5,
        businessValueScore: 7,
        recommendedOrder: 1,
        rationale: '',
      };

      const prompt = checker.generateCheckPrompt(profile, slice);

      // The prompt should contain the resolved chunk NAMES, not just IDs
      expect(prompt).toContain('orders');
      expect(prompt).toContain('payments');
      expect(prompt).toContain('FEATURE PARITY TRAP CHECK');
    });

    it('prompt is empty-safe when slice references no matching IDs', () => {
      const slice: SliceCandidate = {
        id: 'slice-empty',
        name: 'Ghost Slice',
        description: 'References nonexistent IDs',
        type: 'product-line',
        chunkIds: ['nonexistent-chunk-id'],
        entityIds: ['nonexistent-entity-id'],
        dataFlowIds: [],
        riskScore: 3,
        businessValueScore: 2,
        recommendedOrder: 1,
        rationale: '',
      };

      // Should not crash — just produce a prompt with no resolved chunks/entities
      const prompt = checker.generateCheckPrompt(profile, slice);
      expect(prompt).toContain('FEATURE PARITY TRAP CHECK');
    });
  });

  describe('SliceRanker with discovery-derived candidates', () => {
    const ranker = new SliceRanker();

    it('ranks slices built from real discovery IDs', () => {
      const ordersChunkIds = profile.chunks.filter((c) => c.name === 'orders').map((c) => c.id);
      const paymentsChunkIds = profile.chunks.filter((c) => c.name === 'payments').map((c) => c.id);
      const notifChunkIds = profile.chunks.filter((c) => c.name === 'notifications').map((c) => c.id);

      const candidates: SliceCandidate[] = [
        {
          id: 'slice-orders', name: 'Orders', description: 'Order management',
          type: 'product-line', chunkIds: ordersChunkIds,
          entityIds: profile.entities.filter((e) => e.entityName === 'orders').map((e) => e.id),
          dataFlowIds: [profile.dataFlows[0].id],
          riskScore: 6, businessValueScore: 9, recommendedOrder: 0, rationale: '',
        },
        {
          id: 'slice-payments', name: 'Payments', description: 'Payment processing',
          type: 'product-line', chunkIds: paymentsChunkIds,
          entityIds: profile.entities.filter((e) => e.entityName === 'payments').map((e) => e.id),
          dataFlowIds: [profile.dataFlows[0].id],
          riskScore: 8, businessValueScore: 8, recommendedOrder: 0, rationale: '',
        },
        {
          id: 'slice-notif', name: 'Notifications', description: 'Email notifications',
          type: 'product-line', chunkIds: notifChunkIds,
          entityIds: [],
          dataFlowIds: [profile.dataFlows[2].id],
          riskScore: 2, businessValueScore: 3, recommendedOrder: 0, rationale: '',
        },
      ];

      const ranked = ranker.rank(candidates);
      expect(ranked).toHaveLength(3);
      expect(ranked[0].recommendedOrder).toBe(1);
      expect(ranked[0].rationale).toContain('RECOMMENDED FIRST EXTRACTION');

      // All chunk/entity/flow IDs should still be intact after ranking
      for (const r of ranked) {
        for (const cid of r.chunkIds) {
          expect(profile.chunks.some((c) => c.id === cid)).toBe(true);
        }
        for (const eid of r.entityIds) {
          expect(profile.entities.some((e) => e.id === eid)).toBe(true);
        }
      }
    });
  });

  describe('Full pipeline: Discovery → Plan generation', () => {
    let stateDir: string;

    beforeEach(() => {
      stateDir = join(tmpdir(), `sfn-plan-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    });

    afterEach(() => {
      try { rmSync(stateDir, { recursive: true }); } catch {}
    });

    it('produces a valid ModernizationPlan from discovery output', () => {
      const stateManager = new StateManager(stateDir);
      const eventBus = new EventBus();
      const generator = new ModernizationPlanGenerator(stateManager, eventBus);
      const checker = new FeatureParityChecker();

      // Build a slice from real discovery data
      const ordersChunks = profile.chunks.filter((c) => c.name === 'orders' || c.name === 'payments');
      const slice: SliceCandidate = {
        id: 'slice-orders',
        name: 'Order Processing',
        description: 'Extract order management',
        type: 'product-line',
        chunkIds: ordersChunks.map((c) => c.id),
        entityIds: profile.entities.filter((e) => ['orders', 'payments', 'order_items'].includes(e.entityName)).map((e) => e.id),
        dataFlowIds: profile.dataFlows.slice(0, 2).map((f) => f.id),
        riskScore: 5,
        businessValueScore: 8,
        recommendedOrder: 1,
        rationale: 'Recommended first extraction',
      };

      const report = checker.structureReport(slice.id, {
        totalFeatures: 15,
        confirmedNeeded: ['create order', 'list orders', 'process payment'],
        confirmedUnneeded: ['legacy CSV export', 'old admin panel'],
        uncertain: ['batch order import'],
        deadCodePaths: ['deprecated order v1 endpoint'],
        legacyWorkarounds: ['dual-write to legacy DB'],
      });

      const plan = generator.generate(profile.id, slice, report);

      expect(plan.status).toBe('draft');
      expect(plan.monolithProfileId).toBe(profile.id);
      expect(plan.selectedSlice.chunkIds).toEqual(ordersChunks.map((c) => c.id));
      expect(plan.featureParityReport.reductionPercentage).toBeGreaterThan(0);

      // Plan should be persisted and loadable
      const loaded = stateManager.loadModernizationPlan(plan.id);
      expect(loaded).toEqual(plan);

      // Approve and verify event emission
      const approved = generator.approve(plan);
      expect(approved.status).toBe('approved');
      expect(eventBus.history()).toHaveLength(1);
      expect(eventBus.history()[0].type).toBe('PlanApproved');

      // Summary should reference real data
      const summary = generator.renderPlanSummary(approved);
      expect(summary).toContain('Order Processing');
      expect(summary).toContain('approved');
    });
  });
});
