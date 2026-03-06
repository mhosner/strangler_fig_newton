import { join } from 'node:path';
import { readdirSync } from 'node:fs';
import type {
  MonolithProfile,
  ModernizationPlan,
  TransitionalDesign,
  MigrationPlan,
  ExtractionResult,
} from './types.js';
import type { SfnEvent } from './events.js';
import { readJsonFile, writeJsonFile, ensureDir } from './utils.js';

export class StateManager {
  constructor(private readonly stateDir: string) {}

  // -- Discovery --

  saveProfile(profile: MonolithProfile): void {
    writeJsonFile(join(this.stateDir, 'discovery', 'profile.json'), profile);
  }

  loadProfile(): MonolithProfile | null {
    return readJsonFile<MonolithProfile>(join(this.stateDir, 'discovery', 'profile.json'));
  }

  // -- Planning --

  saveModernizationPlan(plan: ModernizationPlan): void {
    writeJsonFile(join(this.stateDir, 'plans', `modernization-${plan.id}.json`), plan);
  }

  loadModernizationPlan(id: string): ModernizationPlan | null {
    return readJsonFile<ModernizationPlan>(join(this.stateDir, 'plans', `modernization-${id}.json`));
  }

  listModernizationPlans(): ModernizationPlan[] {
    const dir = join(this.stateDir, 'plans');
    ensureDir(dir);
    return readdirSync(dir)
      .filter((f) => f.startsWith('modernization-') && f.endsWith('.json'))
      .map((f) => readJsonFile<ModernizationPlan>(join(dir, f)))
      .filter((p): p is ModernizationPlan => p !== null);
  }

  // -- Scaffolding --

  saveTransitionalDesign(design: TransitionalDesign): void {
    writeJsonFile(join(this.stateDir, 'scaffolding', `design-${design.id}.json`), design);
  }

  loadTransitionalDesign(id: string): TransitionalDesign | null {
    return readJsonFile<TransitionalDesign>(join(this.stateDir, 'scaffolding', `design-${id}.json`));
  }

  // -- Migration --

  saveMigrationPlan(plan: MigrationPlan): void {
    writeJsonFile(join(this.stateDir, 'migration', `plan-${plan.id}.json`), plan);
  }

  loadMigrationPlan(id: string): MigrationPlan | null {
    return readJsonFile<MigrationPlan>(join(this.stateDir, 'migration', `plan-${id}.json`));
  }

  listMigrationPlans(): MigrationPlan[] {
    const dir = join(this.stateDir, 'migration');
    ensureDir(dir);
    return readdirSync(dir)
      .filter((f) => f.startsWith('plan-') && f.endsWith('.json'))
      .map((f) => readJsonFile<MigrationPlan>(join(dir, f)))
      .filter((p): p is MigrationPlan => p !== null);
  }

  saveExtractionResult(result: ExtractionResult): void {
    writeJsonFile(
      join(this.stateDir, 'migration', 'results', `result-${result.stepId}.json`),
      result,
    );
  }

  loadExtractionResult(stepId: string): ExtractionResult | null {
    return readJsonFile<ExtractionResult>(
      join(this.stateDir, 'migration', 'results', `result-${stepId}.json`),
    );
  }

  // -- Events --

  saveEventHistory(events: readonly SfnEvent[]): void {
    writeJsonFile(join(this.stateDir, 'events.json'), events);
  }

  loadEventHistory(): SfnEvent[] {
    return readJsonFile<SfnEvent[]>(join(this.stateDir, 'events.json')) ?? [];
  }
}
