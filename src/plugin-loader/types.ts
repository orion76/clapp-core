import type { IPluginLoaderConfig } from '@orion76/node-plugin';

/**
 * One plugin source as it is handed to the loader: the absolute module patterns
 * of the source together with the ids the source disables.
 */
export interface IClappPluginSourceConfig {
  /** Absolute module patterns of the source, resolved against the root of the source. */
  patterns: string[];
  /** Ids of plugin definitions that are not loaded from this source. */
  disabled: string[];
}

/**
 * Loader config of one plugin type. It extends the `@orion76/node-plugin` config
 * with the per-source split the default file loader does not understand: the
 * loader of `@clapp/core` needs to know which source a module pattern belongs to
 * in order to apply the `disabled` list of that source, and which ids are
 * disabled for the whole type.
 *
 * `patterns` stays the flattened list of every source, so the config remains a
 * valid `IPluginLoaderConfig` for the plugin manager factory.
 */
export interface IClappPluginLoaderConfig extends IPluginLoaderConfig {
  /** Absolute module patterns of every source, in source order. */
  patterns: string[];
  /** Sources of the type, in source order; the disabled list is applied per source. */
  sources: IClappPluginSourceConfig[];
  /** Ids of plugin definitions that are not loaded from any source of the type. */
  disabled: string[];
}
