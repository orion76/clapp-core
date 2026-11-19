import {
  IAppConfig,
  ISchemaConfig,
  PLUGIN_COMMAND_ARGUMENT_TYPE,
  PLUGIN_COMMAND_TYPE,
  PLUGIN_CONTEXT_TYPE,
  PLUGIN_FORMATTER_TYPE,
  TCliConfigCustom,
  UPluginTypes,
} from '@clapp/common';
import { existsSync, realpathSync } from 'fs';
import { isAbsolute, resolve } from 'node:path';
import { join } from 'path';
import { APP_CONFIG_DEFAULT } from '../config/config';

import {
  IPluginDiscoveryConfig,
  IPluginSourceLibraryConfig,
  IPluginSourcePathConfig,
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
const PLUGIN_SOURCE_TYPES: UPluginSourceType[] = ['appRoot', 'path', 'library', 'project'];

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
    schemas: mergeSchemas(defaultConfig.schemas, customConfig.schemas),
  };
}

/**
 * Resolves the sources of every plugin type and of the schema section against the root of
 * their own source: `appRoot` against the application root, `path` against the directory it
 * names, `library` against the directory of the named package and `project` against the root
 * of the context project (empty when not found).
 *
 * @param appRoot Application root used as the base of `appRoot` and `path` sources
 * @param config CLI configuration whose plugin and schema sources are resolved
 * @returns Configuration with resolved source patterns
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
    schemas: {
      ...config.schemas,
      sources: resolveSources(config.schemas.sources, appRoot, projectRoot),
    },
  };
}

/**
 * Resolves the source patterns of one plugin type. A `path` source whose
 * directory is missing does not raise: an empty source is a valid state, while a
 * missing `library` package still fails the resolution.
 *
 * @param pluginConfig Discovery config of the plugin type
 * @param appRoot Application root used as the base of `appRoot` and `path` sources
 * @param projectRoot Root of the context project, absent when there is no project
 * @returns Discovery config with resolved source patterns
 */
function resolveTypePatterns(pluginConfig: IPluginDiscoveryConfig, appRoot: string, projectRoot?: string): IPluginDiscoveryConfig {
  return {
    ...pluginConfig,
    sources: resolveSources(pluginConfig.sources, appRoot, projectRoot),
  };
}

/**
 * Resolves the patterns of every source against the root of that source. The sources of the
 * schema section are resolved by the same mechanism as the sources of a plugin type, so a
 * host declares a directory of schema files exactly as it declares a directory of plugins.
 *
 * @param sources Sources of a plugin type or of the schema section
 * @param appRoot Application root used as the base of `appRoot` and `path` sources
 * @param projectRoot Root of the context project, absent when there is no project
 * @returns Sources with resolved patterns
 */
