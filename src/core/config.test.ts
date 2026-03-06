import { describe, it, expect, afterEach } from 'vitest';
import { loadConfig, DEFAULT_CONFIG } from './config.js';
import { writeJsonFile } from './utils.js';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rmSync, mkdirSync } from 'node:fs';

describe('loadConfig', () => {
  const testRoot = join(tmpdir(), `sfn-config-${Date.now()}`);

  afterEach(() => {
    try { rmSync(testRoot, { recursive: true }); } catch {}
  });

  it('returns default config when no config file exists', () => {
    const config = loadConfig(testRoot);
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it('merges user config with defaults', () => {
    const configPath = join(testRoot, '.sfn', 'config.json');
    writeJsonFile(configPath, { defaultStrategy: 'branch-by-abstraction', maxHistoryEntries: 500 });

    const config = loadConfig(testRoot);
    expect(config.defaultStrategy).toBe('branch-by-abstraction');
    expect(config.maxHistoryEntries).toBe(500);
    expect(config.stateDir).toBe(DEFAULT_CONFIG.stateDir);
    expect(config.languages).toEqual(DEFAULT_CONFIG.languages);
  });
});

describe('DEFAULT_CONFIG', () => {
  it('has all four languages enabled', () => {
    expect(Object.keys(DEFAULT_CONFIG.languages)).toEqual(['java', 'node', 'python', 'dotnet']);
    for (const lang of Object.values(DEFAULT_CONFIG.languages)) {
      expect(lang.enabled).toBe(true);
      expect(lang.confidenceThreshold).toBe(0.6);
    }
  });

  it('has five traffic diversion stages', () => {
    expect(DEFAULT_CONFIG.trafficDiversionStages).toEqual([1, 5, 25, 50, 100]);
  });
});
