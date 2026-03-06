import { describe, it, expect, afterEach } from 'vitest';
import { CodebaseChunker } from '../../src/discovery/codebase-chunker.js';
import type { MonolithProfile } from '../../src/core/types.js';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { createJavaMultiModule } from '../fixtures/create-java-multi-module.js';
import { createDotnetSolution } from '../fixtures/create-dotnet-solution.js';

function makeProfile(language: 'java' | 'node' | 'python' | 'dotnet'): MonolithProfile {
  return {
    id: 'test', rootPath: '/app', name: 'TestApp',
    detectedLanguages: [{ language, confidence: 0.9, indicators: [] }],
    frameworks: [], entryPoints: [], chunks: [], entities: [], dataFlows: [],
    systemContext: { centralSystem: 'TestApp', upstreamFlows: [], downstreamFlows: [], datastores: [] },
    analyzedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('CodebaseChunker — .NET projects', () => {
  const chunker = new CodebaseChunker();
  const testRoot = join(tmpdir(), `sfn-dotnet-${Date.now()}`);

  afterEach(() => {
    try { rmSync(testRoot, { recursive: true }); } catch {}
  });

  it('detects .NET modules by .csproj extension', () => {
    createDotnetSolution(testRoot);
    const chunks = chunker.chunk(testRoot, makeProfile('dotnet'));

    const names = chunks.map((c) => c.name).sort();
    expect(names).toEqual(['AcmeApp.Tests', 'Api', 'Domain']);
  });

  it('assigns dotnet as the chunk language', () => {
    createDotnetSolution(testRoot);
    const chunks = chunker.chunk(testRoot, makeProfile('dotnet'));
    for (const chunk of chunks) {
      expect(chunk.language).toBe('dotnet');
    }
  });

  it('counts files correctly in Api project', () => {
    createDotnetSolution(testRoot);
    const chunks = chunker.chunk(testRoot, makeProfile('dotnet'));
    const api = chunks.find((c) => c.name === 'Api')!;
    // AcmeApp.Api.csproj, Program.cs, Controllers/OrdersController.cs, Controllers/CustomersController.cs
    expect(api.fileCount).toBe(4);
  });

  it('falls back to root when only root-level .csproj exists', () => {
    mkdirSync(testRoot, { recursive: true });
    writeFileSync(join(testRoot, 'MyApp.csproj'), '<Project/>');
    writeFileSync(join(testRoot, 'Program.cs'), 'var app = WebApplication.CreateBuilder(args);');

    const chunks = chunker.chunk(testRoot, makeProfile('dotnet'));
    expect(chunks).toHaveLength(1);
    expect(chunks[0].path).toBe(testRoot);
  });
});

describe('CodebaseChunker — Java multi-module projects', () => {
  const chunker = new CodebaseChunker();
  const testRoot = join(tmpdir(), `sfn-java-multi-${Date.now()}`);

  afterEach(() => {
    try { rmSync(testRoot, { recursive: true }); } catch {}
  });

  it('discovers all four Maven sub-modules', () => {
    createJavaMultiModule(testRoot);
    const chunks = chunker.chunk(testRoot, makeProfile('java'));

    const names = chunks.map((c) => c.name).sort();
    expect(names).toEqual(['api', 'core', 'persistence', 'web']);
  });

  it('does not include root as a module', () => {
    createJavaMultiModule(testRoot);
    const chunks = chunker.chunk(testRoot, makeProfile('java'));
    expect(chunks.every((c) => c.path !== testRoot)).toBe(true);
  });

  it('assigns java as the chunk language', () => {
    createJavaMultiModule(testRoot);
    const chunks = chunker.chunk(testRoot, makeProfile('java'));
    for (const chunk of chunks) {
      expect(chunk.language).toBe('java');
    }
  });

  it('does not double-count nested modules', () => {
    createJavaMultiModule(testRoot);
    // Add a nested sub-module inside api/
    const nested = join(testRoot, 'api', 'sub');
    mkdirSync(nested, { recursive: true });
    writeFileSync(join(nested, 'pom.xml'), '<project/>');

    const chunks = chunker.chunk(testRoot, makeProfile('java'));
    // Should still be 4 — 'sub' should not appear because recursion stops at api/
    const names = chunks.map((c) => c.name).sort();
    expect(names).toEqual(['api', 'core', 'persistence', 'web']);
  });

  it('handles Gradle multi-module project', () => {
    mkdirSync(testRoot, { recursive: true });
    writeFileSync(join(testRoot, 'settings.gradle'), '');

    for (const mod of ['service-a', 'service-b']) {
      const modDir = join(testRoot, mod);
      mkdirSync(modDir, { recursive: true });
      writeFileSync(join(modDir, 'build.gradle'), '');
      writeFileSync(join(modDir, 'App.java'), '');
    }

    const chunks = chunker.chunk(testRoot, makeProfile('java'));
    const names = chunks.map((c) => c.name).sort();
    expect(names).toEqual(['service-a', 'service-b']);
  });
});
