import { describe, it, expect, afterEach } from 'vitest';
import { CodebaseChunker } from '../../src/discovery/codebase-chunker.js';
import type { MonolithProfile } from '../../src/core/types.js';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdirSync, writeFileSync, rmSync, symlinkSync, chmodSync } from 'node:fs';

function makeProfile(): MonolithProfile {
  return {
    id: 'test', rootPath: '/app', name: 'TestApp',
    detectedLanguages: [{ language: 'node', confidence: 0.9, indicators: [] }],
    frameworks: [], entryPoints: [], chunks: [], entities: [], dataFlows: [],
    systemContext: { centralSystem: 'TestApp', upstreamFlows: [], downstreamFlows: [], datastores: [] },
    analyzedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('CodebaseChunker — resilience', () => {
  const chunker = new CodebaseChunker();
  const testRoot = join(tmpdir(), `sfn-resilience-${Date.now()}`);

  afterEach(() => {
    // Restore permissions before cleanup
    try { chmodSync(join(testRoot, 'restricted'), 0o755); } catch {}
    try { rmSync(testRoot, { recursive: true, force: true }); } catch {}
  });

  it('handles circular symlinks without hanging', () => {
    const dir = join(testRoot, 'app');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.ts'), '');

    try {
      symlinkSync(dir, join(dir, 'self-link'));
    } catch {
      // Platform may not support symlinks — skip
      return;
    }

    // Should terminate thanks to depth > 3 guard
    const chunks = chunker.chunk(testRoot, makeProfile());
    expect(chunks.length).toBeGreaterThanOrEqual(1);
  });

  it('handles unreadable directories gracefully', () => {
    // Skip if running as root (permissions have no effect)
    if (process.getuid?.() === 0) return;

    const modDir = join(testRoot, 'mymod');
    mkdirSync(modDir, { recursive: true });
    writeFileSync(join(modDir, 'package.json'), '{}');
    writeFileSync(join(modDir, 'app.ts'), '');

    const restricted = join(testRoot, 'restricted');
    mkdirSync(restricted, { recursive: true });
    writeFileSync(join(restricted, 'secret.ts'), '');
    chmodSync(restricted, 0o000);

    const chunks = chunker.chunk(testRoot, makeProfile());
    // Should still find 'mymod' and not crash on 'restricted'
    const names = chunks.map((c) => c.name);
    expect(names).toContain('mymod');
  });

  it('discovers modules at depth 3 but not depth 4', () => {
    // Depth 0 = root, 1 = a, 2 = b, 3 = c (visited), 4 = d (not visited)
    const depth3 = join(testRoot, 'a', 'b', 'shallow');
    mkdirSync(depth3, { recursive: true });
    writeFileSync(join(depth3, 'package.json'), '{}');
    writeFileSync(join(depth3, 'index.ts'), '');

    const depth4 = join(testRoot, 'x', 'y', 'z', 'deep');
    mkdirSync(depth4, { recursive: true });
    writeFileSync(join(depth4, 'package.json'), '{}');
    writeFileSync(join(depth4, 'index.ts'), '');

    const chunks = chunker.chunk(testRoot, makeProfile());
    const names = chunks.map((c) => c.name);
    expect(names).toContain('shallow');
    expect(names).not.toContain('deep');
  });

  it('handles empty directories without crashing', () => {
    mkdirSync(join(testRoot, 'empty-a'), { recursive: true });
    mkdirSync(join(testRoot, 'empty-b'), { recursive: true });
    mkdirSync(join(testRoot, 'empty-c'), { recursive: true });

    const chunks = chunker.chunk(testRoot, makeProfile());
    // No modules found — falls back to root
    expect(chunks).toHaveLength(1);
    expect(chunks[0].path).toBe(testRoot);
  });

  it('handles directories with many entries', () => {
    mkdirSync(testRoot, { recursive: true });
    for (let i = 0; i < 200; i++) {
      mkdirSync(join(testRoot, `dir-${i.toString().padStart(3, '0')}`), { recursive: true });
    }

    const chunks = chunker.chunk(testRoot, makeProfile());
    // No modules — falls back to root, but should not crash or hang
    expect(chunks).toHaveLength(1);
    expect(chunks[0].path).toBe(testRoot);
  });

  it('counts files as 0 in empty module', () => {
    const mod = join(testRoot, 'empty-mod');
    mkdirSync(mod, { recursive: true });
    writeFileSync(join(mod, 'package.json'), '{}');

    const chunks = chunker.chunk(testRoot, makeProfile());
    const emptyMod = chunks.find((c) => c.name === 'empty-mod');
    expect(emptyMod).toBeDefined();
    // Only package.json itself
    expect(emptyMod!.fileCount).toBe(1);
  });
});
