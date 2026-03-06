/**
 * Integration tests that run the discovery phase against real open-source monoliths.
 *
 * These tests clone public repos into /tmp and verify that language detection,
 * framework detection, codebase chunking, and prompt generation all work
 * correctly against real-world project structures.
 *
 * Prerequisites: repos must be cloned before running. The beforeAll hooks
 * handle this, but tests are skipped if cloning fails (e.g. no network).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { CodebaseChunker } from '../../src/discovery/codebase-chunker.js';
import { EntityExtractor } from '../../src/discovery/entity-extractor.js';
import { DataFlowTracer } from '../../src/discovery/data-flow-tracer.js';
import { detectLanguages, detectAllFrameworks, detectAllEntryPoints } from '../../src/discovery/language-profiles/index.js';
import type { MonolithProfile } from '../../src/core/types.js';

function makeProfile(rootPath: string, name: string, overrides: Partial<MonolithProfile> = {}): MonolithProfile {
  return {
    id: 'test',
    rootPath,
    name,
    detectedLanguages: [],
    frameworks: [],
    entryPoints: [],
    chunks: [],
    entities: [],
    dataFlows: [],
    systemContext: { centralSystem: name, upstreamFlows: [], downstreamFlows: [], datastores: [] },
    analyzedAt: new Date().toISOString(),
    ...overrides,
  };
}

function cloneIfMissing(url: string, dest: string): boolean {
  if (existsSync(dest)) return true;
  try {
    execSync(`git clone --depth 1 ${url} ${dest}`, { stdio: 'pipe', timeout: 30_000 });
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────
// Spring PetClinic (Java/Spring Boot, Maven + Gradle)
// ─────────────────────────────────────────────────────────

describe('Spring PetClinic (Java/Spring)', () => {
  const PETCLINIC = '/tmp/spring-petclinic';
  let available = false;

  beforeAll(() => {
    available = cloneIfMissing('https://github.com/spring-projects/spring-petclinic.git', PETCLINIC);
  });

  describe('language detection', () => {
    it('detects Java with high confidence', () => {
      if (!available) return;
      const languages = detectLanguages(PETCLINIC);
      const java = languages.find((l) => l.language === 'java');
      expect(java).toBeDefined();
      // pom.xml (0.4) + build.gradle (0.4) + src/main/java (0.3) = capped at 1.0
      expect(java!.confidence).toBeGreaterThanOrEqual(0.7);
    });

    it('reports Maven and Gradle indicators', () => {
      if (!available) return;
      const languages = detectLanguages(PETCLINIC);
      const java = languages.find((l) => l.language === 'java')!;
      expect(java.indicators).toEqual(
        expect.arrayContaining([
          expect.stringContaining('pom.xml'),
          expect.stringContaining('build.gradle'),
          expect.stringContaining('src/main/java'),
        ]),
      );
    });

    it('does not false-positive on Node or Python', () => {
      if (!available) return;
      const languages = detectLanguages(PETCLINIC);
      const node = languages.find((l) => l.language === 'node');
      const python = languages.find((l) => l.language === 'python');
      expect(node).toBeUndefined();
      expect(python).toBeUndefined();
    });
  });

  describe('framework detection', () => {
    it('detects Spring Boot via application.properties', () => {
      if (!available) return;
      const frameworks = detectAllFrameworks(PETCLINIC);
      const springBoot = frameworks.find((f) => f.framework === 'spring-boot');
      expect(springBoot).toBeDefined();
      expect(springBoot!.indicators).toEqual(
        expect.arrayContaining([expect.stringContaining('application.properties')]),
      );
    });
  });

  describe('entry points', () => {
    it('returns Java-specific entry point patterns', () => {
      if (!available) return;
      const entryPoints = detectAllEntryPoints(PETCLINIC);
      const javaEntries = entryPoints.filter((e) =>
        e.filePath.endsWith('.java'),
      );
      expect(javaEntries.length).toBeGreaterThanOrEqual(2);
      const types = javaEntries.map((e) => e.type);
      expect(types).toContain('main');
      expect(types).toContain('http-controller');
    });
  });

  describe('codebase chunking', () => {
    it('treats PetClinic as a single module (no sub-pom.xml files)', () => {
      if (!available) return;
      const profile = makeProfile(PETCLINIC, 'PetClinic', {
        detectedLanguages: [{ language: 'java', confidence: 1.0, indicators: [] }],
      });
      const chunker = new CodebaseChunker();
      const chunks = chunker.chunk(PETCLINIC, profile);

      // PetClinic is a single-module project — no nested pom.xml/build.gradle
      // so the chunker should fall back to the root
      expect(chunks.length).toBe(1);
      expect(chunks[0].path).toBe(PETCLINIC);
      expect(chunks[0].fileCount).toBeGreaterThan(10);
    });

    it('assigns java as the chunk language', () => {
      if (!available) return;
      const profile = makeProfile(PETCLINIC, 'PetClinic', {
        detectedLanguages: [{ language: 'java', confidence: 1.0, indicators: [] }],
      });
      const chunker = new CodebaseChunker();
      const chunks = chunker.chunk(PETCLINIC, profile);
      expect(chunks[0].language).toBe('java');
    });
  });

  describe('entity extraction prompts', () => {
    it('generates a prompt referencing PetClinic chunks', () => {
      if (!available) return;
      const profile = makeProfile(PETCLINIC, 'PetClinic', {
        detectedLanguages: [{ language: 'java', confidence: 1.0, indicators: [] }],
      });
      const chunker = new CodebaseChunker();
      const chunks = chunker.chunk(PETCLINIC, profile);
      const extractor = new EntityExtractor();
      const prompt = extractor.generateExtractionPrompt(chunks);

      expect(prompt).toContain('spring-petclinic');
      expect(prompt).toContain('java');
      expect(prompt).toContain('Database tables/collections');
    });
  });

  describe('data flow tracing prompts', () => {
    it('generates a prompt referencing Spring Boot framework', () => {
      if (!available) return;
      const profile = makeProfile(PETCLINIC, 'PetClinic', {
        detectedLanguages: [{ language: 'java', confidence: 1.0, indicators: [] }],
        frameworks: [{ framework: 'spring-boot', indicators: ['application.properties'] }],
      });

      const entities = [
        { id: '1', entityName: 'owners', entityType: 'table' as const, sourceFile: 'Owner.java', relatedEntities: ['pets'], callers: [], callees: [] },
        { id: '2', entityName: 'pets', entityType: 'table' as const, sourceFile: 'Pet.java', relatedEntities: ['owners', 'visits'], callers: [], callees: [] },
        { id: '3', entityName: 'visits', entityType: 'table' as const, sourceFile: 'Visit.java', relatedEntities: ['pets'], callers: [], callees: [] },
        { id: '4', entityName: 'vets', entityType: 'table' as const, sourceFile: 'Vet.java', relatedEntities: ['specialties'], callers: [], callees: [] },
      ];

      const tracer = new DataFlowTracer();
      const prompt = tracer.generateTracingPrompt(profile, entities);

      expect(prompt).toContain('PetClinic');
      expect(prompt).toContain('spring-boot');
      expect(prompt).toContain('owners');
      expect(prompt).toContain('pets');
      expect(prompt).toContain('visits');
      expect(prompt).toContain('vets');
    });
  });

  describe('end-to-end discovery flow', () => {
    it('produces a coherent profile from PetClinic', () => {
      if (!available) return;

      // Step 1: Detect
      const languages = detectLanguages(PETCLINIC);
      const frameworks = detectAllFrameworks(PETCLINIC);
      const entryPoints = detectAllEntryPoints(PETCLINIC);

      // Step 2: Chunk
      const profile = makeProfile(PETCLINIC, 'PetClinic', {
        detectedLanguages: languages,
        frameworks,
        entryPoints,
      });
      const chunker = new CodebaseChunker();
      profile.chunks = chunker.chunk(PETCLINIC, profile);

      // Step 3: Generate prompts (would go to Claude in practice)
      const extractor = new EntityExtractor();
      const entityPrompt = extractor.generateExtractionPrompt(profile.chunks);

      // Simulate realistic entity extraction results for PetClinic
      const entities = extractor.structureResults([
        { entityName: 'owners', entityType: 'table', sourceFile: 'Owner.java', relatedEntities: ['pets'], callers: ['OwnerController'], callees: [] },
        { entityName: 'pets', entityType: 'table', sourceFile: 'Pet.java', relatedEntities: ['owners', 'visits', 'types'], callers: ['OwnerController'], callees: [] },
        { entityName: 'visits', entityType: 'table', sourceFile: 'Visit.java', relatedEntities: ['pets'], callers: ['OwnerController'], callees: [] },
        { entityName: 'vets', entityType: 'table', sourceFile: 'Vet.java', relatedEntities: ['specialties'], callers: ['VetController'], callees: [] },
        { entityName: 'specialties', entityType: 'table', sourceFile: 'Specialty.java', relatedEntities: ['vets'], callers: [], callees: [] },
        { entityName: 'types', entityType: 'table', sourceFile: 'PetType.java', relatedEntities: ['pets'], callers: [], callees: [] },
      ]);
      profile.entities = entities;

      // Step 4: Build system context (PetClinic has no external integrations — just a DB)
      const tracer = new DataFlowTracer();
      profile.systemContext = tracer.buildSystemContext('PetClinic', [], entities);

      // Assertions
      expect(profile.detectedLanguages.find((l) => l.language === 'java')!.confidence).toBeGreaterThanOrEqual(0.7);
      expect(profile.frameworks.find((f) => f.framework === 'spring-boot')).toBeDefined();
      expect(profile.chunks.length).toBe(1);
      expect(profile.entities).toHaveLength(6);
      expect(profile.systemContext.datastores).toHaveLength(6); // all are tables
      expect(profile.systemContext.upstreamFlows).toHaveLength(0);
      expect(profile.systemContext.downstreamFlows).toHaveLength(0);

      // Verify ASCII diagram renders
      const ascii = tracer.renderContextDiagramAscii(profile.systemContext);
      expect(ascii).toContain('PetClinic');
      expect(ascii).toContain('DATASTORES');
      expect(ascii).toContain('owners');

      // Verify prompt is well-formed
      expect(entityPrompt).toContain('java');
    });
  });
});

// ─────────────────────────────────────────────────────────
// djangoproject.com (Python/Django)
// ─────────────────────────────────────────────────────────

describe('djangoproject.com (Python/Django)', () => {
  const DJANGOPROJECT = '/tmp/djangoproject';
  let available = false;

  beforeAll(() => {
    available = cloneIfMissing('https://github.com/django/djangoproject.com.git', DJANGOPROJECT);
  });

  describe('language detection', () => {
    it('detects Python via manage.py', () => {
      if (!available) return;
      const languages = detectLanguages(DJANGOPROJECT);
      const python = languages.find((l) => l.language === 'python');
      expect(python).toBeDefined();
      expect(python!.confidence).toBeGreaterThanOrEqual(0.3);
      expect(python!.indicators).toEqual(
        expect.arrayContaining([expect.stringContaining('manage.py')]),
      );
    });

    it('does not false-positive on Java', () => {
      if (!available) return;
      const languages = detectLanguages(DJANGOPROJECT);
      const java = languages.find((l) => l.language === 'java');
      expect(java).toBeUndefined();
    });
  });

  describe('framework detection', () => {
    it('detects Django via manage.py', () => {
      if (!available) return;
      const frameworks = detectAllFrameworks(DJANGOPROJECT);
      const django = frameworks.find((f) => f.framework === 'django');
      expect(django).toBeDefined();
    });
  });

  describe('entry points', () => {
    it('returns Django-specific entry point patterns', () => {
      if (!available) return;
      const entryPoints = detectAllEntryPoints(DJANGOPROJECT);
      const pyEntries = entryPoints.filter((e) =>
        e.filePath.includes('.py') || e.filePath.includes('manage.py'),
      );
      expect(pyEntries.length).toBeGreaterThanOrEqual(3);

      const descriptions = pyEntries.map((e) => e.description).join(' ');
      expect(descriptions).toContain('Django');
    });
  });

  describe('codebase chunking', () => {
    it('discovers Django app directories as modules via __init__.py', () => {
      if (!available) return;
      const profile = makeProfile(DJANGOPROJECT, 'DjangoProject', {
        detectedLanguages: [{ language: 'python', confidence: 0.7, indicators: [] }],
      });
      const chunker = new CodebaseChunker();
      const chunks = chunker.chunk(DJANGOPROJECT, profile);

      // Django apps like accounts, blog, fundraising should be found as modules
      // because they contain __init__.py (a Python module marker)
      const chunkNames = chunks.map((c) => c.name);
      expect(chunks.length).toBeGreaterThanOrEqual(3);
      expect(chunkNames).toEqual(expect.arrayContaining([
        expect.stringMatching(/accounts|blog|fundraising|members|releases|aggregator/),
      ]));
    });

    it('assigns python as the chunk language', () => {
      if (!available) return;
      const profile = makeProfile(DJANGOPROJECT, 'DjangoProject', {
        detectedLanguages: [{ language: 'python', confidence: 0.7, indicators: [] }],
      });
      const chunker = new CodebaseChunker();
      const chunks = chunker.chunk(DJANGOPROJECT, profile);
      for (const chunk of chunks) {
        expect(chunk.language).toBe('python');
      }
    });
  });

  describe('entity extraction prompts', () => {
    it('generates a prompt referencing discovered Django app chunks', () => {
      if (!available) return;
      const profile = makeProfile(DJANGOPROJECT, 'DjangoProject', {
        detectedLanguages: [{ language: 'python', confidence: 0.7, indicators: [] }],
      });
      const chunker = new CodebaseChunker();
      const chunks = chunker.chunk(DJANGOPROJECT, profile);
      const extractor = new EntityExtractor();
      const prompt = extractor.generateExtractionPrompt(chunks);

      expect(prompt).toContain('python');
      expect(prompt).toContain('Database tables/collections');
      // Should reference at least some Django apps
      expect(prompt).toMatch(/accounts|blog|fundraising/);
    });
  });

  describe('end-to-end discovery flow', () => {
    it('produces a coherent profile from djangoproject.com', () => {
      if (!available) return;

      const languages = detectLanguages(DJANGOPROJECT);
      const frameworks = detectAllFrameworks(DJANGOPROJECT);
      const entryPoints = detectAllEntryPoints(DJANGOPROJECT);

      const profile = makeProfile(DJANGOPROJECT, 'DjangoProject', {
        detectedLanguages: languages,
        frameworks,
        entryPoints,
      });

      const chunker = new CodebaseChunker();
      profile.chunks = chunker.chunk(DJANGOPROJECT, profile);

      const extractor = new EntityExtractor();
      const entityPrompt = extractor.generateExtractionPrompt(profile.chunks);

      // Simulate entity extraction
      profile.entities = extractor.structureResults([
        { entityName: 'auth_user', entityType: 'table', sourceFile: 'accounts/models.py', relatedEntities: [], callers: ['accounts'], callees: [] },
        { entityName: 'blog_entry', entityType: 'table', sourceFile: 'blog/models.py', relatedEntities: [], callers: ['blog'], callees: [] },
        { entityName: 'fundraising_donation', entityType: 'table', sourceFile: 'fundraising/models.py', relatedEntities: ['auth_user'], callers: ['fundraising'], callees: [] },
      ]);

      const tracer = new DataFlowTracer();
      profile.systemContext = tracer.buildSystemContext('DjangoProject', [], profile.entities);

      // Assertions
      expect(profile.detectedLanguages.find((l) => l.language === 'python')).toBeDefined();
      expect(profile.frameworks.find((f) => f.framework === 'django')).toBeDefined();
      expect(profile.chunks.length).toBeGreaterThanOrEqual(3);
      expect(profile.entities).toHaveLength(3);
      expect(profile.systemContext.datastores).toHaveLength(3);

      const ascii = tracer.renderContextDiagramAscii(profile.systemContext);
      expect(ascii).toContain('DjangoProject');
      expect(ascii).toContain('DATASTORES');
      expect(entityPrompt).toContain('python');
    });
  });
});
