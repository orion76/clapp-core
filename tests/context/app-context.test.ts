import { describe, expect, it } from '@jest/globals';
import 'reflect-metadata';

import { Container } from 'inversify';

import {
  AppContext,
  CONTEXT_MANAGER_TOKEN,
  contextToken,
  IContextService,
  IPluginContext,
  IPluginContextDefinition,
  PLUGIN_CONTEXT_TYPE,
  USER_HOME,
} from '@clapp/common';
import type { IPluginManager } from '@orion76/plugin';



type ContextValue = { marker: string };

/**
 * Branded mock tokens: their runtime value is a plain id string (the phantom
 * brand carries `ContextValue`), so the mock manager can be keyed by plain ids.
 */
const MOCK_APP_ROOT = contextToken<ContextValue>('app-root');
const MOCK_CWD = contextToken<ContextValue>('cwd');
const MOCK_USER_HOME = contextToken<ContextValue>('user-home');
const MOCK_PROCESS = contextToken<ContextValue>('process');
const MOCK_BOOM = contextToken<ContextValue>('boom');

// --- Type-level locks (never executed) ---------------------------------------
declare const _svc: IContextService;
// get(APP_ROOT-style token) resolves to the token value type without explicit generic.
const _userHomeValue: Promise<string> = _svc.get(USER_HOME);
// A plain string is NOT a valid token (branded `InjectableIdentifier`).
// @ts-expect-error plain string is not assignable to InjectableIdentifier<string>
const _plainStringValue = _svc.get('user-home');

interface IMockContext<T> {
  plugin: IPluginContext<T>;
  calls: () => number;
  received: () => unknown[];
}

/**
 * Creates a mock context plugin that records how many times `getContext` has
 * been called and the arguments it received.
 */
function createMockContext<T = ContextValue>(id: string, value: T, dependencies?: string[]): IMockContext<T> {
  let callCount = 0;
  let receivedArgs: unknown[] = [];
  const plugin: IPluginContext<T> = {
    id,
    label: id,
    type: PLUGIN_CONTEXT_TYPE,
    definition: { type: PLUGIN_CONTEXT_TYPE, id, label: id, dependencies } as IPluginContextDefinition,
    getContext: async (...received: unknown[]) => {
      callCount += 1;
      receivedArgs = received;
      return value;
    },
  };
  return {
    plugin,
    calls: () => callCount,
    received: () => receivedArgs,
  };
}

function createMockManager(plugins: Record<string, IPluginContext>): IPluginManager<IPluginContext> {
  return {
    getDefinition: async (id: string) => plugins[id].definition,
    getDefinitions: async () => Object.values(plugins).map((plugin) => plugin.definition),
    getInstance: async (id: string) => plugins[id],
  };
}

/**
 * Creates an `AppContext` the same way production code does: through the
 * inversify container so that the `@inject(CONTEXT_MANAGER_TOKEN)` property
 * injection is applied.
 */
function createAppContext(manager: IPluginManager<IPluginContext>): AppContext {
  const container = new Container();
  container.bind(CONTEXT_MANAGER_TOKEN).toConstantValue(manager);
  container.bind(AppContext).toSelf();
  return container.get(AppContext);
}

describe('AppContext', () => {
  it('resolves the dependency chain and passes dependency values to getContext in order', async () => {
    const processCtx = createMockContext('process', { marker: 'process' });
    const cwdCtx = createMockContext('cwd', { marker: 'cwd' }, ['process']);
    const userHomeCtx = createMockContext('user-home', { marker: 'user-home' });
    const appRootCtx = createMockContext('app-root', { marker: 'app-root' }, ['cwd', 'user-home']);

    const manager = createMockManager({
      process: processCtx.plugin,
      cwd: cwdCtx.plugin,
      'user-home': userHomeCtx.plugin,
      'app-root': appRootCtx.plugin,
    });
    const appContext = createAppContext(manager);

    const result = await appContext.get(MOCK_APP_ROOT);

    expect(result).toEqual({ marker: 'app-root' });
    // `app-root` receives [cwdValue, userHomeValue] in dependencies order.
    expect(appRootCtx.received()).toEqual([{ marker: 'cwd' }, { marker: 'user-home' }]);
    // `cwd` receives [processValue] in dependencies order.
    expect(cwdCtx.received()).toEqual([{ marker: 'process' }]);
    expect(processCtx.received()).toEqual([]);
  });

  it('returns the same cached value and does not recreate contexts on repeated get', async () => {
    const processCtx = createMockContext('process', { marker: 'process' });
    const cwdCtx = createMockContext('cwd', { marker: 'cwd' }, ['process']);
    const appRootCtx = createMockContext('app-root', { marker: 'app-root' }, ['cwd']);

    const manager = createMockManager({
      process: processCtx.plugin,
      cwd: cwdCtx.plugin,
      'app-root': appRootCtx.plugin,
    });
    const appContext = createAppContext(manager);

    const first = await appContext.get(MOCK_APP_ROOT);
    const second = await appContext.get(MOCK_APP_ROOT);

    expect(second).toBe(first);
    expect(processCtx.calls()).toBe(1);
    expect(cwdCtx.calls()).toBe(1);
    expect(appRootCtx.calls()).toBe(1);
  });

  it('returns a cached value when a context with no dependencies is requested twice', async () => {
    const processCtx = createMockFn('process');
    const manager = createMockManager({ process: processCtx.plugin });
    const appContext = createAppContext(manager);

    const first = await appContext.get(MOCK_PROCESS);
    const second = await appContext.get(MOCK_PROCESS);

    expect(second).toBe(first);
    expect(processCtx.calls()).toBe(1);
  });

  it('rethrows context getContext failures', async () => {
    const failing: IPluginContext<never> = {
      id: 'boom',
      label: 'boom',
      type: PLUGIN_CONTEXT_TYPE,
      definition: { type: PLUGIN_CONTEXT_TYPE, id: 'boom', label: 'boom' },
      getContext: async () => {
        throw new Error('boom');
      },
    };
    const manager = createMockManager({ boom: failing });
    const appContext = createAppContext(manager);

    await expect(appContext.get(MOCK_BOOM)).rejects.toThrow('boom');
  });
});

function createMockFn<T>(id: string): IMockContext<T> {
  return createMockContext<T>(id, { marker: id } as T);
}
