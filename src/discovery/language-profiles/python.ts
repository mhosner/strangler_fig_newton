import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { LanguageDetection, FrameworkDetection, EntryPoint } from '../../core/types.js';
import type { LanguageProfile } from './index.js';

export const pythonProfile: LanguageProfile = {
  language: 'python',
  importPattern: /^(?:import\s+\w|from\s+\w+\s+import)/,
  modulePatterns: ['**/*.py', '**/requirements.txt', '**/pyproject.toml', '**/setup.py'],

  detect(rootPath: string): LanguageDetection {
    const indicators: string[] = [];
    let confidence = 0;

    if (existsSync(join(rootPath, 'requirements.txt'))) {
      indicators.push('requirements.txt found');
      confidence += 0.4;
    }
    if (existsSync(join(rootPath, 'pyproject.toml'))) {
      indicators.push('pyproject.toml found');
      confidence += 0.4;
    }
    if (existsSync(join(rootPath, 'setup.py'))) {
      indicators.push('setup.py found');
      confidence += 0.3;
    }
    if (existsSync(join(rootPath, 'manage.py'))) {
      indicators.push('manage.py found (Django project)');
      confidence += 0.3;
    }

    return { language: 'python', confidence: Math.min(confidence, 1), indicators };
  },

  detectFrameworks(rootPath: string): FrameworkDetection[] {
    const frameworks: FrameworkDetection[] = [];

    if (existsSync(join(rootPath, 'manage.py'))) {
      frameworks.push({
        framework: 'django',
        indicators: ['manage.py found'],
      });
    }

    // Flask/FastAPI require checking imports — provide hints
    frameworks.push({
      framework: 'flask',
      indicators: ['Check imports for flask or Flask(__name__)'],
    });
    frameworks.push({
      framework: 'fastapi',
      indicators: ['Check imports for fastapi or FastAPI()'],
    });

    return frameworks;
  },

  detectEntryPoints(_rootPath: string): EntryPoint[] {
    return [
      {
        filePath: '**/manage.py',
        type: 'cli',
        description: 'Django management command entry point',
      },
      {
        filePath: '**/wsgi.py',
        type: 'main',
        description: 'WSGI application entry point',
      },
      {
        filePath: '**/asgi.py',
        type: 'main',
        description: 'ASGI application entry point',
      },
      {
        filePath: '**/views.py',
        type: 'http-controller',
        description: 'Look for view functions or class-based views',
      },
      {
        filePath: '**/tasks.py',
        type: 'event-handler',
        description: 'Look for Celery tasks (@task, @shared_task)',
      },
    ];
  },
};
