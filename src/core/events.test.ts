import { describe, it, expect, vi } from 'vitest';
import { EventBus } from './events.js';
import type { SfnEvent, DiscoveryCompleteEvent, PlanApprovedEvent } from './events.js';

function makeEvent(type: string, extra: Record<string, unknown> = {}): SfnEvent {
  return { type, timestamp: '2026-01-01T00:00:00.000Z', ...extra } as SfnEvent;
}

describe('EventBus', () => {
  it('emits events to registered handlers', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('DiscoveryComplete', handler);

    const event = makeEvent('DiscoveryComplete', {
      profileId: 'p1',
      languageCount: 2,
      chunkCount: 5,
    });
    bus.emit(event);

    expect(handler).toHaveBeenCalledWith(event);
  });

  it('does not call handlers for other event types', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('PlanApproved', handler);

    bus.emit(makeEvent('DiscoveryComplete', { profileId: 'p1', languageCount: 1, chunkCount: 1 }));
    expect(handler).not.toHaveBeenCalled();
  });

  it('supports multiple handlers for the same event type', () => {
    const bus = new EventBus();
    const h1 = vi.fn();
    const h2 = vi.fn();
    bus.on('PlanApproved', h1);
    bus.on('PlanApproved', h2);

    const event = makeEvent('PlanApproved', { planId: 'x', sliceName: 'y' });
    bus.emit(event);

    expect(h1).toHaveBeenCalledOnce();
    expect(h2).toHaveBeenCalledOnce();
  });

  it('records event history', () => {
    const bus = new EventBus();
    const e1 = makeEvent('DiscoveryComplete', { profileId: 'p1', languageCount: 1, chunkCount: 1 });
    const e2 = makeEvent('PlanApproved', { planId: 'x', sliceName: 'y' });

    bus.emit(e1);
    bus.emit(e2);

    expect(bus.history()).toEqual([e1, e2]);
  });

  it('loads history from external source', () => {
    const bus = new EventBus();
    const events = [
      makeEvent('PlanApproved', { planId: 'a', sliceName: 'b' }),
    ];
    bus.loadHistory(events);
    expect(bus.history()).toEqual(events);
  });

  it('loadHistory does not share array reference', () => {
    const bus = new EventBus();
    const events = [makeEvent('PlanApproved', { planId: 'a', sliceName: 'b' })];
    bus.loadHistory(events);
    events.push(makeEvent('PlanApproved', { planId: 'c', sliceName: 'd' }));
    expect(bus.history().length).toBe(1);
  });

  it('clear removes all handlers and history', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('PlanApproved', handler);
    bus.emit(makeEvent('PlanApproved', { planId: 'x', sliceName: 'y' }));

    bus.clear();

    expect(bus.history()).toEqual([]);
    bus.emit(makeEvent('PlanApproved', { planId: 'x', sliceName: 'y' }));
    expect(handler).toHaveBeenCalledTimes(1); // only the first call
  });
});
