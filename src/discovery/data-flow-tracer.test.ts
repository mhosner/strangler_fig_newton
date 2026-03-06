import { describe, it, expect } from 'vitest';
import { DataFlowTracer } from './data-flow-tracer.js';
import type { MonolithProfile, EntityRelationship, DataFlow, SystemContextDiagram } from '../core/types.js';

function makeProfile(overrides: Partial<MonolithProfile> = {}): MonolithProfile {
  return {
    id: 'p1', rootPath: '/app', name: 'TestApp',
    detectedLanguages: [], frameworks: [{ framework: 'spring-boot', indicators: [] }],
    entryPoints: [], chunks: [], entities: [], dataFlows: [],
    systemContext: { centralSystem: 'TestApp', upstreamFlows: [], downstreamFlows: [], datastores: [] },
    analyzedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('DataFlowTracer', () => {
  const tracer = new DataFlowTracer();

  describe('generateTracingPrompt', () => {
    it('includes system name and entities', () => {
      const entities: EntityRelationship[] = [
        { id: 'e1', entityName: 'orders', entityType: 'table', sourceFile: '', relatedEntities: [], callers: [], callees: [] },
      ];
      const prompt = tracer.generateTracingPrompt(makeProfile(), entities);
      expect(prompt).toContain('TestApp');
      expect(prompt).toContain('orders');
      expect(prompt).toContain('spring-boot');
      expect(prompt).toContain('Upstream systems');
    });
  });

  describe('buildSystemContext', () => {
    it('separates upstream and downstream flows', () => {
      const flows: Array<Omit<DataFlow, 'id'>> = [
        { name: 'API', direction: 'upstream', protocol: 'HTTP', sourceSystem: 'CRM', targetSystem: 'App', dataDescription: 'data' },
        { name: 'Events', direction: 'downstream', protocol: 'Kafka', sourceSystem: 'App', targetSystem: 'Analytics', dataDescription: 'events' },
      ];
      const datastores: EntityRelationship[] = [
        { id: 'd1', entityName: 'users', entityType: 'table', sourceFile: '', relatedEntities: [], callers: [], callees: [] },
        { id: 'd2', entityName: 'orders_queue', entityType: 'queue', sourceFile: '', relatedEntities: [], callers: [], callees: [] },
      ];

      const ctx = tracer.buildSystemContext('App', flows, datastores);
      expect(ctx.centralSystem).toBe('App');
      expect(ctx.upstreamFlows).toHaveLength(1);
      expect(ctx.upstreamFlows[0].sourceSystem).toBe('CRM');
      expect(ctx.downstreamFlows).toHaveLength(1);
      expect(ctx.downstreamFlows[0].targetSystem).toBe('Analytics');
      // Only tables and collections are datastores
      expect(ctx.datastores).toHaveLength(1);
      expect(ctx.datastores[0].entityName).toBe('users');
    });

    it('includes bidirectional flows in both upstream and downstream', () => {
      const flows: Array<Omit<DataFlow, 'id'>> = [
        { name: 'Sync', direction: 'bidirectional', protocol: 'gRPC', sourceSystem: 'ERP', targetSystem: 'App', dataDescription: 'sync' },
      ];

      const ctx = tracer.buildSystemContext('App', flows, []);
      expect(ctx.upstreamFlows).toHaveLength(1);
      expect(ctx.downstreamFlows).toHaveLength(1);
    });

    it('assigns IDs to flows', () => {
      const flows: Array<Omit<DataFlow, 'id'>> = [
        { name: 'F1', direction: 'upstream', protocol: 'HTTP', sourceSystem: 'A', targetSystem: 'B', dataDescription: '' },
      ];
      const ctx = tracer.buildSystemContext('B', flows, []);
      expect(ctx.upstreamFlows[0].id).toBeDefined();
    });
  });

  describe('renderContextDiagramAscii', () => {
    it('renders upstream, central system, datastores, and downstream', () => {
      const diagram: SystemContextDiagram = {
        centralSystem: 'MyApp',
        upstreamFlows: [{ id: '1', name: 'F1', direction: 'upstream', protocol: 'HTTP', sourceSystem: 'CRM', targetSystem: 'MyApp', dataDescription: 'customer data' }],
        downstreamFlows: [{ id: '2', name: 'F2', direction: 'downstream', protocol: 'Kafka', sourceSystem: 'MyApp', targetSystem: 'Analytics', dataDescription: 'events' }],
        datastores: [{ id: '3', entityName: 'users', entityType: 'table', sourceFile: '', relatedEntities: [], callers: [], callees: [] }],
      };

      const ascii = tracer.renderContextDiagramAscii(diagram);
      expect(ascii).toContain('UPSTREAM SYSTEMS');
      expect(ascii).toContain('[CRM] --HTTP--> [MyApp]');
      expect(ascii).toContain('=== MyApp ===');
      expect(ascii).toContain('(table) users');
      expect(ascii).toContain('DOWNSTREAM CONSUMERS');
      expect(ascii).toContain('[MyApp] --Kafka--> [Analytics]');
    });
  });
});
