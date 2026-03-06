import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { LanguageDetection, FrameworkDetection, EntryPoint } from '../../core/types.js';
import type { LanguageProfile } from './index.js';

export const dotnetProfile: LanguageProfile = {
  language: 'dotnet',
  importPattern: /^using\s+[\w.]+;/,
  modulePatterns: ['**/*.cs', '**/*.csproj', '**/*.sln'],

  detect(rootPath: string): LanguageDetection {
    const indicators: string[] = [];
    let confidence = 0;

    const hasSln = readdirSync(rootPath).some((f) => f.endsWith('.sln'));
    if (hasSln) {
      indicators.push('.sln file found (Visual Studio solution)');
      confidence += 0.5;
    }

    const hasCsproj = readdirSync(rootPath).some((f) => f.endsWith('.csproj'));
    if (hasCsproj) {
      indicators.push('.csproj file found');
      confidence += 0.4;
    }

    if (existsSync(join(rootPath, 'Program.cs'))) {
      indicators.push('Program.cs found');
      confidence += 0.3;
    }

    if (existsSync(join(rootPath, 'global.json'))) {
      indicators.push('global.json found (.NET SDK config)');
      confidence += 0.2;
    }

    return { language: 'dotnet', confidence: Math.min(confidence, 1), indicators };
  },

  detectFrameworks(rootPath: string): FrameworkDetection[] {
    const frameworks: FrameworkDetection[] = [];

    if (existsSync(join(rootPath, 'Startup.cs')) || existsSync(join(rootPath, 'Program.cs'))) {
      frameworks.push({
        framework: 'aspnet',
        indicators: ['Startup.cs or Program.cs with WebApplication pattern'],
      });
    }

    if (existsSync(join(rootPath, 'Web.config'))) {
      frameworks.push({
        framework: 'aspnet-framework',
        indicators: ['Web.config found (legacy ASP.NET Framework)'],
      });
    }

    return frameworks;
  },

  detectEntryPoints(_rootPath: string): EntryPoint[] {
    return [
      {
        filePath: '**/Program.cs',
        type: 'main',
        description: 'Look for WebApplication.CreateBuilder or Host.CreateDefaultBuilder',
      },
      {
        filePath: '**/*Controller.cs',
        type: 'http-controller',
        description: 'Look for [ApiController] or ControllerBase inheritance',
      },
      {
        filePath: '**/*Worker.cs',
        type: 'event-handler',
        description: 'Look for BackgroundService or IHostedService implementations',
      },
      {
        filePath: '**/*Job.cs',
        type: 'scheduled',
        description: 'Look for Hangfire, Quartz.NET, or Timer-based jobs',
      },
    ];
  },
};
