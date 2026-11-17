import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from '@jest/globals';
import 'reflect-metadata';

import { PLUGIN_DEFINITION } from '@orion76/node-plugin';
import type { IPluginManager } from '@orion76/plugin';
import { Container, inject, injectable } from 'inversify';

import { APP_ROOT, contextToken, CWD, PLUGIN_CONTEXT_TYPE, USER_HOME } from '@clapp/common';
import type { IPluginContext, IPluginContextDefinition } from '@clapp/common';

// The context classes are not part of the public API of `@clapp/common` (only their tokens
// are), while the chain test needs the real class to exercise property injection.
import { AppRootContext } from '../../../common/src/plugins/context/app-root/app-root.context.js';
import { bindContextValues } from '../../src/bootstrap.js';

interface IContextValue {
  marker: string;
}

interface IManagerCalls {
  definitions: number;
  instances: string[];
  contexts: string[];
}

const MOCK_CONTEXT = contextToken<IContextValue>('mock-context');

function createCalls(): IManagerCalls {
  return { definitions: 0, instances: [], contexts: [] };
}

/**
 * Creates a mock context plugin that counts its resolutions and returns `value`,
 * or the result of `resolve` when a context needs to read another token.
 * @param id Id of the context plugin
 * @param value Value the context resolves to
 * @param calls Counters of the mock manager
 * @param resolve Replacement of the value computation
 */
function createMockContext<T>(
  id: string,
  value: T,
  calls: IManagerCalls,
  resolve: (() => Promise<T>) | undefined = undefined,
): IPluginContext<T> {
  const definition: IPluginContextDefinition<T> = { type: PLUGIN_CONTEXT_TYPE, id: contextToken<T>(id), label: id };

  return {
    id: definition.id,
    label: definition.label,
    type: definition.type,
    definition,
    getContext: async () => {
      calls.contexts.push(id);
      return resolve ? resolve() : value;
    },
  };
}

/**
 * Creates a plugin manager double: `getDefinitions` returns the definitions of the
 * given plugins in their order, `getInstance` counts and returns the plugin.
 * @param plugins Plugins the manager knows
 * @param calls Counters of the manager
 */
function createMockManager(plugins: IPluginContext[], calls: IManagerCalls): IPluginManager<IPluginContext> {
  const byId = new Map<string, IPluginContext>(plugins.map((plugin) => [plugin.id, plugin]));

  const requirePlugin = (id: string): IPluginContext => {
    const plugin = byId.get(id);

    if (!plugin) {
      throw new Error(`unknown plugin: ${id}`);
    }

    return plugin;
  };

  return {
    getDefinition: async (id: string) => requirePlugin(id).definition,
    getDefinitions: async () => {
      calls.definitions += 1;
      return plugins.map((plugin) => plugin.definition);
    },
    getInstance: async (id: string) => {
      calls.instances.push(id);
      return requirePlugin(id);
    },
  };
}

/** Directory of the `@clapp/core` package, wherever jest was started from. */
function resolvePackageDir(): string {
  const candidates = [process.cwd(), join(process.cwd(), 'packages/core')];

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(readFileSync(join(candidate, 'package.json'), 'utf8')) as { name?: string };

      if (parsed.name === '@clapp/core') {
        return candidate;
      }
    } catch {
      // Not a package directory, try the next candidate.
    }
  }

  throw new Error('package.json of @clapp/core not found');
}

interface IProjectTree {
  userHome: string;
  cwd: string;
  projectRoot: string;
}

const temporaryDirs: string[] = [];

/**
 * Creates a throwaway project tree under the git-ignored `tmp/` of the package: a
 * `package.json` in `project/` and a working directory nested below it.
 */
function createProjectTree(): IProjectTree {
  const tmpDir = join(resolvePackageDir(), 'tmp');
  mkdirSync(tmpDir, { recursive: true });

  const userHome = mkdtempSync(join(tmpDir, 'app-root-'));
  temporaryDirs.push(userHome);

  const projectRoot = join(userHome, 'project');
  const cwd = join(projectRoot, 'nested', 'deeper');
  mkdirSync(cwd, { recursive: true });
  writeFileSync(join(projectRoot, 'package.json'), '{ "name": "app-root-fixture" }\n');

  return { userHome, cwd, projectRoot };
}

