import { injectable } from 'inversify';

import type { IClappLifecycleMap, IEventBus, THookListener, TLifecycleMapConstraint } from '@clapp/common';

import type { TAnyHookListener } from './types';

/**
 * Default asynchronous lifecycle hook bus. Listeners are awaited sequentially in
 * registration order, forming a pipeline: the first argument is the initial
 * state, a non-`void` listener return value replaces it, and `hook` resolves the
 * final state. Listener failures do not stop the remaining listeners: they are
 * collected and re-thrown after the whole batch.
 * @template M Lifecycle map
 */
@injectable()
export class EventBus<M extends TLifecycleMapConstraint<M> = IClappLifecycleMap> implements IEventBus<M> {
  private readonly _listeners = new Map<string, Set<TAnyHookListener>>();

  async hook<K extends keyof M & string>(event: K, ...args: M[K]['args']): Promise<M[K]['result']> {
    const [initial, ...rest] = args as unknown[];
    let state: unknown = initial;

    const listeners = this._listeners.get(event);
    if (!listeners || listeners.size === 0) {
      return state as M[K]['result'];
    }

    const errors: unknown[] = [];
    for (const listener of [...listeners]) {
      try {
        const result = await listener(state, ...rest);
        if (result !== undefined) {
          state = result;
        }
      } catch (error) {
        errors.push(error);
      }
    }

    if (errors.length === 1) {
      throw errors[0];
    }
    if (errors.length > 1) {
      throw new AggregateError(errors, `Hook "${event}" listeners failed`);
    }

    return state as M[K]['result'];
  }

  on<K extends keyof M & string>(event: K, listener: THookListener<M[K]>): () => void {
    let listeners = this._listeners.get(event);
    if (!listeners) {
      listeners = new Set();
      this._listeners.set(event, listeners);
    }
    listeners.add(listener as TAnyHookListener);
    return () => this.off(event, listener);
  }

  once<K extends keyof M & string>(event: K, listener: THookListener<M[K]>): () => void {
    const wrapper: THookListener<M[K]> = (...args) => {
      this.off(event, wrapper);
      return listener(...args);
    };
    return this.on(event, wrapper);
  }

  off<K extends keyof M & string>(event: K, listener: THookListener<M[K]>): void {
    const listeners = this._listeners.get(event);
    if (!listeners) {
      return;
    }
    listeners.delete(listener as TAnyHookListener);
    if (listeners.size === 0) {
      this._listeners.delete(event);
    }
  }
}