function resolveSources(sources: UPluginSourceConfig[], appRoot: string, projectRoot?: string): UPluginSourceConfig[] {
  return sources.map((source) => {
    let patterns: string[] = [];
    switch (source.type) {
      case 'appRoot':
        patterns = resolveFilePathPatterns(appRoot, source.patterns);
        break;
      case 'path':
        if (isPathConfig(source)) {
          const sourceRoot = isAbsolute(source.path) ? source.path : resolve(appRoot, source.path);
          patterns = resolveFilePathPatterns(sourceRoot, source.patterns);
        }
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

function isPathConfig(config: UPluginSourceConfig): config is IPluginSourcePathConfig {
  return config.type === 'path';
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
    merged[pluginType] = override === undefined ? defaultPlugins[pluginType] : normalizeDiscoveryConfig(override, pluginType);
  }

  return merged;
}

/**
 * Merges the schema section of a config override over the default one: a declared section
 * replaces the default entirely, an absent one keeps the default.
 *
 * @param defaultSchemas Schema section of the default config
 * @param overrideSchemas Schema section of the override, if any
 * @returns Merged schema section
 */
function mergeSchemas(defaultSchemas: ISchemaConfig, overrideSchemas: ISchemaConfig | undefined): ISchemaConfig {
  return overrideSchemas === undefined ? defaultSchemas : normalizeSchemaConfig(overrideSchemas);
}

/**
 * Normalizes the schema section: validates the shape of its `sources` and `formatters`
 * fields and fills their defaults. An absent section becomes a section without sources and
 * without formatter mappings.
 *
 * @param raw Schema section as it was read from the config file
 * @returns Normalized schema section
 */
function normalizeSchemaConfig(raw: unknown): ISchemaConfig {
  if (raw === undefined || raw === null) {
    return { sources: [], formatters: {} };
  }

  if (typeof raw !== 'object') {
    throw new Error('Invalid "schemas" section: expected a mapping with "sources" and "formatters".');
  }

  const { sources, formatters } = raw as Partial<ISchemaConfig>;

  if (sources !== undefined && !Array.isArray(sources)) {
    throw new Error('Invalid "schemas" section: "sources" must be a list of schema sources.');
  }

  return {
    sources: (sources ?? []).map((source, sourceIndex) =>
      normalizeSource(source, `the source ${sourceIndex} of "schemas"`),
    ),
    formatters: formatters === undefined ? {} : normalizeFormatters(formatters),
  };
}

/**
 * Validates the `formatters` map of the schema section: every key is the `$id` of a schema
 * and every value is the id of the formatter plugin that renders its data.
 *
 * @param raw Map as it was read from the config file
 * @returns Validated map of formatter ids by schema id
 */
function normalizeFormatters(raw: unknown): Record<string, string> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('Invalid "formatters" of the "schemas" section: expected a mapping of schema ids to formatter ids.');
  }

  const formatters: Record<string, string> = {};

  for (const [schemaId, formatterId] of Object.entries(raw)) {
    if (schemaId.length === 0) {
      throw new Error('Invalid "formatters" of the "schemas" section: a schema id must be a non-empty string.');
    }

    if (typeof formatterId !== 'string' || formatterId.length === 0) {
      throw new Error(
        `Invalid "formatters" of the "schemas" section: schema "${schemaId}" must map to a non-empty formatter id, got ${JSON.stringify(formatterId)}.`,
      );
    }

    formatters[schemaId] = formatterId;
  }

  return formatters;
}

/**
 * Normalizes the discovery config of one plugin type: validates the shape of its
 * `sources` and `disabled` fields and fills their defaults. An absent type config
 * becomes a type without sources and without disabled ids.
 *
 * @param raw Type config as it was read from the config file
 * @param pluginType Plugin type the config belongs to
 * @returns Normalized discovery config
 */
function normalizeDiscoveryConfig(raw: unknown, pluginType: UPluginTypes): IPluginDiscoveryConfig {
  if (raw === undefined || raw === null) {
    return { sources: [], disabled: [] };
  }

  if (typeof raw !== 'object') {
    throw new Error(`Invalid plugin config of "${pluginType}": expected a mapping with "sources" and "disabled".`);
  }

  const { sources, disabled } = raw as Partial<IPluginDiscoveryConfig>;

  if (sources !== undefined && !Array.isArray(sources)) {
    throw new Error(`Invalid plugin config of "${pluginType}": "sources" must be a list of plugin sources.`);
  }

  if (disabled !== undefined && !Array.isArray(disabled)) {
    throw new Error(`Invalid plugin config of "${pluginType}": "disabled" must be a list of plugin ids.`);
  }

  return {
    sources: (sources ?? []).map((source, sourceIndex) =>
      normalizeSource(source, `the plugin source ${sourceIndex} of "${pluginType}"`),
    ),
    disabled:
      disabled === undefined ? [] : validateStringList(disabled, `"disabled" of the plugin config of "${pluginType}"`),
  };
}
/**
 * Normalizes a single source of a plugin type or of the schema section: validates its shape
 * and fills the defaults of `patterns` and `disabled`. A malformed source raises an error
 * that names the place the source was read from and the expected field.
 *
 * @param raw Source as it was read from the config file
 * @param where Place of the source (`the plugin source 0 of "command"`)
 * @returns Normalized source
 */
function normalizeSource(raw: unknown, where: string): UPluginSourceConfig {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error(`Invalid ${where}: expected a mapping with "type", "patterns" and "disabled".`);
  }

  const { type, patterns, disabled, library, path } = raw as Record<string, unknown>;

  if (typeof type !== 'string' || !PLUGIN_SOURCE_TYPES.includes(type as UPluginSourceType)) {
    throw new Error(`Invalid ${where}: unknown source type "${String(type)}". Expected one of: ${PLUGIN_SOURCE_TYPES.join(', ')}.`);
  }

  if (patterns !== undefined && !Array.isArray(patterns)) {
    throw new Error(`Invalid ${where}: "patterns" must be a list of module patterns.`);
  }

  if (disabled !== undefined && !Array.isArray(disabled)) {
    throw new Error(`Invalid ${where}: "disabled" must be a list of plugin ids.`);
  }

  const sourceType = type as UPluginSourceType;
  const sourcePatterns = patterns === undefined ? [] : validateStringList(patterns, `"patterns" of ${where}`);
  const sourceDisabled = disabled === undefined ? [] : validateStringList(disabled, `"disabled" of ${where}`);

  switch (sourceType) {
    case 'library':
      if (typeof library !== 'string' || library.length === 0) {
        throw new Error(`Invalid ${where}: a source of type "library" requires the "library" package name.`);
      }

      return { type: sourceType, library, patterns: sourcePatterns, disabled: sourceDisabled };
    case 'path':
      if (typeof path !== 'string' || path.length === 0) {
        throw new Error(`Invalid ${where}: a source of type "path" requires the "path" directory.`);
      }

      return { type: sourceType, path, patterns: sourcePatterns, disabled: sourceDisabled };
    case 'appRoot':
    case 'project':
      return { type: sourceType, patterns: sourcePatterns, disabled: sourceDisabled };
  }
}

/**
 * Validates the elements of a string list of a plugin config or source. Every
 * element must be a non-empty string; the error names the place the list was read
 * from and the index of the offending element, so a typo in a config file can be
 * located without reading the whole file.
 *
 * @param values Values of the list as read from the config
 * @param where Place of the list (`"disabled" of the plugin config of "command"`)
 * @returns Validated values
 */
function validateStringList(values: unknown[], where: string): string[] {
  for (let elementIndex = 0; elementIndex < values.length; elementIndex += 1) {
    const value = values[elementIndex];
    if (typeof value !== 'string' || value.length === 0) {
      const json = JSON.stringify(value);
      throw new Error(`Invalid ${where}: must be a list of non-empty strings, got ${json} at index ${elementIndex}.`);
    }
  }

  return values as string[];
}
