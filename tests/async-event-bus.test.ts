import { EventBus } from '../src/events/event-bus.js';

describe('EventBus', () => {
  it('delivers the payload to all listeners', async () => {
    const bus = new EventBus<Record<string, { value: number }>>();
    const seen: number[] = [];

    bus.on('tick', (payload) => void seen.push(payload.value));
    bus.on('tick', (payload) => void seen.push(payload.value * 10));

    await bus.emit('tick', { value: 2 });

    expect(seen).toEqual([2, 20]);
  });

  it('awaits asynchronous listeners in registration order', async () => {
    const bus = new EventBus<Record<string, void>>();
    const order: string[] = [];

    bus.on('go', async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      order.push('slow');
    });
    bus.on('go', () => {
      order.push('fast');
    });

    await bus.emit('go', undefined);

    expect(order).toEqual(['slow', 'fast']);
  });

  it('invokes a once listener only on the first emit', async () => {
    const bus = new EventBus<Record<string, number>>();
    const calls: number[] = [];

    bus.once('count', (payload) => void calls.push(payload));

    await bus.emit('count', 1);
    await bus.emit('count', 2);

    expect(calls).toEqual([1]);
  });

  it('stops delivering after off and after the returned unsubscribe', async () => {
    const bus = new EventBus<Record<string, void>>();
    const calls: string[] = [];
    const first = () => void calls.push('first');
    const second = () => void calls.push('second');

    bus.on('ping', first);
    const unsubscribe = bus.on('ping', second);
    bus.off('ping', first);

    await bus.emit('ping', undefined);
    unsubscribe();
    await bus.emit('ping', undefined);

    expect(calls).toEqual(['second']);
  });

  it('runs the remaining listeners and rethrows a single failure', async () => {
    const bus = new EventBus<Record<string, void>>();
    const calls: string[] = [];
    const failure = new Error('boom');

    bus.on('job', () => {
      calls.push('first');
      throw failure;
    });
    bus.on('job', () => void calls.push('second'));

    await expect(bus.emit('job', undefined)).rejects.toBe(failure);
    expect(calls).toEqual(['first', 'second']);
  });

  it('aggregates multiple failures into AggregateError', async () => {
    const bus = new EventBus<Record<string, void>>();

    bus.on('job', () => {
      throw new Error('one');
    });
    bus.on('job', () => {
      throw new Error('two');
    });

    await expect(bus.emit('job', undefined)).rejects.toBeInstanceOf(AggregateError);
  });

  it('resolves when no listener is registered', async () => {
    const bus = new EventBus<Record<string, void>>();

    await expect(bus.emit('unknown', undefined)).resolves.toBeUndefined();
  });
});
