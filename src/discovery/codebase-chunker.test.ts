import { describe, it, expect, afterEach } from 'vitest';
import { CodebaseChunker } from './codebase-chunker.js';
import type { MonolithProfile } from '../core/types.js';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';

function makeProfile(overrides: Partial<MonolithProfile> = {}): MonolithProfile {
  return {
    id: 'p1', rootPath: '/app', name: 'TestApp',
    detectedLanguages: [{ language: 'node', confidence: 0.9, indicators: [] }],
    frameworks: [], entryPoints: [], chunks: [], entities: [], dataFlows: [],
    systemContext: { centralSystem: 'TestApp', upstreamFlows: [], downstreamFlows: [], datastores: [] },
    analyzedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('CodebaseChunker', () => {
  const chunker = new CodebaseChunker();
  const testRoot = join(tmpdir(), `sfn-chunker-${Date.now()}`);

  afterEach(() => {
    try { rmSync(testRoot, { recursive: true }); } catch {}
  });

  it('detects node modules by package.json', () => {
    const moduleA = join(testRoot, 'services', 'api');
    mkdirSync(moduleA, { recursive: true });
    writeFileSync(join(moduleA, 'package.json'), '{}');
    writeFileSync(join(moduleA, 'index.ts'), '');
    writeFileSync(join(moduleA, 'server.ts'), '');

    const profile = makeProfile();
    const chunks = chunker.chunk(testRoot, profile);

    expect(chunks.length).toBeGreaterThanOrEqual(1);
    const apiChunk = chunks.find((c) => c.name === 'api');
    expect(apiChunk).toBeDefined();
    expect(apiChunk!.language).toBe('node');
    expect(apiChunk!.fileCount).toBeGreaterThanOrEqual(2);
  });

  it('falls back to root when no modules found', () => {
    mkdirSync(testRoot, { recursive: true });
    writeFileSync(join(testRoot, 'app.ts'), '');

    const profile = makeProfile();
    const chunks = chunker.chunk(testRoot, profile);

    expect(chunks.length).toBe(1);
    expect(chunks[0].path).toBe(testRoot);
  });

  it('uses primary language from profile', () => {
    mkdirSync(testRoot, { recursive: true });
    writeFileSync(join(testRoot, 'Main.java'), '');

    const profile = makeProfile({
      detectedLanguages: [
        { language: 'java', confidence: 0.8, indicators: [] },
        { language: 'node', confidence: 0.3, indicators: [] },
      ],
    });
    const chunks = chunker.chunk(testRoot, profile);
    expect(chunks[0].language).toBe('java');
  });

  it('defaults to node when no languages detected', () => {
    mkdirSync(testRoot, { recursive: true });
    writeFileSync(join(testRoot, 'file.txt'), '');

    const profile = makeProfile({ detectedLanguages: [] });
    const chunks = chunker.chunk(testRoot, profile);
    expect(chunks[0].language).toBe('node');
  });

  it('estimates complexity based on file count', () => {
    // Create a module with few files (low complexity)
    const mod = join(testRoot, 'small');
    mkdirSync(mod, { recursive: true });
    writeFileSync(join(mod, 'package.json'), '{}');
    for (let i = 0; i < 5; i++) {
      writeFileSync(join(mod, `file${i}.ts`), '');
    }

    const profile = makeProfile();
    const chunks = chunker.chunk(testRoot, profile);
    const smallChunk = chunks.find((c) => c.name === 'small');
    expect(smallChunk).toBeDefined();
    expect(smallChunk!.estimatedComplexity).toBe('low');
  });
});
