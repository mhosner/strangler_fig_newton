import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { LanguageDetection, FrameworkDetection, EntryPoint } from '../../core/types.js';
import type { LanguageProfile } from './index.js';

export const nodeProfile: LanguageProfile = {
  language: 'node',
  importPattern: /^(?:import\s+.+\s+from\s+|(?:const|let|var)\s+.+=\s*require\()/,
  modulePatterns: ['**/package.json', '**/src/**/*.ts', '**/src/**/*.js'],

  detect(rootPath: string): LanguageDetection {
    const indicators: string[] = [];
    let confidence = 0;

    if (existsSync(join(rootPath, 'package.json'))) {
      indicators.push('package.json found');
      confidence += 0.5;
    }
    if (existsSync(join(rootPath, 'tsconfig.json'))) {
      indicators.push('tsconfig.json found (TypeScript project)');
      confidence += 0.2;
    }
    if (existsSync(join(rootPath, 'node_modules'))) {
      indicators.push('node_modules directory present');
      confidence += 0.2;
    }

    return { language: 'node', confidence: Math.min(confidence, 1), indicators };
  },

  detectFrameworks(rootPath: string): FrameworkDetection[] {
    const frameworks: FrameworkDetection[] = [];

    const nestIndicators = [
      join(rootPath, 'nest-cli.json'),
      join(rootPath, 'src', 'app.module.ts'),
    ];
    if (nestIndicators.some((p) => existsSync(p))) {
      frameworks.push({
        framework: 'nestjs',
        indicators: ['NestJS project structure detected'],
      });
    }

    // Express is common but harder to detect by file alone
    frameworks.push({
      framework: 'express',
      indicators: ['Check package.json dependencies for express'],
    });

    return frameworks;
  },

  detectEntryPoints(_rootPath: string): EntryPoint[] {
    return [
      {
        filePath: '**/main.ts',
        type: 'main',
        description: 'Look for NestFactory.create() or app.listen()',
      },
      {
        filePath: '**/index.ts',
        type: 'main',
        description: 'Look for app.listen() or server.start()',
      },
      {
        filePath: '**/*.controller.ts',
        type: 'http-controller',
        description: 'Look for @Controller() decorator or router.get/post',
      },
      {
        filePath: '**/*.handler.ts',
        type: 'event-handler',
        description: 'Look for message queue consumers, SQS handlers, event emitters',
      },
    ];
  },
};
