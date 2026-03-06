import { join } from 'node:path';
import { readJsonFile } from './utils.js';

export interface LanguageAnalysisConfig {
  enabled: boolean;
  filePatterns: string[];
  confidenceThreshold: number;
}

export interface PluginConfig {
  stateDir: string;
  maxHistoryEntries: number;
  languages: Record<string, LanguageAnalysisConfig>;
  defaultStrategy: string;
  trafficDiversionStages: number[];
}

export const DEFAULT_CONFIG: PluginConfig = {
  stateDir: '.sfn',
  maxHistoryEntries: 1000,
  languages: {
    java: {
      enabled: true,
      filePatterns: ['**/*.java', '**/pom.xml', '**/build.gradle'],
      confidenceThreshold: 0.6,
    },
    node: {
      enabled: true,
      filePatterns: ['**/*.ts', '**/*.js', '**/package.json'],
      confidenceThreshold: 0.6,
    },
    python: {
      enabled: true,
      filePatterns: ['**/*.py', '**/requirements.txt', '**/pyproject.toml'],
      confidenceThreshold: 0.6,
    },
    dotnet: {
      enabled: true,
      filePatterns: ['**/*.cs', '**/*.csproj', '**/*.sln'],
      confidenceThreshold: 0.6,
    },
  },
  defaultStrategy: 'strangler-fig',
  trafficDiversionStages: [1, 5, 25, 50, 100],
};

export function loadConfig(projectRoot: string): PluginConfig {
  const configPath = join(projectRoot, '.sfn', 'config.json');
  const userConfig = readJsonFile<Partial<PluginConfig>>(configPath);
  if (!userConfig) return { ...DEFAULT_CONFIG };
  return { ...DEFAULT_CONFIG, ...userConfig };
}
