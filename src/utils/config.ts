import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';

import { load as loadYaml } from 'js-yaml';

import type { IAppConfig, TCliConfigCustom } from '../types';
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
