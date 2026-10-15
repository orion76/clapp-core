import type { IPluginCommandDefinition, IPluginDiscoveryConfig, UPluginTypes } from '@clapp/common';
import { ILoggerConfig } from '@orion76/logger';

/**
 * Node of the command hierarchy built from the flat definition list.
 * Nodes with children are groups; leaf nodes are executable commands.
 */
export interface ICommandNode {
  definition: IPluginCommandDefinition;
  children: ICommandNode[];
}

/**
 * Options accepted by `initApp`. Exactly one of `configPath` (YAML file) or
 * `config` (in-memory `ICliConfig`) may be provided.
 */
export interface IInitAppOptions {
  /** Path to the YAML configuration file. */
  configPath?: string;
  /** In-memory CLI configuration; alternative to `configPath`. */
  config?: ICliConfig;
  /** Application root used to resolve relative discovery patterns. Defaults to the config directory or cwd. */
  appRoot?: string;
  /** Process arguments used to detect informational runs (`--help`, `--version`). Defaults to `process.argv`. */
  argv?: string[];
}

/**
 * Names of the loggers registered by `@clapp/core`.
 */
export type ULoggerNames = 'clapp_cli';

export interface ICommandExecArguments {
  name: string;
  args: string[];
  opts: Record<string, string>;
}
/**
 * Supported JavaScript/TypeScript runtimes a CLI application may run under.
 */
export type TAppRuntime = 'node' | 'tsx' | 'bun' | 'deno';

/**
 * CLI application configuration
 */
export interface ICliConfig {
  name: string;
  description: string;
  version: string;
  plugins: Record<UPluginTypes, IPluginDiscoveryConfig>;
  loggers: Record<ULoggerNames, ILoggerConfig>;
}

export type TCliConfigOverride = Omit<ICliConfig, 'plugins' | 'loggers'> & {
  plugins?: Record<UPluginTypes, IPluginDiscoveryConfig>;
  loggers?: Record<ULoggerNames, ILoggerConfig>;
};
