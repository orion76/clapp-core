import { existsSync, realpathSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';

import { load as loadYaml } from 'js-yaml';

import {
  PLUGIN_COMMAND_TYPE,
  PLUGIN_CONTEXT_TYPE,
  PLUGIN_FORMATTER_TYPE,
  UPluginTypes,
} from '@clapp/common';
import { getProjectRoot } from '@clapp/utils';

import { APP_CONFIG_DEFAULT } from '../config/config';
import type { IAppConfig, TCliConfigOverride } from '../types';

import { IPluginDiscoveryConfig, IPluginSourceConfig, UPluginSourceType } from '../types/plugin-config';


/**
 * Source types a config may declare, in the order they are documented.
 */
const PLUGIN_SOURCE_TYPES: UPluginSourceType[] = ['appRoot', 'library', 'project'];

/**
 * Plugin types the configuration always carries.
 */
const PLUGIN_TYPES: UPluginTypes[] = [PLUGIN_COMMAND_TYPE, PLUGIN_CONTEXT_TYPE, PLUGIN_FORMATTER_TYPE];

/**
 * Resolves relative module patterns against the given root. Absolute patterns
 * are kept as-is.
 *
 * @param root Base of the relative patterns
 * @param patterns Module patterns
 * @returns Resolved module patterns
 */
export function resolveDiscoveryPatterns(root: string, patterns: string[]): string[] {
  const resolvedRoot = resolve(root);
  return patterns.map((pattern) => (isAbsolute(pattern) ? pattern : resolve(resolvedRoot, pattern)));
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

  while (true) {
    const candidate = join(currentDir, 'node_modules', library);

    if (existsSync(join(candidate, 'package.json'))) {
      return realpathSync(candidate);
    }

    const parentDir = dirname(currentDir);

    if (parentDir === currentDir) {
      return null;
    }

    currentDir = parentDir;
  }
}

/**
 * Resolves the root of the project the launcher runs in: the nearest directory
 * with a `package.json` above the working directory. The lookup never throws —
 * a working directory outside the searched tree or an absent project yields
 * `null`, and the `project` source is then simply empty.
 *
 * @returns Root of the context project, or `null` when it is not found
 */
function resolveProjectRoot(): string | null {
  try {
    return getProjectRoot(process.cwd());
  } catch {
    return null;
  }
}

/**
 * Resolves the patterns of a single source against the root of that source.
 *
 * @param source Source as declared in the config
 * @param appRoot Application root used by `appRoot` sources and by the library lookup
 * @param projectRoot Root of the context project, `null` when it is not found
 * @returns Absolute module patterns of the source
 */
function resolveSourcePatterns(source: IPluginSourceConfig, appRoot: string, projectRoot: string | null): string[] {
  if (source.type === 'library') {
    const library = source.library;

    if (library === undefined) {
      return [];
    }

    const libraryRoot = resolveLibraryRoot(appRoot, library);

    if (libraryRoot === null) {
      throw new Error(`Plugin library "${library}" was not found from the application root "${resolve(appRoot)}".`);
    }

    return resolveDiscoveryPatterns(libraryRoot, source.patterns);
  }

  if (source.type === 'project') {
    return projectRoot === null ? [] : resolveDiscoveryPatterns(projectRoot, source.patterns);
  }

  return resolveDiscoveryPatterns(appRoot, source.patterns);
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
function normalizeSource(raw: unknown, pluginType: UPluginTypes, index: number): IPluginSourceConfig {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error(`Invalid plugin source #${index} of "${pluginType}": expected a mapping with "type" and "patterns".`);
  }

  const { type, patterns, library, disabled } = raw as Partial<IPluginSourceConfig>;

  if (type === undefined || !PLUGIN_SOURCE_TYPES.includes(type)) {
    throw new Error(
      `Invalid plugin source #${index} of "${pluginType}": unknown source type "${String(type)}". Expected one of: ${PLUGIN_SOURCE_TYPES.join(', ')}.`,
    );
  }

  if (type === 'library' && (typeof library !== 'string' || library.length === 0)) {
    throw new Error(`Invalid plugin source #${index} of "${pluginType}": a source of type "library" requires the "library" package name.`);
  }

  if (patterns !== undefined && !Array.isArray(patterns)) {
    throw new Error(`Invalid plugin source #${index} of "${pluginType}": "patterns" must be a list of module patterns.`);
  }

  if (disabled !== undefined && !Array.isArray(disabled)) {
    throw new Error(`Invalid plugin source #${index} of "${pluginType}": "disabled" must be a list of plugin ids.`);
  }

  const normalizedPatterns = patterns === undefined ? [] : validateNonEmptyStringList(
    patterns,
    pluginType,
    index,
    'patterns',
  );
  const normalizedDisabled = disabled === undefined ? [] : validateNonEmptyStringList(
    disabled,
    pluginType,
    index,
    'disabled',
  );

  return {
    type,
    patterns: normalizedPatterns,
    library,
    disabled: normalizedDisabled,
  };
}

/**
 * Validates the elements of a string list field of a plugin source. Every
 * element must be a non-empty string; the error names the plugin type, the
 * position of the source and the index of the offending element, so a
 * malformed value can be located without reading the whole config.
 *
 * @param values Values of the field as read from the config
 * @param pluginType Plugin type the source belongs to
 * @param index Position of the source in the `sources` list
 * @param field Name of the field (`patterns` or `disabled`)
 * @returns Validated values
 */
function validateNonEmptyStringList(values: unknown[], pluginType: UPluginTypes, index: number, field: string): string[] {
  for (let elementIndex = 0; elementIndex < values.length; elementIndex += 1) {
    const value = values[elementIndex];
    if (typeof value !== 'string' || value.length === 0) {
      const json = JSON.stringify(value);
      throw new Error(
        `Invalid plugin source #${index} of "${pluginType}": "${field}" must be a list of non-empty strings, got ${json} at index ${elementIndex}.`,
      );
    }
  }

  return values as string[];
}

/**
 * Validates the elements of the type-level `disabled` list of a plugin type.
 * The message names the plugin type and the index of the offending element.
 *
 * @param values Values of the list as read from the config
 * @param pluginType Plugin type the list belongs to
 * @returns Validated values
 */
function validateTypeDisabled(values: unknown[], pluginType: UPluginTypes): string[] {
  for (let elementIndex = 0; elementIndex < values.length; elementIndex += 1) {
    const value = values[elementIndex];
    if (typeof value !== 'string' || value.length === 0) {
      const json = JSON.stringify(value);
      throw new Error(
        `Invalid plugin config of "${pluginType}": "disabled" must be a list of non-empty strings, got ${json} at index ${elementIndex}.`,
      );
    }
  }

  return values as string[];
}

/**
 * Normalizes the discovery config of one plugin type: validates its shape and
 * fills the defaults. An absent type config becomes an empty list of sources.
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

  const typeDisabled = validateTypeDisabled(disabled ?? [], pluginType);

  return {
    sources: (sources ?? []).map((source, index) => normalizeSource(source, pluginType, index)),
    disabled: typeDisabled,
  };
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
function mergePlugins(
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

function mergeConfigs(defaultConfig: IAppConfig, overrideConfig: TCliConfigOverride): IAppConfig {
  return {
    ...defaultConfig,
    ...overrideConfig,
    plugins: mergePlugins(defaultConfig.plugins, overrideConfig.plugins),
    loggers: { ...defaultConfig.loggers, ...overrideConfig.loggers },
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
function resolveConfigPatterns(appRoot: string, config: IAppConfig): IAppConfig {
  const projectRoot = resolveProjectRoot();

  const resolveTypePatterns = (pluginConfig: IPluginDiscoveryConfig): IPluginDiscoveryConfig => ({
    ...pluginConfig,
    sources: pluginConfig.sources.map((source) => ({
      ...source,
      patterns: resolveSourcePatterns(source, appRoot, projectRoot),
    })),
  });

  return {
    ...config,
    plugins: {
      [PLUGIN_COMMAND_TYPE]: resolveTypePatterns(config.plugins[PLUGIN_COMMAND_TYPE]),
      [PLUGIN_CONTEXT_TYPE]: resolveTypePatterns(config.plugins[PLUGIN_CONTEXT_TYPE]),
      [PLUGIN_FORMATTER_TYPE]: resolveTypePatterns(config.plugins[PLUGIN_FORMATTER_TYPE]),
    },
  };
}

/**
 * Merges a configuration override over the defaults, resolves the sources of
 * its plugin types and returns the resulting configuration. Used for in-memory
 * configurations; file-backed ones go through `loadConfig`.
 *
 * @param appRoot Application root used as the base of `appRoot` sources
 * @param override Configuration override merged over the defaults
 * @returns Resolved CLI configuration
 */
export function createAppConfig(appRoot: string, override: TCliConfigOverride): IAppConfig {
  const config = mergeConfigs(APP_CONFIG_DEFAULT, override);
  return resolveConfigPatterns(appRoot, config);
}

/**
 * Loads a YAML CLI configuration file, merges it over the defaults and resolves
 * the sources of its plugin types.
 * @param configPath Path to the YAML config file
 * @param appRoot Application root; defaults to the config file directory
 * @returns Resolved CLI configuration
 */
export async function loadConfig(configPath: string, appRoot?: string): Promise<IAppConfig> {
  const resolvedConfigPath = resolve(configPath);
  const contents = await readFile(resolvedConfigPath, 'utf8');
  const override = loadYaml(contents) as TCliConfigOverride;
  const root = resolve(appRoot ?? dirname(resolvedConfigPath));

  return createAppConfig(root, override);
}

/**
 * Alias of `loadConfig` kept for backward compatibility.
 * @param path Path to the YAML config file
 * @param appRoot Application root; defaults to the config file directory
 * @returns Resolved CLI configuration
 */
export async function getAppConfig(path: string, appRoot?: string): Promise<IAppConfig> {
  return loadConfig(path, appRoot);
}
