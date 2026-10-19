import { glob } from 'node:fs/promises';

import {
  InheritInjections,
  PluginException,
  PluginLoaderFromFile,
  getPluginDefinition,
  type IPluginDefinition,
} from '@orion76/node-plugin';
import { injectable } from 'inversify';

import type { IClappPluginLoaderConfig } from './types';

/**
 * File-based plugin loader of `@clapp/core`. It is a drop-in replacement for the
 * `@orion76/node-plugin` `PluginLoaderFromFile` that understands the source
 * based config of clapp (`IClappPluginLoaderConfig`): every source is globbed on
 * its own, and a definition whose id is listed in the `disabled` list of its
 * source or in the `disabled` list of the whole type is skipped **before** the
 * duplicate/conflict check. A disabled plugin therefore never registers and a
 * disabled duplicate never raises a conflict error.
 *
 * The class extends the default loader to reuse its module import (runtime
 * detection, `tsx` registration, module cache) and only replaces the discovery
 * loop; the module patterns of a source are matched separately, so a definition
 * is always associated with the disabled list of the source that provided it.
 *
 * The plugin type and the loader config arrive through the injections of the
 * base class (`PLUGIN_TYPE`, `PLUGIN_LOADER_CONFIG`); inversify reads injection
 * metadata per class, so `@InheritInjections()` above `@injectable()` copies the
 * property injections of the ancestor chain into this subclass. The config
 * property is narrowed to `IClappPluginLoaderConfig` for type checking only.
 */
@InheritInjections()
@injectable()
export class ClappPluginLoader extends PluginLoaderFromFile {
  protected override readonly _config!: IClappPluginLoaderConfig;

  override async load(): Promise<IPluginDefinition[]> {
    const sources = this._config.sources ?? [];
    const typeDisabled = new Set(this._config.disabled ?? []);
    const visited = new Set<object>();
    const definitions = new Map<string, IPluginDefinition>();

    for (const source of sources) {
      const sourceDisabled = new Set(source.disabled ?? []);
      const modulePaths = await this.matchSource(source.patterns);

      for (const modulePath of modulePaths) {
        const namespace = await this.importModule(modulePath);

        for (const value of Object.values(namespace)) {
          if (typeof value !== 'function' || visited.has(value)) {
            continue;
          }

          const definition = getPluginDefinition(value);

          if (!definition) {
            continue;
          }

          visited.add(value);

          if (typeDisabled.has(definition.id) || sourceDisabled.has(definition.id)) {
            continue;
          }

          if (definition.type !== this._type) {
            throw new PluginException(
              definition.type,
              definition.id,
              `Plugin type "${definition.type}" does not match loader type "${this._type}".`,
            );
          }

          if (definitions.has(definition.id)) {
            throw new PluginException(definition.type, definition.id, 'Plugin definition already exists');
          }

          definitions.set(definition.id, { ...definition });
        }
      }
    }

    return [...definitions.values()];
  }

  /**
   * Matches the absolute module patterns of a single source. A pattern that
   * matches nothing — in particular a pattern of the `project` source whose
   * `plugins/` directory does not exist — yields an empty result instead of
   * failing the run, so an empty source never breaks the application.
   * @param patterns Absolute module patterns of the source
   * @returns Sorted matched module paths
   */
  protected async matchSource(patterns: string[]): Promise<string[]> {
    if (patterns.length === 0) {
      return [];
    }

    const matched: string[] = [];

    try {
      for await (const filePath of glob(patterns, { withFileTypes: false })) {
        matched.push(filePath);
      }
    } catch {
      return [];
    }

    return matched.sort();
  }
}
