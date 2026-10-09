import { injectable } from 'inversify';

import type { IClappEventMap, IEventBus, TListener } from '@clapp/common';

/**
 * Default asynchronous event bus. Listeners are awaited sequentially in
 * registration order, so `emit` resolves only after every listener settled.
 * Listener failures do not stop the remaining listeners: they are collected
 * and re-thrown after the whole batch.
 * @template E Event map
 */
@injectable()
export class EventBus<E extends object = IClappEventMap> implements IEventBus<E> {
  private readonly _listeners = new Map<string, Set<TListener<unknown>>>();

  async emit<K extends keyof E & string>(event: K, payload: E[K]): Promise<void> {
    const listeners = this._listeners.get(event);
    if (!listeners || listeners.size === 0) {
      return;
    }

    const errors: unknown[] = [];
    for (const listener of [...listeners]) {
      try {
        await listener(payload);
      } catch (error) {
        errors.push(error);
      }
    }

    if (errors.length === 1) {
      throw errors[0];
    }
    if (errors.length > 1) {
      throw new AggregateError(errors, `Event "${event}" listeners failed`);
    }
  }

  on<K extends keyof E & string>(event: K, listener: TListener<E[K]>): () => void {
    let listeners = this._listeners.get(event);
    if (!listeners) {
      listeners = new Set();
      this._listeners.set(event, listeners);
    }
    listeners.add(listener as TListener<unknown>);
    return () => this.off(event, listener);
  }

  once<K extends keyof E & string>(event: K, listener: TListener<E[K]>): () => void {
    const wrapper: TListener<E[K]> = (payload) => {
      this.off(event, wrapper);
      return listener(payload);
    };
    return this.on(event, wrapper);
  }

  off<K extends keyof E & string>(event: K, listener: TListener<E[K]>): void {
    const listeners = this._listeners.get(event);
    if (!listeners) {
      return;
    }
    listeners.delete(listener as TListener<unknown>);
    if (listeners.size === 0) {
      this._listeners.delete(event);
    }
  }
}
