import type { SupportedLanguage, LanguageDetection, FrameworkDetection, EntryPoint } from '../../core/types.js';
import { javaSpringProfile } from './java-spring.js';
import { nodeProfile } from './node.js';
import { pythonProfile } from './python.js';
import { dotnetProfile } from './dotnet.js';

export interface LanguageProfile {
  language: SupportedLanguage;
  importPattern: RegExp;
  modulePatterns: string[];
  detect(rootPath: string): LanguageDetection;
  detectFrameworks(rootPath: string): FrameworkDetection[];
  detectEntryPoints(rootPath: string): EntryPoint[];
}

export const ALL_PROFILES: LanguageProfile[] = [
  javaSpringProfile,
  nodeProfile,
  pythonProfile,
  dotnetProfile,
];

export function detectLanguages(rootPath: string): LanguageDetection[] {
  return ALL_PROFILES
    .map((profile) => profile.detect(rootPath))
    .filter((detection) => detection.confidence > 0);
}

export function detectAllFrameworks(rootPath: string): FrameworkDetection[] {
  return ALL_PROFILES.flatMap((profile) => profile.detectFrameworks(rootPath));
}

export function detectAllEntryPoints(rootPath: string): EntryPoint[] {
  return ALL_PROFILES.flatMap((profile) => profile.detectEntryPoints(rootPath));
}
