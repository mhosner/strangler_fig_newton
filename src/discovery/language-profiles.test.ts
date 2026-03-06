import { describe, it, expect, afterEach } from 'vitest';
import { detectLanguages, detectAllFrameworks, detectAllEntryPoints, ALL_PROFILES } from './language-profiles/index.js';
import { javaSpringProfile } from './language-profiles/java-spring.js';
import { nodeProfile } from './language-profiles/node.js';
import { pythonProfile } from './language-profiles/python.js';
import { dotnetProfile } from './language-profiles/dotnet.js';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';

describe('Language Profiles', () => {
  const testRoot = join(tmpdir(), `sfn-lang-${Date.now()}`);

  afterEach(() => {
    try { rmSync(testRoot, { recursive: true }); } catch {}
  });

  describe('ALL_PROFILES', () => {
    it('has four profiles', () => {
      expect(ALL_PROFILES).toHaveLength(4);
      expect(ALL_PROFILES.map((p) => p.language).sort()).toEqual(['dotnet', 'java', 'node', 'python']);
    });
  });

  describe('nodeProfile', () => {
    it('detects node project with package.json', () => {
      mkdirSync(testRoot, { recursive: true });
      writeFileSync(join(testRoot, 'package.json'), '{}');

      const detection = nodeProfile.detect(testRoot);
      expect(detection.language).toBe('node');
      expect(detection.confidence).toBeGreaterThanOrEqual(0.5);
      expect(detection.indicators.length).toBeGreaterThan(0);
    });

    it('detects TypeScript project', () => {
      mkdirSync(testRoot, { recursive: true });
      writeFileSync(join(testRoot, 'package.json'), '{}');
      writeFileSync(join(testRoot, 'tsconfig.json'), '{}');

      const detection = nodeProfile.detect(testRoot);
      expect(detection.confidence).toBeGreaterThanOrEqual(0.7);
    });

    it('returns 0 confidence for non-node project', () => {
      mkdirSync(testRoot, { recursive: true });
      const detection = nodeProfile.detect(testRoot);
      expect(detection.confidence).toBe(0);
    });

    it('detects NestJS framework', () => {
      mkdirSync(join(testRoot, 'src'), { recursive: true });
      writeFileSync(join(testRoot, 'nest-cli.json'), '{}');

      const frameworks = nodeProfile.detectFrameworks(testRoot);
      expect(frameworks.some((f) => f.framework === 'nestjs')).toBe(true);
    });

    it('returns entry point hints', () => {
      const entryPoints = nodeProfile.detectEntryPoints(testRoot);
      expect(entryPoints.length).toBeGreaterThan(0);
      expect(entryPoints.some((e) => e.type === 'main')).toBe(true);
      expect(entryPoints.some((e) => e.type === 'http-controller')).toBe(true);
    });

    it('has valid importPattern regex', () => {
      expect(nodeProfile.importPattern.test('import foo from "bar"')).toBe(true);
      expect(nodeProfile.importPattern.test('const x = require("y")')).toBe(true);
    });
  });

  describe('javaSpringProfile', () => {
    it('detects Maven project', () => {
      mkdirSync(testRoot, { recursive: true });
      writeFileSync(join(testRoot, 'pom.xml'), '<project/>');

      const detection = javaSpringProfile.detect(testRoot);
      expect(detection.language).toBe('java');
      expect(detection.confidence).toBeGreaterThanOrEqual(0.4);
    });

    it('detects Spring Boot framework', () => {
      mkdirSync(join(testRoot, 'src', 'main', 'resources'), { recursive: true });
      writeFileSync(join(testRoot, 'src', 'main', 'resources', 'application.properties'), '');

      const frameworks = javaSpringProfile.detectFrameworks(testRoot);
      expect(frameworks.some((f) => f.framework === 'spring-boot')).toBe(true);
    });

    it('has valid importPattern regex', () => {
      expect(javaSpringProfile.importPattern.test('import java.util.List;')).toBe(true);
    });
  });

  describe('pythonProfile', () => {
    it('detects Python project with requirements.txt', () => {
      mkdirSync(testRoot, { recursive: true });
      writeFileSync(join(testRoot, 'requirements.txt'), 'flask\n');

      const detection = pythonProfile.detect(testRoot);
      expect(detection.language).toBe('python');
      expect(detection.confidence).toBeGreaterThanOrEqual(0.4);
    });

    it('detects Django project', () => {
      mkdirSync(testRoot, { recursive: true });
      writeFileSync(join(testRoot, 'manage.py'), '');

      const detection = pythonProfile.detect(testRoot);
      expect(detection.confidence).toBeGreaterThanOrEqual(0.3);

      const frameworks = pythonProfile.detectFrameworks(testRoot);
      expect(frameworks.some((f) => f.framework === 'django')).toBe(true);
    });

    it('has valid importPattern regex', () => {
      expect(pythonProfile.importPattern.test('import os')).toBe(true);
      expect(pythonProfile.importPattern.test('from flask import Flask')).toBe(true);
    });
  });

  describe('dotnetProfile', () => {
    it('detects .NET project with .sln file', () => {
      mkdirSync(testRoot, { recursive: true });
      writeFileSync(join(testRoot, 'App.sln'), '');

      const detection = dotnetProfile.detect(testRoot);
      expect(detection.language).toBe('dotnet');
      expect(detection.confidence).toBeGreaterThanOrEqual(0.5);
    });

    it('detects ASP.NET framework', () => {
      mkdirSync(testRoot, { recursive: true });
      writeFileSync(join(testRoot, 'Program.cs'), '');

      const frameworks = dotnetProfile.detectFrameworks(testRoot);
      expect(frameworks.some((f) => f.framework === 'aspnet')).toBe(true);
    });

    it('has valid importPattern regex', () => {
      expect(dotnetProfile.importPattern.test('using System.Collections;')).toBe(true);
    });
  });

  describe('detectLanguages', () => {
    it('returns only languages with confidence > 0', () => {
      mkdirSync(testRoot, { recursive: true });
      writeFileSync(join(testRoot, 'package.json'), '{}');

      const detections = detectLanguages(testRoot);
      expect(detections.every((d) => d.confidence > 0)).toBe(true);
      expect(detections.some((d) => d.language === 'node')).toBe(true);
    });
  });

  describe('detectAllFrameworks', () => {
    it('aggregates frameworks from all profiles', () => {
      mkdirSync(testRoot, { recursive: true });
      const frameworks = detectAllFrameworks(testRoot);
      expect(frameworks.length).toBeGreaterThan(0);
    });
  });

  describe('detectAllEntryPoints', () => {
    it('aggregates entry points from all profiles', () => {
      const entryPoints = detectAllEntryPoints(testRoot);
      expect(entryPoints.length).toBeGreaterThan(0);
    });
  });
});
