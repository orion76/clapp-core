import { existsSync } from 'node:fs';
import { glob } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import {
  InheritInjections,
  NodePluginBase,
  PluginException,
  PluginLoaderFromFile,
  PluginLoaderException,
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
 * duplicate/conflict check. The `disabled` check also runs **before** the class
 * is marked in the `visited` set, so a definition disabled in one source but
 * allowed in another is still registered by the source that permits it. A
 * disabled plugin therefore never registers and a disabled duplicate never
 * raises a conflict error.
 *
 * After the definitions of every source are collected, ids disabled at the type
 * level or by any source are resolved transitively: disabling an id that is a
 * parent of other definitions disables its whole subtree, no matter which source
 * the child definitions came from. This keeps the command hierarchy consistent —
 * a registered child never references a parent that was dropped by `disabled`.
 *
 * The class extends the default loader to reuse its module import (runtime
 * detection, `tsx` registration, module cache) and only replaces the discovery
 * loop; the module patterns of a source are matched separately, so a definition
 * is always associated with the disabled list of the source that provided it.
 * The import override also rejects a plugin module that was loaded against a
 * different instance of `@orion76/node-plugin` than the launcher uses (see
 * {@link ClappPluginLoader.importModule}).
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
    const sourceDisabledIds = new Set<string>();
    const visited = new Set<object>();
    const definitions = new Map<string, IPluginDefinition>();

    for (const source of sources) {
      const sourceDisabled = new Set(source.disabled ?? []);

      for (const id of sourceDisabled) {
        sourceDisabledIds.add(id);
      }

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

          if (typeDisabled.has(definition.id) || sourceDisabled.has(definition.id)) {
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

    const enabledDefinitions = this.pruneDisabledSubtrees(definitions, typeDisabled, sourceDisabledIds);

    return [...enabledDefinitions.values()];
  }

  /**
   * Removes the subtrees of disabled definitions from a collected definition
   * map. The disabled ids of the type and of every source are already known; on
   * top of them a definition whose `parent` chain reaches a disabled id (or a
   * cycle) is a member of a disabled subtree and is dropped as well, so a
   * registered child never references a parent that will not register.
   *
   * The subtree walk is independent of the sources: a child is rejected no
   * matter which source provided it, and a group disabled in one source takes
   * its whole subtree even when the children came from another source (the
   * group itself is not part of the map when it was filtered out by the
   * `disabled` of its own source — the walked chain still reaches it through
   * the disabled set).
   *
   * @param definitions Definitions collected from every source, keyed by id
   * @param typeDisabled Ids disabled at the type level
   * @param sourceDisabledIds Ids disabled by at least one source
   * @returns Definitions that are not part of a disabled subtree
   */
  protected pruneDisabledSubtrees(
    definitions: Map<string, IPluginDefinition>,
    typeDisabled: Set<string>,
    sourceDisabledIds: Set<string>,
  ): Map<string, IPluginDefinition> {
    const disabled = new Set([...typeDisabled, ...sourceDisabledIds]);
    const initiallyDisabledCount = disabled.size;

    for (const [id, definition] of definitions) {
      if (disabled.has(id) || definition.parent === undefined) {
        continue;
      }
      if (this.isInDisabledSubtree(id, definitions, disabled)) {
        disabled.add(id);
      }
    }

    if (disabled.size === initiallyDisabledCount) {
      return definitions;
    }

    const kept = new Map<string, IPluginDefinition>();

    for (const [id, definition] of definitions) {
      if (!disabled.has(id)) {
        kept.set(id, definition);
      }
    }

    return kept;
  }

  /**
   * Walks the `parent` chain of a definition up to the root and reports whether
   * the chain reaches a disabled id (either given in the disabled set or
   * discovered by an earlier walk) or a cycle. Every id on the chain that is
   * not disabled yet is also added to the disabled set, so each subtree is
   * walked at most once across the definitions of the loader.
   *
   * @param id Id of the definition whose chain is walked
   * @param definitions Collected definitions keyed by id
   * @param disabled Disabled ids, extended with every id the walk rejects
   * @returns `true` when the chain reaches a disabled id or a cycle
   */
  protected isInDisabledSubtree(
    id: string,
    definitions: Map<string, IPluginDefinition>,
    disabled: Set<string>,
  ): boolean {
    const seen = new Set<string>();

    let current = id;

    while (true) {
      if (disabled.has(current)) {
        return true;
      }

      if (seen.has(current)) {
        return true;
      }
      seen.add(current);

      const definition = definitions.get(current);

      if (definition === undefined || definition.parent === undefined) {
        return false;
      }

      current = definition.parent;
    }
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
