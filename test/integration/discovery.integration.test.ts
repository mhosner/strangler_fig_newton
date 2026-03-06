import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rmSync } from 'node:fs';
import { createToyMonolith } from '../fixtures/create-toy-monolith.js';
import { CodebaseChunker } from '../../src/discovery/codebase-chunker.js';
import { EntityExtractor } from '../../src/discovery/entity-extractor.js';
import { DataFlowTracer } from '../../src/discovery/data-flow-tracer.js';
import { detectLanguages, detectAllFrameworks, detectAllEntryPoints } from '../../src/discovery/language-profiles/index.js';
import type { MonolithProfile, EntityRelationship } from '../../src/core/types.js';

const TEST_ROOT = join(tmpdir(), `sfn-integration-${Date.now()}`);

describe('Discovery Phase — Integration with Toy Monolith', () => {
  beforeAll(() => {
    createToyMonolith(TEST_ROOT);
  });

  afterAll(() => {
    rmSync(TEST_ROOT, { recursive: true, force: true });
  });

  // ── Language Detection ──

  describe('language detection', () => {
    it('detects Node.js with high confidence', () => {
      const languages = detectLanguages(TEST_ROOT);
      const node = languages.find((l) => l.language === 'node');
      expect(node).toBeDefined();
      expect(node!.confidence).toBeGreaterThanOrEqual(0.5);
      expect(node!.indicators).toEqual(
        expect.arrayContaining([expect.stringContaining('package.json')]),
      );
    });

    it('detects TypeScript via tsconfig.json', () => {
      const languages = detectLanguages(TEST_ROOT);
      const node = languages.find((l) => l.language === 'node')!;
      expect(node.confidence).toBeGreaterThanOrEqual(0.7);
      expect(node.indicators).toEqual(
        expect.arrayContaining([expect.stringContaining('tsconfig.json')]),
      );
    });

    it('does not detect Java, Python, or .NET', () => {
      const languages = detectLanguages(TEST_ROOT);
      const others = languages.filter((l) => l.language !== 'node');
      for (const lang of others) {
        expect(lang.confidence).toBe(0);
      }
    });
  });

  // ── Framework Detection ──

  describe('framework detection', () => {
    it('includes express as a possible framework', () => {
      const frameworks = detectAllFrameworks(TEST_ROOT);
      const express = frameworks.find((f) => f.framework === 'express');
      expect(express).toBeDefined();
    });
  });

  // ── Entry Points ──

  describe('entry point detection', () => {
    it('returns expected entry point patterns for Node', () => {
      const entryPoints = detectAllEntryPoints(TEST_ROOT);
      const types = entryPoints.map((e) => e.type);
      expect(types).toContain('main');
      expect(types).toContain('http-controller');
      expect(types).toContain('event-handler');
    });
  });

  // ── Codebase Chunking ──

  describe('codebase chunking', () => {
    function makeProfile(): MonolithProfile {
      return {
        id: 'test',
        rootPath: TEST_ROOT,
        name: 'AcmeMonolith',
        detectedLanguages: [{ language: 'node', confidence: 0.9, indicators: [] }],
        frameworks: [],
        entryPoints: [],
        chunks: [],
        entities: [],
        dataFlows: [],
        systemContext: { centralSystem: 'AcmeMonolith', upstreamFlows: [], downstreamFlows: [], datastores: [] },
        analyzedAt: new Date().toISOString(),
      };
    }

    it('discovers all four service modules', () => {
      const chunker = new CodebaseChunker();
      const chunks = chunker.chunk(TEST_ROOT, makeProfile());

      const names = chunks.map((c) => c.name).sort();
      expect(names).toEqual(['customers', 'notifications', 'orders', 'payments']);
    });

    it('counts files correctly in orders module', () => {
      const chunker = new CodebaseChunker();
      const chunks = chunker.chunk(TEST_ROOT, makeProfile());

      const orders = chunks.find((c) => c.name === 'orders')!;
      // package.json, index.ts, order.controller.ts, events.ts, db.ts, models/order.model.ts, models/order-item.model.ts
      expect(orders.fileCount).toBe(7);
    });

    it('assigns low complexity to small modules', () => {
      const chunker = new CodebaseChunker();
      const chunks = chunker.chunk(TEST_ROOT, makeProfile());

      for (const chunk of chunks) {
        expect(chunk.estimatedComplexity).toBe('low'); // all < 20 files
      }
    });

    it('assigns node as the language for all chunks', () => {
      const chunker = new CodebaseChunker();
      const chunks = chunker.chunk(TEST_ROOT, makeProfile());

      for (const chunk of chunks) {
        expect(chunk.language).toBe('node');
      }
    });
  });

  // ── Entity Extraction Prompts ──

  describe('entity extraction', () => {
    it('generates prompt that references all discovered modules', () => {
      const chunker = new CodebaseChunker();
      const profile: MonolithProfile = {
        id: 'test', rootPath: TEST_ROOT, name: 'AcmeMonolith',
        detectedLanguages: [{ language: 'node', confidence: 0.9, indicators: [] }],
        frameworks: [], entryPoints: [], chunks: [], entities: [], dataFlows: [],
        systemContext: { centralSystem: 'AcmeMonolith', upstreamFlows: [], downstreamFlows: [], datastores: [] },
        analyzedAt: new Date().toISOString(),
      };
      const chunks = chunker.chunk(TEST_ROOT, profile);

      const extractor = new EntityExtractor();
      const prompt = extractor.generateExtractionPrompt(chunks);

      expect(prompt).toContain('orders');
      expect(prompt).toContain('payments');
      expect(prompt).toContain('customers');
      expect(prompt).toContain('notifications');
      expect(prompt).toContain('Database tables/collections');
      expect(prompt).toContain('Message queues/topics');
    });

    it('structures raw entity results with unique IDs', () => {
      const extractor = new EntityExtractor();
      const raw = [
        { entityName: 'orders', entityType: 'table' as const, sourceFile: 'order.model.ts', relatedEntities: ['customers', 'order_items'], callers: ['orders'], callees: ['payments'] },
        { entityName: 'payments', entityType: 'table' as const, sourceFile: 'payment.model.ts', relatedEntities: ['orders'], callers: ['payments'], callees: [] },
        { entityName: 'order_events', entityType: 'topic' as const, sourceFile: 'events.ts', relatedEntities: [], callers: ['orders'], callees: ['notifications'] },
      ];

      const entities = extractor.structureResults(raw);
      expect(entities).toHaveLength(3);
      const ids = entities.map((e) => e.id);
      expect(new Set(ids).size).toBe(3); // all unique
    });
  });

  // ── Data Flow Tracing ──

  describe('data flow tracing', () => {
    it('generates tracing prompt that references entities and framework', () => {
      const tracer = new DataFlowTracer();
      const profile: MonolithProfile = {
        id: 'test', rootPath: TEST_ROOT, name: 'AcmeMonolith',
        detectedLanguages: [{ language: 'node', confidence: 0.9, indicators: [] }],
        frameworks: [{ framework: 'express', indicators: ['package.json'] }],
        entryPoints: [], chunks: [], entities: [], dataFlows: [],
        systemContext: { centralSystem: 'AcmeMonolith', upstreamFlows: [], downstreamFlows: [], datastores: [] },
        analyzedAt: new Date().toISOString(),
      };

      const entities: EntityRelationship[] = [
        { id: '1', entityName: 'orders', entityType: 'table', sourceFile: '', relatedEntities: [], callers: [], callees: [] },
        { id: '2', entityName: 'order_events', entityType: 'topic', sourceFile: '', relatedEntities: [], callers: [], callees: [] },
      ];

      const prompt = tracer.generateTracingPrompt(profile, entities);
      expect(prompt).toContain('AcmeMonolith');
      expect(prompt).toContain('express');
      expect(prompt).toContain('orders');
      expect(prompt).toContain('order_events');
      expect(prompt).toContain('Upstream systems');
      expect(prompt).toContain('Downstream consumers');
      expect(prompt).toContain('axios');
    });

    it('builds system context diagram from flows', () => {
      const tracer = new DataFlowTracer();
      const flows = [
        { name: 'Stripe API', direction: 'downstream' as const, protocol: 'HTTP', sourceSystem: 'AcmeMonolith', targetSystem: 'Stripe', dataDescription: 'Payment charges' },
        { name: 'Shipping Service', direction: 'downstream' as const, protocol: 'HTTP', sourceSystem: 'AcmeMonolith', targetSystem: 'ShippingService', dataDescription: 'Shipment requests' },
        { name: 'RabbitMQ Events', direction: 'bidirectional' as const, protocol: 'AMQP', sourceSystem: 'AcmeMonolith', targetSystem: 'AcmeMonolith', dataDescription: 'Order lifecycle events' },
      ];

      const datastores: EntityRelationship[] = [
        { id: '1', entityName: 'orders', entityType: 'table', sourceFile: '', relatedEntities: [], callers: [], callees: [] },
        { id: '2', entityName: 'payments', entityType: 'table', sourceFile: '', relatedEntities: [], callers: [], callees: [] },
        { id: '3', entityName: 'order_events', entityType: 'topic', sourceFile: '', relatedEntities: [], callers: [], callees: [] },
      ];

      const diagram = tracer.buildSystemContext('AcmeMonolith', flows, datastores);

      expect(diagram.centralSystem).toBe('AcmeMonolith');
      expect(diagram.downstreamFlows).toHaveLength(3); // 2 downstream + 1 bidirectional
      expect(diagram.upstreamFlows).toHaveLength(1); // 1 bidirectional
      expect(diagram.datastores).toHaveLength(2); // only tables, not topics
    });

    it('renders ASCII context diagram', () => {
      const tracer = new DataFlowTracer();
      const diagram = tracer.buildSystemContext(
        'AcmeMonolith',
        [
          { name: 'Stripe', direction: 'downstream', protocol: 'HTTP', sourceSystem: 'AcmeMonolith', targetSystem: 'Stripe', dataDescription: 'Charges' },
        ],
        [
          { id: '1', entityName: 'orders', entityType: 'table', sourceFile: '', relatedEntities: [], callers: [], callees: [] },
        ],
      );

      const ascii = tracer.renderContextDiagramAscii(diagram);
      expect(ascii).toContain('AcmeMonolith');
      expect(ascii).toContain('DATASTORES');
      expect(ascii).toContain('orders');
      expect(ascii).toContain('DOWNSTREAM');
      expect(ascii).toContain('Stripe');
    });
  });

  // ── End-to-End Discovery Flow ──

  describe('end-to-end discovery flow', () => {
    it('produces a complete MonolithProfile from the toy monolith', () => {
      // Step 1: Detect languages
      const languages = detectLanguages(TEST_ROOT);
      const frameworks = detectAllFrameworks(TEST_ROOT);
      const entryPoints = detectAllEntryPoints(TEST_ROOT);

      // Step 2: Chunk codebase
      const profile: MonolithProfile = {
        id: 'e2e-test',
        rootPath: TEST_ROOT,
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
      profile.chunks = chunker.chunk(TEST_ROOT, profile);

      // Step 3: Generate entity extraction prompt (would go to Claude in real use)
      const extractor = new EntityExtractor();
      const entityPrompt = extractor.generateExtractionPrompt(profile.chunks);

      // Simulate Claude's response with realistic entities
      const simulatedEntities = extractor.structureResults([
        { entityName: 'customers', entityType: 'table', sourceFile: 'customer.model.ts', relatedEntities: ['orders'], callers: ['customers'], callees: [] },
        { entityName: 'orders', entityType: 'table', sourceFile: 'order.model.ts', relatedEntities: ['customers', 'order_items', 'payments'], callers: ['orders'], callees: ['payments'] },
        { entityName: 'order_items', entityType: 'table', sourceFile: 'order-item.model.ts', relatedEntities: ['orders'], callers: ['orders'], callees: [] },
        { entityName: 'payments', entityType: 'table', sourceFile: 'payment.model.ts', relatedEntities: ['orders'], callers: ['payments'], callees: [] },
        { entityName: 'order_events', entityType: 'topic', sourceFile: 'events.ts', relatedEntities: [], callers: ['orders'], callees: ['notifications'] },
      ]);
      profile.entities = simulatedEntities;

      // Step 4: Trace data flows
      const tracer = new DataFlowTracer();
      const flowPrompt = tracer.generateTracingPrompt(profile, simulatedEntities);

      // Simulate Claude's response with realistic flows
      const simulatedFlows = [
        { name: 'Stripe Payment Gateway', direction: 'downstream' as const, protocol: 'HTTP', sourceSystem: 'AcmeMonolith', targetSystem: 'Stripe', dataDescription: 'Payment charges and refunds' },
        { name: 'Shipping Service', direction: 'downstream' as const, protocol: 'HTTP', sourceSystem: 'AcmeMonolith', targetSystem: 'ShippingService', dataDescription: 'Shipment creation requests' },
        { name: 'Email Notifications', direction: 'downstream' as const, protocol: 'SMTP', sourceSystem: 'AcmeMonolith', targetSystem: 'SendGrid', dataDescription: 'Order confirmation emails' },
        { name: 'Order Events Bus', direction: 'bidirectional' as const, protocol: 'AMQP', sourceSystem: 'AcmeMonolith', targetSystem: 'RabbitMQ', dataDescription: 'Order lifecycle events' },
      ];

      profile.systemContext = tracer.buildSystemContext('AcmeMonolith', simulatedFlows, simulatedEntities);
      profile.dataFlows = simulatedFlows.map((f, i) => ({ id: `flow-${i}`, ...f }));

      // Assertions on the complete profile
      expect(profile.detectedLanguages.length).toBeGreaterThanOrEqual(1);
      expect(profile.chunks).toHaveLength(4);
      expect(profile.entities).toHaveLength(5);
      expect(profile.dataFlows).toHaveLength(4);
      expect(profile.systemContext.datastores).toHaveLength(4); // tables only
      expect(profile.systemContext.downstreamFlows.length).toBeGreaterThanOrEqual(3);

      // Verify the prompts are well-formed (would be sent to Claude)
      expect(entityPrompt).toContain('orders');
      expect(flowPrompt).toContain('express');

      // Verify ASCII diagram renders
      const ascii = tracer.renderContextDiagramAscii(profile.systemContext);
      expect(ascii).toContain('AcmeMonolith');
      expect(ascii).toContain('Stripe');
      expect(ascii).toContain('SendGrid');
    });
  });
});
