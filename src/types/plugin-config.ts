/**
 * Plugin discovery configuration of one plugin type.
 *
 * A plugin type (`PLUGIN_COMMAND`, `PLUGIN_CONTEXT`, `PLUGIN_FORMATTER`) is not
 * described by a flat list of patterns anymore: its plugins come from
 * **sources**, each anchored at its own root, and every source (and the type
 * itself) can disable single plugin ids.
 *
 * ```yaml
 * plugins:
 *   PLUGIN_COMMAND:
 *     # Type-level list: an id disabled here is not loaded from any source.
 *     disabled: []
 *     sources:
 *       # `@clapp/ai-workflow-plugins` is resolved from the application root,
 *       # patterns are relative to the directory of that package.
 *       - type: library
 *         library: '@clapp/ai-workflow-plugins'
 *         patterns:
 *           - src/plugins/commands/**\/*.plugin.{js,ts}
 *         disabled: []
 *       # Plugins of the project the launcher runs in: `plugins/` in its root.
 *       - type: project
 *         patterns:
 *           - plugins/commands/**\/*.plugin.{js,ts}
 *         disabled: []
 *   PLUGIN_FORMATTER:
 *     disabled: []
 *     sources:
 *       # Patterns of the launcher itself: relative to the application root.
 *       - type: appRoot
 *         patterns:
 *           - src/plugins/formatters/**\/*.plugin.{js,ts}
 *         disabled: []
 * ```
 */

/**
 * Kind of a plugin source: the root its `patterns` are resolved against.
 *
 * - `appRoot` — the root of the launcher application, the package that holds
 *   `clapp.config.yml` (never `process.cwd()`);
 * - `library` — the directory of the npm package named by
 *   {@link IPluginSourceConfig.library}. The package is resolved from the
 *   application root through the Node.js resolution algorithm, so npm-workspaces
 *   hoisting and monorepo layouts work without relative paths;
 * - `project` — the root of the project the launcher runs in: the nearest
 *   directory with a `package.json` above the working directory. The plugins of
 *   the project are an auxiliary tool of the developer, not a part of the
 *   launcher, so they live in `plugins/**` in the project root.
 */
export type UPluginSourceType = 'appRoot' | 'library' | 'project';

/**
 * Single source of plugin modules of one plugin type.
 */
export interface IPluginSourceConfig {
  /** Kind of the source: the root the patterns are resolved against. */
  type: UPluginSourceType;
  /** Module patterns, resolved against the root of the source. Absolute patterns are kept as-is. */
  patterns: string[];
  /**
   * Name of the npm package whose directory is the root of the source. Required
   * for `type: library` and ignored by the other types.
   */
  library?: string;
  /**
   * Ids of plugin definitions that are not loaded from this source. An id
   * disabled in every source that provides it is never registered, and such a
   * disabled definition never raises a duplicate/conflict error. When the id
   * belongs to a definition that is a parent of other definitions (a command
   * group), the whole subtree of the id is not loaded either — no matter which
   * source the child definitions came from — so a registered child never
   * references a parent that was dropped.
   */
  disabled: string[];
}

/**
 * Discovery configuration of one plugin type: the sources its definitions come
 * from plus the ids disabled for the whole type.
 */
export interface IPluginDiscoveryConfig {
  /** Sources of the type, processed in order; later sources complement earlier ones. */
  sources: IPluginSourceConfig[];
  /**
   * Ids of plugin definitions that are not loaded from **any** source of the
   * type. Merged with the `disabled` list of every source: a definition is
   * skipped when its id is disabled in the source it comes from or in the type.
   * Disabling the id of a group definition disables its whole subtree as well
   * (see {@link IPluginSourceConfig.disabled}).
   */
  disabled: string[];
}
