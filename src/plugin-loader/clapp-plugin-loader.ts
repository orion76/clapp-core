import { existsSync } from 'node:fs';
import { glob } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import {
  InheritInjections,
  NodePluginBase,
  PluginException,
  PluginLoaderException,
  PluginLoaderFromFile,
  getPluginDefinition,
  type IPluginDefinition,
} from '@orion76/node-plugin';
import { injectable } from 'inversify';

import type { IClappPluginLoaderConfig } from './types';


@InheritInjections()
@injectable()
export class ClappPluginLoader extends PluginLoaderFromFile {
  protected override readonly _config!: IClappPluginLoaderConfig;

  override async load(): Promise<IPluginDefinition[]> {
    const sources = this._config.sources ?? [];
    const visited = new Set<object>();
    const definitions = new Map<string, IPluginDefinition>();

    for (const source of sources) {
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

  /**
   * Overrides the module import of the base loader to reject a plugin module
   * whose plugin classes were built against a different instance of
   * `@orion76/node-plugin` than the one of the engine. That happens when the
   * context project of the `project` source is a CJS project (no
   * `"type": "module"` in its `package.json`): `tsx` then compiles the plugin
   * for `require`, and `require` of the ESM `@clapp/common`/`@orion76/node-plugin`
   * produces a second instance of the modules, so the plugin class misses the
   * injection tokens of the engine (`EVENT_BUS_TOKEN`, `PLUGIN_DEFINITION` are
   * not the same symbols) and would only fail later, at invocation time.
   *
   * The check walks the prototype chain of every exported plugin class (a class
   * with a plugin definition) and verifies that it reaches the `NodePluginBase`
   * of this loader instance. A healthy ESM plugin, whose imports resolve to the
   * same module instances as the launcher, reaches that exact base class. A CJS
   * plugin reaches a `NodePluginBase` with the same class name but a different
   * object identity — such a module is rejected with an error that names the
   * module path and the root of the context project, so the developer knows the
   * project must be ESM or resolve the same package instances. A class that does
   * not extend `NodePluginBase` at all carries no DI inheritance and is left
   * untouched.
   *
   * `getPluginDefinition` reads through a `Symbol.for` key shared by every
   * instance of `@orion76/node-plugin`, so the definitions of a foreign plugin
   * are visible here; the definition value itself is not used by the check.
   *
   * @param modulePath Path of the module to import
   * @returns Namespace of the imported module
   */
  protected override async importModule(modulePath: string): Promise<Record<string, unknown>> {
    const namespace = await super.importModule(modulePath);

    for (const value of Object.values(namespace)) {
      if (typeof value !== 'function' || getPluginDefinition(value) === undefined) {
        continue;
      }

      this.assertEngineNodePluginBase(value, modulePath);
    }

    return namespace;
  }

  /**
   * Verifies that a plugin class reaches the `NodePluginBase` of the loader
   * through its prototype chain, and throws a readable error when it ends on a
   * foreign instance of `NodePluginBase` instead (a CJS plugin of a context
   * project). See {@link ClappPluginLoader.importModule}.
   *
   * @param pluginClass Plugin class whose prototype chain is walked
   * @param modulePath Path of the module the class was exported from
   */
  protected assertEngineNodePluginBase(pluginClass: object, modulePath: string): void {
    let prototype: object | null = Object.getPrototypeOf(pluginClass);

    while (prototype !== null && prototype !== Object.prototype) {
      if (prototype === NodePluginBase) {
        return;
      }

      if ((prototype as { name?: string }).name === 'NodePluginBase') {
        const projectRoot = this.findProjectRoot(modulePath);
        throw new PluginLoaderException(
          modulePath,
          `Plugin module "${modulePath}" was loaded against a different instance of "@orion76/node-plugin" than the launcher uses. ` +
            `A plugin of a context project must be ESM — add "type": "module" to the "package.json" of the project ` +
            `"${projectRoot}" (or make the project resolve the same "@clapp/common"/"@orion76/node-plugin" instances).`,
        );
      }

      prototype = Object.getPrototypeOf(prototype);
    }
  }

  /**
   * Resolves the root of the context project a module belongs to: the nearest
   * directory with a `package.json` above the module. Used only to make the
   * error message actionable.
   * @param modulePath Path of the imported plugin module
   * @returns Root of the context project, or the module directory when no `package.json` is found
   */
  protected findProjectRoot(modulePath: string): string {
    let currentDir = dirname(modulePath);

    while (true) {
      if (existsSync(join(currentDir, 'package.json'))) {
        return currentDir;
      }

      const parentDir = dirname(currentDir);

      if (parentDir === currentDir) {
        return currentDir;
      }

      currentDir = parentDir;
    }
  }
}
