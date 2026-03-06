import { readdirSync, statSync, realpathSync } from 'node:fs';
import { join, basename } from 'node:path';
import type { MonolithProfile, CodeChunk, SupportedLanguage } from '../core/types.js';
import { generateId } from '../core/utils.js';

const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'target', 'bin', 'obj',
  '.idea', '.vscode', '__pycache__', '.tox', 'venv', '.venv',
]);

export class CodebaseChunker {
  chunk(rootPath: string, profile: MonolithProfile): CodeChunk[] {
    const primaryLanguage = this.getPrimaryLanguage(profile);
    const moduleDirs = this.findModuleRoots(rootPath, primaryLanguage);

    return moduleDirs.map((dir) => {
      const fileCount = this.countFiles(dir);
      return {
        id: generateId(),
        path: dir,
        name: basename(dir),
        fileCount,
        estimatedComplexity: this.estimateComplexity(fileCount),
        description: `Module at ${dir} (${fileCount} files)`,
        language: primaryLanguage,
      };
    });
  }

  private getPrimaryLanguage(profile: MonolithProfile): SupportedLanguage {
    if (profile.detectedLanguages.length === 0) return 'node';
    return profile.detectedLanguages.reduce((a, b) =>
      a.confidence > b.confidence ? a : b
    ).language;
  }

  private findModuleRoots(rootPath: string, language: SupportedLanguage): string[] {
    const roots: string[] = [];
    const moduleMarkers = this.getModuleMarkers(language);
    const extensionMarkers = this.getExtensionMarkers(language);

    this.walkShallow(rootPath, (dirPath, depth) => {
      if (depth > 3) return false;
      const entries = readdirSync(dirPath).filter((e) => !IGNORE_DIRS.has(e));

      const isModule = moduleMarkers.some((marker) => entries.includes(marker))
        || extensionMarkers.some((ext) => entries.some((e) => e.endsWith(ext)));
      if (isModule && dirPath !== rootPath) {
        roots.push(dirPath);
        return false; // don't recurse into module children
      }
      return true; // continue recursion
    });

    if (roots.length === 0) {
      roots.push(rootPath);
    }

    return roots;
  }

  private getModuleMarkers(language: SupportedLanguage): string[] {
    switch (language) {
      case 'java': return ['pom.xml', 'build.gradle', 'build.gradle.kts'];
      case 'node': return ['package.json'];
      case 'python': return ['setup.py', 'pyproject.toml', '__init__.py'];
      case 'dotnet': return [];
    }
  }

  private getExtensionMarkers(language: SupportedLanguage): string[] {
    switch (language) {
      case 'dotnet': return ['.csproj'];
      default: return [];
    }
  }

  private walkShallow(
    dir: string,
    visitor: (dirPath: string, depth: number) => boolean,
    depth = 0,
  ): void {
    if (!visitor(dir, depth)) return;

    try {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        if (IGNORE_DIRS.has(entry)) continue;
        const fullPath = join(dir, entry);
        try {
          if (statSync(fullPath).isDirectory()) {
            this.walkShallow(fullPath, visitor, depth + 1);
          }
        } catch {
          // skip inaccessible entries
        }
      }
    } catch {
      // skip inaccessible directories
    }
  }

  private countFiles(dir: string, depth = 0, seen?: Set<string>): number {
    if (depth > 50) return 0;
    const visited = seen ?? new Set<string>();
    let realDir: string;
    try {
      realDir = realpathSync(dir);
    } catch {
      return 0;
    }
    if (visited.has(realDir)) return 0;
    visited.add(realDir);

    let count = 0;
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (IGNORE_DIRS.has(entry.name)) continue;
        if (entry.isFile()) count++;
        else if (entry.isDirectory()) count += this.countFiles(join(dir, entry.name), depth + 1, visited);
      }
    } catch {
      // skip inaccessible
    }
    return count;
  }

  private estimateComplexity(fileCount: number): 'low' | 'medium' | 'high' {
    if (fileCount < 20) return 'low';
    if (fileCount < 100) return 'medium';
    return 'high';
  }
}