afterAll(() => {
  for (const dir of temporaryDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('bindContextValues', () => {
  it('binds tokens lazily: nothing is created while the definitions are walked', async () => {
    const calls = createCalls();
    const container = new Container();
    const manager = createMockManager([createMockContext('mock-context', { marker: 'mock' }, calls)], calls);

    await bindContextValues(container, manager);

    expect(calls.definitions).toBe(1);
    expect(calls.instances).toEqual([]);
    expect(calls.contexts).toEqual([]);
  });

  it('resolves the plugin instance and its value once per token', async () => {
    const calls = createCalls();
    const container = new Container();
    const value: IContextValue = { marker: 'mock' };
    const manager = createMockManager([createMockContext('mock-context', value, calls)], calls);
    await bindContextValues(container, manager);

    const first = await container.getAsync<IContextValue>(MOCK_CONTEXT);
    const second = await container.getAsync<IContextValue>(MOCK_CONTEXT);

    expect(first).toBe(value);
    expect(second).toBe(first);
    expect(calls.instances).toEqual(['mock-context']);
    expect(calls.contexts).toEqual(['mock-context']);
  });

  it('injects the ready value into a consumer resolved through getAsync', async () => {
    @injectable()
    class ValueConsumer {
      @inject(MOCK_CONTEXT) value!: IContextValue;
    }

    const calls = createCalls();
    const container = new Container();
    const value: IContextValue = { marker: 'mock' };
    const manager = createMockManager([createMockContext('mock-context', value, calls)], calls);
    container.bind(ValueConsumer).toSelf();
    await bindContextValues(container, manager);

    const consumer = await container.getAsync(ValueConsumer);

    expect(consumer.value).toBe(value);
    expect(calls.instances).toEqual(['mock-context']);
  });

  it('resolves app-root through its injected cwd and user-home values', async () => {
    const tree = createProjectTree();
    const calls = createCalls();
    const container = new Container();
    const definition: IPluginContextDefinition<string> = {
      type: PLUGIN_CONTEXT_TYPE,
      id: APP_ROOT,
      label: 'App root directory',
    };
    const manager: IPluginManager<IPluginContext> = {
      getDefinition: async () => definition,
      getDefinitions: async () => {
        calls.definitions += 1;
        return [definition];
      },
      getInstance: async (id: string) => {
        calls.instances.push(id);
        // The plugin instance itself comes from the container, so the `@inject(CWD)` and
        // `@inject(USER_HOME)` fields of the real class are filled by its property injection.
        return container.getAsync(AppRootContext);
      },
    };
    container.bind(PLUGIN_DEFINITION).toConstantValue(definition);
    container.bind(AppRootContext).toSelf();
    // Same binding shape bootstrap uses for every context token: an asynchronously
    // resolved value in a singleton scope, injectable only through the async API.
    container
      .bind<unknown>(CWD)
      .toResolvedValue(async () => tree.cwd)
      .inSingletonScope();
    container
      .bind<unknown>(USER_HOME)
      .toResolvedValue(async () => tree.userHome)
      .inSingletonScope();
    await bindContextValues(container, manager);

    await expect(container.getAsync<string>(APP_ROOT)).resolves.toBe(tree.projectRoot);
    expect(calls.instances).toEqual(['app-root']);
  });

  it('refuses a synchronous resolution of a context token', async () => {
    const calls = createCalls();
    const container = new Container();
    const manager = createMockManager([createMockContext('mock-context', { marker: 'mock' }, calls)], calls);
    await bindContextValues(container, manager);

    // The value binding is asynchronous by construction: a sync `get` fails loudly instead
    // of leaking a `Promise` into a field typed as the value, so every consumer uses getAsync.
    expect(() => container.get(MOCK_CONTEXT)).toThrow(/Unexpected asynchronous service/);
  });

  it('resolves a context that reads another token of the same definition set', async () => {
    const calls = createCalls();
    const container = new Container();
    const baseContext = contextToken<IContextValue>('base-context');
    const dependentContext = contextToken<IContextValue>('dependent-context');
    const dependent = createMockContext('dependent-context', { marker: 'dependent' }, calls, async () => {
      const baseValue = await container.getAsync<IContextValue>(baseContext);

      return { marker: `dependent:${baseValue.marker}` };
    });
    const base = createMockContext('base-context', { marker: 'base' }, calls);
    // The dependent context is declared first: every binding is registered before the first
    // resolution, so the declaration order does not matter.
    await bindContextValues(container, createMockManager([dependent, base], calls));

    await expect(container.getAsync<IContextValue>(dependentContext)).resolves.toEqual({ marker: 'dependent:base' });
    await expect(container.getAsync<IContextValue>(baseContext)).resolves.toEqual({ marker: 'base' });
  });

  it('rejects with the error thrown by a context value', async () => {
    const calls = createCalls();
    const container = new Container();
    const failing = createMockContext('failing-context', undefined, calls, async () => {
      throw new Error('boom');
    });
    await bindContextValues(container, createMockManager([failing], calls));

    await expect(container.getAsync(contextToken<IContextValue>('failing-context'))).rejects.toThrow('boom');
  });
});
