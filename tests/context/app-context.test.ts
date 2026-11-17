import { describe, expect, it } from '@jest/globals';
import 'reflect-metadata';

import { Container } from 'inversify';

import {
  AppContext,
  CONTEXT_MANAGER_TOKEN,
  contextToken,
  getContextTokenId,
  IContextService,
  IPluginContext,
  IPluginContextDefinition,
  PLUGIN_CONTEXT_TYPE,
  USER_HOME,
  type TContextIdentifier,
} from '@clapp/common';
import type { IPluginManager } from '@orion76/plugin';

interface IContextValue {
  marker: string;
}

/**
 * Mock tokens: their runtime value is a unique symbol whose description is the
 * id of the context plugin, so the mock manager can be keyed by plain ids.
 */
const MOCK_APP_ROOT = contextToken<IContextValue>('app-root');
const MOCK_CWD = contextToken<IContextValue>('cwd');
const MOCK_USER_HOME = contextToken<IContextValue>('user-home');
const MOCK_PROCESS = contextToken<IContextValue>('process');
const MOCK_BOOM = contextToken<IContextValue>('boom');

// --- Type-level locks (compiled, never executed) -----------------------------
function typeLocks(): void {
  const svc = undefined as unknown as IContextService;

  // get(APP_ROOT-style token) resolves to the token value type without an explicit generic.
  const userHomeValue: Promise<string> = svc.get(USER_HOME);
  // A plain string is NOT a valid token (the token is a branded symbol).
  // @ts-expect-error plain string is not assignable to TContextIdentifier<string>
  const plainStringValue = svc.get('user-home');

  void userHomeValue;
  void plainStringValue;
}

void typeLocks;

interface IMockContext<T> {
  plugin: IPluginContext<T>;
  calls: () => number;
  received: () => unknown[];
  args: () => unknown[];
}

/**
 * Creates a mock context plugin that pulls the values of its dependencies from
 * the given context service, the way the real contexts do, and records how many
 * times `getContext` has been called, the pulled values and the arguments it
 * received.
 * @param id Id of the context plugin
 * @param value Value the context resolves to
 * @param service Context service the dependencies are pulled from
 * @param dependencies Tokens of the values the context pulls
 */
function createMockContext<T = IContextValue>(
  id: string,
  value: T,
  service: IContextService,
  dependencies: readonly TContextIdentifier<unknown>[] = [],
): IMockContext<T> {
  let callCount = 0;
  let receivedValues: unknown[] = [];
  let receivedArgs: unknown[] = [];
  const plugin: IPluginContext<T> = {
    id,
    label: id,
    type: PLUGIN_CONTEXT_TYPE,
    definition: { type: PLUGIN_CONTEXT_TYPE, id, label: id } as IPluginContextDefinition,
    getContext: async (...args: unknown[]) => {
      callCount += 1;
      receivedArgs = args;
      receivedValues = await Promise.all(dependencies.map((token) => service.get(token)));
      return value;
    },
  };
  return {
    plugin,
    calls: () => callCount,
    received: () => receivedValues,
    args: () => receivedArgs,
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
  it('resolves the pull chain: a context reads its dependencies through the context service itself', async () => {
    const plugins: Record<string, IPluginContext> = {};
    const appContext = createAppContext(createMockManager(plugins));

    const processCtx = createMockContext('process', { marker: 'process' }, appContext);
    const cwdCtx = createMockContext('cwd', { marker: 'cwd' }, appContext, [MOCK_PROCESS]);
    const userHomeCtx = createMockContext('user-home', { marker: 'user-home' }, appContext);
    const appRootCtx = createMockContext('app-root', { marker: 'app-root' }, appContext, [MOCK_CWD, MOCK_USER_HOME]);

    Object.assign(plugins, {
      process: processCtx.plugin,
      cwd: cwdCtx.plugin,
      'user-home': userHomeCtx.plugin,
      'app-root': appRootCtx.plugin,
    });

    const result = await appContext.get(MOCK_APP_ROOT);

    expect(result).toEqual({ marker: 'app-root' });
    // `app-root` pulls [cwdValue, userHomeValue] in the declared token order.
    expect(appRootCtx.received()).toEqual([{ marker: 'cwd' }, { marker: 'user-home' }]);
    // `cwd` pulls [processValue].
    expect(cwdCtx.received()).toEqual([{ marker: 'process' }]);
    expect(processCtx.received()).toEqual([]);
    // The pull model passes no positional arguments to `getContext`.
    expect(appRootCtx.args()).toEqual([]);
    expect(cwdCtx.args()).toEqual([]);
  });

  it('returns the same cached value and does not recreate contexts on repeated get', async () => {
    const plugins: Record<string, IPluginContext> = {};
    const appContext = createAppContext(createMockManager(plugins));

    const processCtx = createMockContext('process', { marker: 'process' }, appContext);
    const cwdCtx = createMockContext('cwd', { marker: 'cwd' }, appContext, [MOCK_PROCESS]);
    const appRootCtx = createMockContext('app-root', { marker: 'app-root' }, appContext, [MOCK_CWD]);

    Object.assign(plugins, {
      process: processCtx.plugin,
      cwd: cwdCtx.plugin,
      'app-root': appRootCtx.plugin,
    });

    const first = await appContext.get(MOCK_APP_ROOT);
    const second = await appContext.get(MOCK_APP_ROOT);

    expect(second).toBe(first);
    expect(processCtx.calls()).toBe(1);
    expect(cwdCtx.calls()).toBe(1);
    expect(appRootCtx.calls()).toBe(1);
  });

  it('returns a cached value when a context with no dependencies is requested twice', async () => {
    const plugins: Record<string, IPluginContext> = {};
    const appContext = createAppContext(createMockManager(plugins));
    const processCtx = createMockFn('process', appContext);

    plugins.process = processCtx.plugin;

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

  it('addresses a context plugin by the id carried in the token description', async () => {
    expect(typeof MOCK_CWD).toBe('symbol');
    expect(getContextTokenId(MOCK_CWD)).toBe('cwd');
    expect(getContextTokenId(USER_HOME)).toBe('user-home');
    // The token itself is never the string id of the plugin.
    expect(MOCK_CWD as unknown).not.toBe('cwd');
    // Two tokens declared with the same id stay distinct: symbols never collide.
    expect(contextToken<IContextValue>('cwd')).not.toBe(MOCK_CWD);
    expect(() => getContextTokenId(Symbol('') as TContextIdentifier<unknown>)).toThrow('Context token has no plugin id');
  });
});

function createMockFn<T>(id: string, service: IContextService): IMockContext<T> {
  return createMockContext<T>(id, { marker: id } as T, service);
}
