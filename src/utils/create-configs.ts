import { IAppConfig, PLUGIN_COMMAND_ARGUMENT_TYPE, PLUGIN_COMMAND_TYPE, PLUGIN_CONTEXT_TYPE, PLUGIN_FORMATTER_TYPE, TCliConfigCustom, UPluginTypes } from '@clapp/common';
import { existsSync, realpathSync } from 'fs';
import { resolve } from 'node:path';
import { join } from 'path';
import { APP_CONFIG_DEFAULT } from '../config/config';

import {
  IPluginDiscoveryConfig,
  IPluginSourceLibraryConfig,
  UPluginSourceConfig,
  UPluginSourceType
} from '../../../common/src/types/plugin-config';
import { resolveFilePathPatterns } from './config';
/**
 * Plugin types the configuration always carries.
 */
const PLUGIN_TYPES: UPluginTypes[] = [PLUGIN_COMMAND_TYPE, PLUGIN_COMMAND_ARGUMENT_TYPE, PLUGIN_CONTEXT_TYPE, PLUGIN_FORMATTER_TYPE];
/**
 * Source types a config may declare, in the order they are documented.
 */
const PLUGIN_SOURCE_TYPES: UPluginSourceType[] = ['appRoot', 'library', 'project'];

/**
 *
 * @param appRoot Application root used as the base of `appRoot` sources
 * @param customConfig Configuration override merged over the defaults
 * @returns Resolved CLI configuration
 */
export function createAppConfig(customConfig: TCliConfigCustom, appRoot: string, projectRoot?: string): IAppConfig {
  const config = mergeConfigs(APP_CONFIG_DEFAULT, customConfig);
  return resolveConfigPatterns(config, appRoot, projectRoot);
}

function mergeConfigs(defaultConfig: IAppConfig, customConfig: TCliConfigCustom): IAppConfig {
  return {
    ...defaultConfig,
    ...customConfig,
    plugins: mergePlugins(defaultConfig.plugins, customConfig.plugins),
    loggers: { ...defaultConfig.loggers, ...customConfig.loggers },
  };
}

/**
 * Resolves the sources of every plugin type of a config against the root of
 * their own source: `appRoot` sources against the application root, `library`
 * sources against the directory of the named package and `project` sources
 * against the root of the context project (empty when it is not found).
 *
 * @param appRoot Application root used as the base of `appRoot` sources
 * @param config CLI configuration whose plugin sources are resolved
 * @returns Configuration with resolved plugin source patterns
 */
function resolveConfigPatterns(config: IAppConfig, appRoot: string, projectRoot?: string): IAppConfig {
  return {
    ...config,
    plugins: {
      [PLUGIN_COMMAND_TYPE]: resolveTypePatterns(config.plugins[PLUGIN_COMMAND_TYPE], appRoot, projectRoot),
      [PLUGIN_COMMAND_ARGUMENT_TYPE]: resolveTypePatterns(config.plugins[PLUGIN_COMMAND_ARGUMENT_TYPE], appRoot, projectRoot),
      [PLUGIN_CONTEXT_TYPE]: resolveTypePatterns(config.plugins[PLUGIN_CONTEXT_TYPE], appRoot, projectRoot),
      [PLUGIN_FORMATTER_TYPE]: resolveTypePatterns(config.plugins[PLUGIN_FORMATTER_TYPE], appRoot, projectRoot),
    },
  };
}

function resolveTypePatterns(pluginConfig: IPluginDiscoveryConfig, appRoot: string, projectRoot?: string): IPluginDiscoveryConfig {
  const sources = pluginConfig.sources.map((source) => {
    let patterns: string[] = [];
    switch (source.type) {
      case 'appRoot':
        patterns = resolveFilePathPatterns(appRoot, source.patterns);
        break;
      case 'project':
        if (projectRoot) {
          patterns = resolveFilePathPatterns(projectRoot, source.patterns);
        }
        break;
      case 'library':
        if (isLibraryConfig(source) && source.library) {
          const libraryPath = resolveLibraryRoot(appRoot, source.library);
          if (!libraryPath) {
            throw new Error(`Library not found! Project:${appRoot} Library: ${source.library}`);
          }
          patterns = resolveFilePathPatterns(libraryPath, source.patterns);
        }
        break;
    }

    return { ...source, patterns };
  });

  return {
    ...pluginConfig,
    sources,
  };
}

function resolveLibraryPatterns(appRoot: string, library: string, patterns: string[]) {
  const libraryRoot = resolveLibraryRoot(appRoot, library);

  if (libraryRoot === null) {
    throw new Error(`Plugin library "${library}" was not found from the application root "${resolve(appRoot)}".`);
  }

  return resolveFilePathPatterns(libraryRoot, patterns);
}

/**
 * Resolves the directory of an npm package the way Node.js does: walks the
 * `node_modules` chain from the application root upwards, so npm-workspaces
 * hoisting and monorepo layouts work without relative paths. The found directory
 * is canonicalized (`realpath`), because a package of a workspace is usually a
 * symlink and every pattern of the source is resolved against the real location.
 *
 * @param appRoot Application root the resolution starts from
 * @param library Package name
 * @returns Real path of the package directory, or `null` when the package is not installed
 */
