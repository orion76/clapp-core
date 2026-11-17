import { describe, expect, it } from '@jest/globals';
import 'reflect-metadata';

import { EventBus } from '@clapp/common';
import type { IClappLifecycleMap, ILifecycle, TCommandEventData } from '@clapp/common';

/**
 * Lifecycle map of the bus tests: the built-in hooks plus local ones that carry
 * their own payload, so the bus is exercised without the command lifecycle.
 */
interface ITestLifecycleMap extends IClappLifecycleMap {
  tick: ILifecycle<{ value: number }>;
  go: ILifecycle<{ label: string }>;
  count: ILifecycle<{ value: number }>;
  ping: ILifecycle<{ label: string }>;
  job: ILifecycle<{ label: string }>;
}

/**
 * Builds the `{ id, type, data }` descriptor the bus accepts in `hook`.
 * @param id Identifier of the event source; the bus passes it through untouched
 * @param data Payload handed over to the listeners
 * @returns Event descriptor carrying the payload
 */
function eventArgs<D extends {}>(id: string, data: D): TCommandEventData<D> {
  return { id, type: 'test', data };
}

describe('EventBus', () => {
  it('delivers the payload of the event to every listener', async () => {
    const bus = new EventBus<ITestLifecycleMap>();
    const seen: number[] = [];

    bus.on('tick', async (payload) => {
      seen.push(payload.value);
    });
    bus.on('tick', async (payload) => {
      seen.push(payload.value * 10);
    });

    await bus.hook('tick', eventArgs('tick', { value: 2 }));

    expect(seen).toEqual([2, 20]);
  });

  it('awaits asynchronous listeners in registration order', async () => {
    const bus = new EventBus<ITestLifecycleMap>();
    const order: string[] = [];

    bus.on('go', async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 10));
      order.push('slow');
    });
    bus.on('go', async () => {
      order.push('fast');
    });

    await bus.hook('go', eventArgs('go', { label: 'go' }));

    expect(order).toEqual(['slow', 'fast']);
  });

  it('invokes a once listener only on the first hook', async () => {
    const bus = new EventBus<ITestLifecycleMap>();
    const calls: number[] = [];

    bus.once('count', async (payload) => {
      calls.push(payload.value);
    });

    await bus.hook('count', eventArgs('count', { value: 1 }));
    await bus.hook('count', eventArgs('count', { value: 2 }));

    expect(calls).toEqual([1]);
  });

  it('stops delivering after off and after the returned unsubscribe', async () => {
    const bus = new EventBus<ITestLifecycleMap>();
    const calls: string[] = [];
    const first = async () => {
      calls.push('first');
    };
    const second = async () => {
      calls.push('second');
    };

    bus.on('ping', first);
    const unsubscribe = bus.on('ping', second);
    bus.off('ping', first);

    await bus.hook('ping', eventArgs('ping', { label: 'ping' }));
    unsubscribe();
    await bus.hook('ping', eventArgs('ping', { label: 'ping' }));

    expect(calls).toEqual(['second']);
  });

  it('runs the remaining listeners and rethrows a single failure', async () => {
    const bus = new EventBus<ITestLifecycleMap>();
    const calls: string[] = [];
    const failure = new Error('boom');

    bus.on('job', async () => {
      calls.push('first');
      throw failure;
    });
    bus.on('job', async () => {
      calls.push('second');
    });

    await expect(bus.hook('job', eventArgs('job', { label: 'job' }))).rejects.toBe(failure);
    expect(calls).toEqual(['first', 'second']);
  });

  it('aggregates multiple failures into AggregateError', async () => {
    const bus = new EventBus<ITestLifecycleMap>();

    bus.on('job', async () => {
      throw new Error('one');
    });
    bus.on('job', async () => {
      throw new Error('two');
    });

    await expect(bus.hook('job', eventArgs('job', { label: 'job' }))).rejects.toBeInstanceOf(AggregateError);
  });

  it('gives a listener the payload only, not the event descriptor', async () => {
    const bus = new EventBus<ITestLifecycleMap>();
    const received: unknown[] = [];

    bus.on('tick', async (payload) => {
      received.push(payload);
    });

    await bus.hook('tick', eventArgs('tick', { value: 3 }));

    expect(received).toEqual([{ value: 3 }]);
  });

  it('resolves undefined when no listener is registered', async () => {
    const bus = new EventBus<ITestLifecycleMap>();

    await expect(bus.hook('tick', eventArgs('tick', { value: 1 }))).resolves.toBeUndefined();
  });

  it('discards what a listener returns and resolves undefined', async () => {
    const bus = new EventBus<ITestLifecycleMap>();
    const returnsValue = async () => ({ value: 4 });

    bus.on('tick', returnsValue as unknown as (payload: { value: number }) => Promise<void>);

    await expect(bus.hook('tick', eventArgs('tick', { value: 1 }))).resolves.toBeUndefined();
  });
});
