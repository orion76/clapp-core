import type { IPluginManager } from '@orion76/node-plugin';
import { inject, injectable } from 'inversify';

import type { IPluginContext, IPluginContextDefinition } from '@clapp/common';

import { CONTEXT_MANAGER_TOKEN } from '../constants/tokens';

/**
 * Specialized DI container for application contexts: a core service (a facade
 * over the context plugin manager), not a plugin. The plugin loader never
 * discovers it, therefore it lives in `src/` (`src/context`), not in `plugins/`.
 *
 * The contexts it resolves are plugins of type `PLUGIN_CONTEXT_TYPE` living in
 * `packages/core/src/plugins/context/plugins/**`.
 *
 * `get(id)` resolves the context plugin, satisfies its `dependencies` (other
 * context ids) and passes the dependency **values** to `getContext(...)` in
 * `dependencies` order. Non-context dependencies are injected through DI.
 *
 * Resolved context values are cached in `_resolved` (a Map of values, not
 * plugin instances): a repeated `get(id)` returns the cached value without
 * recreating the context. Cache refresh is out of scope.
 */
@injectable()
export class AppContext {
  private readonly _resolved = new Map<string, unknown>();

  @inject(CONTEXT_MANAGER_TOKEN)
  private readonly _pluginManager!: IPluginManager<IPluginContext>;

  /**
   * Resolves the context plugin with the given id, satisfying its context
   * dependencies first, and returns its cached value.
   * @template T Resolved context value type
   * @param id Context id
   */
  async get<T = unknown>(id: string): Promise<T> {
    if (this._resolved.has(id)) {
      return this._resolved.get(id) as T;
    }

    const definition = await this._pluginManager.getDefinition(id);
    await this._resolveDependencies(definition);

    const value = await this._getContext<T>(id);
    this._resolved.set(id, value);
    return value;
  }

  /**
   * Creates every dependency context (if not already resolved) and caches its
   * value. The actual values are later passed to `getContext(...)` in
   * `dependencies` order.
   * @param definition Definition of the context whose dependencies to resolve
   */
  private async _resolveDependencies({ dependencies }: IPluginContextDefinition): Promise<void> {
    if (dependencies) {
      await Promise.all(dependencies.map((id) => this.get<unknown>(id)));
    }
  }

  /**
   * Builds the context value by instantiating the context plugin and calling
   * `getContext(...)` with the values of its context dependencies in order.
   * @template T Resolved context value type
   * @param id Context id
   */
  private async _getContext<T>(id: string): Promise<T> {
    const plugin = await this._pluginManager.getInstance(id);
    const dependencies = plugin.definition.dependencies;
    const args = dependencies ? await this._getDependenciesValues(dependencies) : [];
    return plugin.getContext(...(args as never[])) as T;
  }

  /**
   * Resolves the values of the given context dependencies in order. Every
   * dependency is looked up in `_resolved` or created and cached there.
   * @param dependencies Context dependency ids
   */
  private async _getDependenciesValues(dependencies: string[]): Promise<unknown[]> {
    return Promise.all(dependencies.map((id) => this.get<unknown>(id)));
  }
}
