import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';

import { load as loadYaml } from 'js-yaml';
import { IAppConfig, TCliConfigOverride } from '../types';
import { PLUGIN_COMMAND_TYPE, PLUGIN_CONTEXT_TYPE, PLUGIN_FORMATTER_TYPE, IPluginDiscoveryConfig } from '@clapp/common';
import { APP_CONFIG_DEFAULT } from '../config/config';

/**
 * Resolves relative command discovery patterns of a validated config against
 * the given application root. Absolute patterns are kept as-is.
 *
 * @param appRoot Application root used as the base for relative patterns
 * @param patterns Module patterns
 * @returns Resolved Module patterns
 */
export function resolveDiscoveryPatterns(appRoot: string, patterns: string[]): string[] {
  const root = resolve(appRoot);
  return patterns.map((pattern) => (isAbsolute(pattern) ? pattern : resolve(root, pattern)));
}

function mergeConfigs(defaultConfig: IAppConfig, overrideConfig: TCliConfigOverride): IAppConfig {
  return {
    ...defaultConfig,
    ...overrideConfig,
    plugins: { ...defaultConfig.plugins, ...overrideConfig.plugins },
    loggers: { ...defaultConfig.loggers, ...overrideConfig.loggers },
  };
}

/**
 * Resolves relative discovery patterns of every plugin type of a config against
 * the given application root.
 *
 * @param appRoot Application root used as the base for relative patterns
 * @param config CLI configuration whose plugin patterns are resolved
 * @returns Configuration with resolved plugin discovery patterns
 */
function resolveConfigPatterns(appRoot: string, config: IAppConfig): IAppConfig {
  const resolvePatterns = (plugin: IPluginDiscoveryConfig | undefined): IPluginDiscoveryConfig => ({
    ...plugin,
    patterns: resolveDiscoveryPatterns(appRoot, plugin?.patterns ?? []),
  });

  return {
    ...config,
    plugins: {
      [PLUGIN_COMMAND_TYPE]: resolvePatterns(config.plugins[PLUGIN_COMMAND_TYPE]),
      [PLUGIN_CONTEXT_TYPE]: resolvePatterns(config.plugins[PLUGIN_CONTEXT_TYPE]),
      [PLUGIN_FORMATTER_TYPE]: resolvePatterns(config.plugins[PLUGIN_FORMATTER_TYPE]),
    },
  };
}

/**
 * Merges a configuration override over the defaults and resolves the relative
 * discovery patterns against the given application root. Used for in-memory
 * configurations; file-backed ones go through `loadConfig`.
 *
 * @param appRoot Application root used as the base for relative patterns
 * @param override Configuration override merged over the defaults
 * @returns Resolved CLI configuration
 */
export function createAppConfig(appRoot: string, override: TCliConfigOverride): IAppConfig {
  const config = mergeConfigs(APP_CONFIG_DEFAULT, override);
  return resolveConfigPatterns(appRoot, config);
}

/**
 * Loads a YAML CLI configuration file, merges it over the defaults and resolves
 * relative command discovery patterns against the application root.
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
