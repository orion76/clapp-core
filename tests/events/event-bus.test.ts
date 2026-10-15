import { describe, expect, it } from '@jest/globals';

import type { IClappLifecycleMap, ILifecycle } from '@clapp/common';
import { EventBus } from '../../src/events/event-bus.js';

/**
 * Extended lifecycle map used by the bus tests. It keeps every built-in hook and
 * adds a few helpers to exercise the pipeline without touching the command
 * lifecycle.
 */
interface TTestLifecycleMap extends IClappLifecycleMap {
  tick: ILifecycle<[payload: { value: number }], { value: number }>;
  go: ILifecycle<[value: undefined], void>;
  count: ILifecycle<[value: number], void>;
  ping: ILifecycle<[value: undefined], void>;
  job: ILifecycle<[value: undefined], void>;
}

describe('EventBus', () => {
  it('delivers the arguments to all listeners', async () => {
    const bus = new EventBus<TTestLifecycleMap>();
    const seen: number[] = [];

    bus.on('tick', (payload) => void seen.push(payload.value));
    bus.on('tick', (payload) => void seen.push(payload.value * 10));

    await bus.hook('tick', { value: 2 });

    expect(seen).toEqual([2, 20]);
  });

  it('awaits asynchronous listeners in registration order', async () => {
    const bus = new EventBus<TTestLifecycleMap>();
    const order: string[] = [];

    bus.on('go', async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      order.push('slow');
    });
    bus.on('go', () => {
      order.push('fast');
    });

    await bus.hook('go', undefined);

    expect(order).toEqual(['slow', 'fast']);
  });

  it('invokes a once listener only on the first hook', async () => {
    const bus = new EventBus<TTestLifecycleMap>();
    const calls: number[] = [];

    bus.once('count', (payload) => void calls.push(payload));

    await bus.hook('count', 1);
    await bus.hook('count', 2);

    expect(calls).toEqual([1]);
  });

  it('stops delivering after off and after the returned unsubscribe', async () => {
    const bus = new EventBus<TTestLifecycleMap>();
    const calls: string[] = [];
    const first = () => void calls.push('first');
    const second = () => void calls.push('second');

    bus.on('ping', first);
    const unsubscribe = bus.on('ping', second);
    bus.off('ping', first);

    await bus.hook('ping', undefined);
    unsubscribe();
    await bus.hook('ping', undefined);

    expect(calls).toEqual(['second']);
  });

  it('runs the remaining listeners and rethrows a single failure', async () => {
    const bus = new EventBus<TTestLifecycleMap>();
    const calls: string[] = [];
    const failure = new Error('boom');

    bus.on('job', () => {
      calls.push('first');
      throw failure;
    });
    bus.on('job', () => void calls.push('second'));

    await expect(bus.hook('job', undefined)).rejects.toBe(failure);
    expect(calls).toEqual(['first', 'second']);
  });

  it('aggregates multiple failures into AggregateError', async () => {
    const bus = new EventBus<TTestLifecycleMap>();

    bus.on('job', () => {
      throw new Error('one');
    });
    bus.on('job', () => {
      throw new Error('two');
    });

    await expect(bus.hook('job', undefined)).rejects.toBeInstanceOf(AggregateError);
  });

  it('resolves the initial value when no listener is registered', async () => {
    const bus = new EventBus<TTestLifecycleMap>();

    await expect(bus.hook('tick', { value: 1 })).resolves.toEqual({ value: 1 });
  });

  it('pipes the value through listeners and resolves the transformed result', async () => {
    const bus = new EventBus<TTestLifecycleMap>();
    const initial = { value: 1 };
    const transformed = { value: 2 };

    bus.on('tick', (payload) => void expect(payload).toEqual(initial));
    bus.on('tick', () => transformed);

    await expect(bus.hook('tick', initial)).resolves.toBe(transformed);
  });

  it('keeps the current state when a listener returns void', async () => {
    const bus = new EventBus<TTestLifecycleMap>();
    const initial = { value: 1 };
    const seen: number[] = [];

    bus.on('tick', (payload) => void seen.push(payload.value));
    bus.on('tick', () => ({ value: 2 }));
    bus.on('tick', (payload) => void seen.push(payload.value));

    const result = await bus.hook('tick', initial);

    expect(result).toEqual({ value: 2 });
    expect(seen).toEqual([1, 2]);
  });
});
