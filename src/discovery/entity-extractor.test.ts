import { describe, it, expect } from 'vitest';
import { EntityExtractor } from './entity-extractor.js';
import type { CodeChunk, EntityRelationship } from '../core/types.js';

describe('EntityExtractor', () => {
  const extractor = new EntityExtractor();

  describe('generateExtractionPrompt', () => {
    it('includes all chunk names and paths', () => {
      const chunks: CodeChunk[] = [
        { id: '1', path: '/app/orders', name: 'orders', fileCount: 10, estimatedComplexity: 'medium', description: '', language: 'java' },
        { id: '2', path: '/app/payments', name: 'payments', fileCount: 5, estimatedComplexity: 'low', description: '', language: 'java' },
      ];

      const prompt = extractor.generateExtractionPrompt(chunks);
      expect(prompt).toContain('orders');
      expect(prompt).toContain('/app/orders');
      expect(prompt).toContain('payments');
      expect(prompt).toContain('Database tables/collections');
      expect(prompt).toContain('entityType');
    });
  });

  describe('structureResults', () => {
    it('adds unique IDs to raw entities', () => {
      const raw: Array<Omit<EntityRelationship, 'id'>> = [
        { entityName: 'orders', entityType: 'table', sourceFile: 'Order.java', relatedEntities: [], callers: [], callees: [] },
        { entityName: 'payments', entityType: 'table', sourceFile: 'Payment.java', relatedEntities: [], callers: [], callees: [] },
      ];

      const result = extractor.structureResults(raw);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBeDefined();
      expect(result[1].id).toBeDefined();
      expect(result[0].id).not.toBe(result[1].id);
      expect(result[0].entityName).toBe('orders');
    });
  });

  describe('createEmptyEntity', () => {
    it('creates entity with empty relationships', () => {
      const entity = extractor.createEmptyEntity('users', 'table', 'User.java');
      expect(entity.entityName).toBe('users');
      expect(entity.entityType).toBe('table');
      expect(entity.sourceFile).toBe('User.java');
      expect(entity.relatedEntities).toEqual([]);
      expect(entity.callers).toEqual([]);
      expect(entity.callees).toEqual([]);
      expect(entity.id).toBeDefined();
    });
  });
});
