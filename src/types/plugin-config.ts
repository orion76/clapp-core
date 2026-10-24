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
  type: UPluginSourceType;
  patterns: string[];
}

export interface IPluginSourceLibraryConfig extends IPluginSourceConfig {
  type: 'library';
  library: string;
}

export type UPluginSourceConfig = IPluginSourceConfig | IPluginSourceLibraryConfig;

/**
 * Discovery configuration of one plugin type: the sources its definitions come
 * from plus the ids disabled for the whole type.
 */
export interface IPluginDiscoveryConfig {
  sources: UPluginSourceConfig[];
}
