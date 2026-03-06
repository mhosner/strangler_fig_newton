import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { LanguageDetection, FrameworkDetection, EntryPoint } from '../../core/types.js';
import type { LanguageProfile } from './index.js';

export const javaSpringProfile: LanguageProfile = {
  language: 'java',
  importPattern: /^import\s+[\w.]+;/,
  modulePatterns: ['**/src/main/java/**', '**/pom.xml', '**/build.gradle'],

  detect(rootPath: string): LanguageDetection {
    const indicators: string[] = [];
    let confidence = 0;

    if (existsSync(join(rootPath, 'pom.xml'))) {
      indicators.push('pom.xml found (Maven project)');
      confidence += 0.4;
    }
    if (existsSync(join(rootPath, 'build.gradle')) || existsSync(join(rootPath, 'build.gradle.kts'))) {
      indicators.push('build.gradle found (Gradle project)');
      confidence += 0.4;
    }
    if (existsSync(join(rootPath, 'src', 'main', 'java'))) {
      indicators.push('src/main/java directory structure');
      confidence += 0.3;
    }

    return { language: 'java', confidence: Math.min(confidence, 1), indicators };
  },

  detectFrameworks(rootPath: string): FrameworkDetection[] {
    const frameworks: FrameworkDetection[] = [];

    if (existsSync(join(rootPath, 'src', 'main', 'resources', 'application.properties')) ||
        existsSync(join(rootPath, 'src', 'main', 'resources', 'application.yml'))) {
      frameworks.push({
        framework: 'spring-boot',
        indicators: ['application.properties/yml found'],
      });
    }

    if (existsSync(join(rootPath, 'src', 'main', 'webapp', 'WEB-INF', 'web.xml'))) {
      frameworks.push({
        framework: 'java-ee',
        indicators: ['WEB-INF/web.xml found'],
      });
    }

    return frameworks;
  },

  detectEntryPoints(_rootPath: string): EntryPoint[] {
    // Entry point detection requires file content scanning — returns hints for Claude
    return [
      {
        filePath: '**/Application.java',
        type: 'main',
        description: 'Look for @SpringBootApplication or public static void main',
      },
      {
        filePath: '**/*Controller.java',
        type: 'http-controller',
        description: 'Look for @RestController or @Controller annotations',
      },
      {
        filePath: '**/*Listener.java',
        type: 'event-handler',
        description: 'Look for @KafkaListener, @JmsListener, @RabbitListener',
      },
      {
        filePath: '**/*Scheduler.java',
        type: 'scheduled',
        description: 'Look for @Scheduled annotations',
      },
    ];
  },
};
