import type {
  MonolithProfile,
  SliceCandidate,
  TransitionalDesign,
  MigrationStep,
  ExecutableSpec,
  DivergenceReport,
} from './types.js';

// ============================================================
// Event Definitions (discriminated union)
// ============================================================

interface BaseEvent {
  timestamp: string;
}

export interface DiscoveryCompleteEvent extends BaseEvent {
  type: 'DiscoveryComplete';
  profileId: string;
  languageCount: number;
  chunkCount: number;
}

export interface PlanApprovedEvent extends BaseEvent {
  type: 'PlanApproved';
  planId: string;
  sliceName: string;
}

export interface ScaffoldingDesignedEvent extends BaseEvent {
  type: 'ScaffoldingDesigned';
  designId: string;
  patternCount: number;
}

export interface MigrationStepStartedEvent extends BaseEvent {
  type: 'MigrationStepStarted';
  planId: string;
  stepId: string;
  stepName: string;
}

export interface MigrationStepCompletedEvent extends BaseEvent {
  type: 'MigrationStepCompleted';
  planId: string;
  stepId: string;
  success: boolean;
}

export interface SpecsGeneratedEvent extends BaseEvent {
  type: 'SpecsGenerated';
  planId: string;
  specCount: number;
}

export interface TestsPassingEvent extends BaseEvent {
  type: 'TestsPassing';
  planId: string;
  passCount: number;
  totalCount: number;
}

export interface ParallelRunStartedEvent extends BaseEvent {
  type: 'ParallelRunStarted';
  planId: string;
  oldEndpoint: string;
  newEndpoint: string;
}

export interface DivergenceDetectedEvent extends BaseEvent {
  type: 'DivergenceDetected';
  planId: string;
  divergenceRate: number;
}

export interface CutoverCompleteEvent extends BaseEvent {
  type: 'CutoverComplete';
  planId: string;
  serviceName: string;
}

export interface RollbackInitiatedEvent extends BaseEvent {
  type: 'RollbackInitiated';
  planId: string;
  stepId: string;
  reason: string;
}

export type SfnEvent =
  | DiscoveryCompleteEvent
  | PlanApprovedEvent
  | ScaffoldingDesignedEvent
  | MigrationStepStartedEvent
  | MigrationStepCompletedEvent
  | SpecsGeneratedEvent
  | TestsPassingEvent
  | ParallelRunStartedEvent
  | DivergenceDetectedEvent
  | CutoverCompleteEvent
  | RollbackInitiatedEvent;

// ============================================================
// EventBus
// ============================================================

type EventHandler<T extends SfnEvent = SfnEvent> = (event: T) => void;

export class EventBus {
  private handlers = new Map<string, EventHandler[]>();
  private eventHistory: SfnEvent[] = [];

  on<T extends SfnEvent>(eventType: T['type'], handler: EventHandler<T>): void {
    const existing = this.handlers.get(eventType) ?? [];
    existing.push(handler as EventHandler);
    this.handlers.set(eventType, existing);
  }

  emit(event: SfnEvent): void {
    this.eventHistory.push(event);
    const handlers = this.handlers.get(event.type) ?? [];
    for (const handler of handlers) {
      handler(event);
    }
  }

  history(): readonly SfnEvent[] {
    return this.eventHistory;
  }

  loadHistory(events: SfnEvent[]): void {
    this.eventHistory = [...events];
  }

  clear(): void {
    this.eventHistory = [];
    this.handlers.clear();
  }
}