function resolveLibraryRoot(appRoot: string, library: string): string | null {
  let currentDir = resolve(appRoot);

  const libraryPath = join(currentDir, 'node_modules', library);

  if (existsSync(join(libraryPath, 'package.json'))) {
    return realpathSync(libraryPath);
  }
  return null;
}

function isLibraryConfig(config: UPluginSourceConfig): config is IPluginSourceLibraryConfig {
  return config.type === 'library';
}

/**
 * Merges the plugin configs of a config override over the defaults, type by
 * type: a plugin type declared by the override replaces the default config of
 * that type, an undeclared one keeps the default.
 *
 * @param defaultPlugins Plugin configs of the default config
 * @param overridePlugins Plugin configs of the override, if any
 * @returns Merged plugin configs
 */
export function mergePlugins(
  defaultPlugins: Record<UPluginTypes, IPluginDiscoveryConfig>,
  overridePlugins: Record<UPluginTypes, IPluginDiscoveryConfig> | undefined,
): Record<UPluginTypes, IPluginDiscoveryConfig> {
  const merged = {} as Record<UPluginTypes, IPluginDiscoveryConfig>;

  for (const pluginType of PLUGIN_TYPES) {
    const override = overridePlugins?.[pluginType];
    merged[pluginType] = override === undefined ? defaultPlugins[pluginType] : normalizeDiscoveryConfig(override);
  }

  return merged;
}
/**
 * Normalizes the discovery config of one plugin type: validates its shape and
 * fills the defaults. An absent type config becomes an empty list of sources.
 *
 * @param raw Type config as it was read from the config file
 * @param pluginType Plugin type the config belongs to
 * @returns Normalized discovery config
 */
function normalizeDiscoveryConfig(raw: unknown): IPluginDiscoveryConfig {
  if (raw === undefined || raw === null) {
    return { sources: [] };
  }

  if (typeof raw !== 'object') {
    throw new Error(`Invalid plugin : expected a mapping with "sources" and "disabled".`);
  }

  const { sources } = raw as Partial<IPluginDiscoveryConfig>;

  if (sources !== undefined && !Array.isArray(sources)) {
    throw new Error(`Invalid plugin config : "sources" must be a list of plugin sources.`);
  }

  return {
    sources: (sources ?? []).map((source) => {
      const { patterns } = normalizeSource(source);
      return { ...source, patterns };
    }),
  };
}
/**
 * Validates the elements of the type-level `disabled` list of a plugin type.
 * The message names the plugin type and the index of the offending element.
 *
 * @param values Values of the list as read from the config
 * @param pluginType Plugin type the list belongs to
 * @returns Validated values
 */
function validateTypeDisabled(values: unknown[]): string[] {
  for (let elementIndex = 0; elementIndex < values.length; elementIndex += 1) {
    const value = values[elementIndex];
    if (typeof value !== 'string' || value.length === 0) {
      const json = JSON.stringify(value);
      throw new Error(`Invalid plugin config of : "disabled" must be a list of non-empty strings, got ${json} at index ${elementIndex}.`);
    }
  }

  return values as string[];
}
/**
 * Normalizes a single source of a plugin type: validates its shape and fills the
 * defaults (empty `patterns`/`disabled`). A malformed source raises an error that
 * names the plugin type, the position of the source and the expected field.
 *
 * @param raw Source as it was read from the config file
 * @param pluginType Plugin type the source belongs to
 * @param index Position of the source in the `sources` list
 * @returns Normalized source
 */
function normalizeSource(raw: UPluginSourceConfig): UPluginSourceConfig {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error(`Invalid plugin source : expected a mapping with "type" and "patterns".`);
  }

  const { type, patterns } = raw;

  if (type === undefined || !PLUGIN_SOURCE_TYPES.includes(type)) {
    throw new Error(`Invalid plugin source : unknown source type "${String(type)}". Expected one of: ${PLUGIN_SOURCE_TYPES.join(', ')}.`);
  }

  if (isLibraryConfig(raw) && (typeof raw.library !== 'string' || raw.library.length === 0)) {
    throw new Error(`Invalid plugin source : a source of type "library" requires the "library" package name.`);
  }

  if (patterns !== undefined && !Array.isArray(patterns)) {
    throw new Error(`Invalid plugin source : "patterns" must be a list of module patterns.`);
  }

  const normalizedPatterns = patterns === undefined ? [] : validateNonEmptyStringList(patterns);

  return {
    type,
    patterns: normalizedPatterns,
  };
}

/**
 * Validates the elements of a string list field of a plugin source. Every
 * element must be a non-empty string; the error names the plugin type, the
 * position of the source and the index of the offending element, so a
 * malformed value can be located without reading the whole config.
 *
 * @param values Values of the field as read from the config
 * @param field Name of the field (`patterns` or `disabled`)
 * @returns Validated values
 */
function validateNonEmptyStringList(values: unknown[]): string[] {
  for (let elementIndex = 0; elementIndex < values.length; elementIndex += 1) {
    const value = values[elementIndex];
    if (typeof value !== 'string' || value.length === 0) {
      const json = JSON.stringify(value);
      throw new Error(`Invalid plugin source : must be a list of non-empty strings, got ${json} at index ${elementIndex}.`);
    }
  }

  return values as string[];
}
