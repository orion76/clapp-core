import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';

import { load as loadYaml } from 'js-yaml';


import { IAppConfig, TCliConfigCustom } from '@clapp/common';
import { APP_CONFIG_PATH_DEFAULT, APP_CONFIG_PATH_DEV } from '../constants/paths';
import { createAppConfig } from './create-configs';

/**
 * Resolves relative module patterns against the given root. Absolute patterns
 * are kept as-is.
 *
 * @param root Base of the relative patterns
 * @param patterns Module patterns
 * @returns Resolved module patterns
 */
export function resolveFilePathPatterns(root: string, patterns: string[]): string[] {
  const resolvedRoot = resolve(root);
  return patterns.map((pattern) => (isAbsolute(pattern) ? pattern : resolve(resolvedRoot, pattern)));
}

/**
 * Selects the config file of the application by mode. The mode is read from
 * `CLAPP_MODE`, then `NODE_ENV`, and defaults to `production`. In `development`
 * the `clapp.config.dev.yml` file is used when it exists and the base config
 * otherwise, so an absent dev file never breaks the run.
 *
 * @param appRoot Application root the config file name is resolved against
 * @returns Absolute path of the selected config file
 */
export function resolveConfigPath(appRoot: string): string {
  const mode = process.env.CLAPP_MODE ?? process.env.NODE_ENV ?? 'production';
  const baseConfigPath = resolve(appRoot, APP_CONFIG_PATH_DEFAULT);

  if (mode !== 'development') {
    return baseConfigPath;
  }

  const devConfigPath = resolve(appRoot, APP_CONFIG_PATH_DEV);

  return existsSync(devConfigPath) ? devConfigPath : baseConfigPath;
}

/**
 * Loads a YAML CLI configuration file, merges it over the defaults and resolves
 * the sources of its plugin types.
 * @param configPath Path to the YAML config file
 * @param appRoot Application root; defaults to the config file directory
 * @returns Resolved CLI configuration
 */
export async function loadConfig(configPath: string, appRoot: string, projectRoot?: string): Promise<IAppConfig> {
  const resolvedConfigPath = resolve(configPath);
  const contents = await readFile(resolvedConfigPath, 'utf8');
  const customConfig = loadYaml(contents) as TCliConfigCustom;

  return createAppConfig(customConfig, appRoot, projectRoot);
}
