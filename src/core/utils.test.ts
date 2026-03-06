import { describe, it, expect, vi, afterEach } from 'vitest';
import { generateId, isoNow, ensureDir, readJsonFile, writeJsonFile } from './utils.js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

describe('generateId', () => {
  it('returns a UUID string', () => {
    const id = generateId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('returns unique values', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });
});

describe('isoNow', () => {
  it('returns a valid ISO 8601 string', () => {
    const ts = isoNow();
    expect(new Date(ts).toISOString()).toBe(ts);
  });
});

describe('ensureDir', () => {
  const testDir = join(tmpdir(), `sfn-test-${Date.now()}`);

  afterEach(() => {
    try { rmSync(testDir, { recursive: true }); } catch {}
  });

  it('creates a directory that does not exist', () => {
    const nested = join(testDir, 'a', 'b', 'c');
    ensureDir(nested);
    expect(existsSync(nested)).toBe(true);
  });

  it('does nothing if directory already exists', () => {
    ensureDir(testDir);
    ensureDir(testDir); // should not throw
    expect(existsSync(testDir)).toBe(true);
  });
});

describe('readJsonFile / writeJsonFile', () => {
  const testDir = join(tmpdir(), `sfn-json-${Date.now()}`);
  const testFile = join(testDir, 'data.json');

  afterEach(() => {
    try { rmSync(testDir, { recursive: true }); } catch {}
  });

  it('writes and reads JSON', () => {
    const data = { name: 'test', values: [1, 2, 3] };
    writeJsonFile(testFile, data);
    const result = readJsonFile<typeof data>(testFile);
    expect(result).toEqual(data);
  });

  it('returns null for non-existent file', () => {
    expect(readJsonFile('/tmp/sfn-does-not-exist.json')).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    mkdirSync(testDir, { recursive: true });
    writeFileSync(testFile, 'not json', 'utf-8');
    expect(readJsonFile(testFile)).toBeNull();
  });

  it('creates parent directories when writing', () => {
    const deep = join(testDir, 'x', 'y', 'z', 'deep.json');
    writeJsonFile(deep, { a: 1 });
    expect(readJsonFile(deep)).toEqual({ a: 1 });
  });
});
