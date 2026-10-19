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

export interface IInitAppOptions {
  configPath?: string;
  appRoot?: string;
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
export interface IAppConfig {
  name: string;
  description: string;
  version: string;
  /**
   * Discovery configuration of every plugin type: the sources its plugins come
   * from (see `IPluginSourceConfig` in `@clapp/common`) and the disabled ids.
   */
  plugins: Record<UPluginTypes, IPluginDiscoveryConfig>;
  loggers: Record<ULoggerNames, ILoggerConfig>;
}

/**
 * Configuration override of a CLI application: the same shape as `IAppConfig`,
 * but the plugin and logger sections are optional and the plugin section is
 * validated and completed with the defaults while the config is loaded.
 */
export type TCliConfigOverride = Omit<IAppConfig, 'plugins' | 'loggers'> & {
  plugins?: Record<UPluginTypes, IPluginDiscoveryConfig>;
  loggers?: Record<ULoggerNames, ILoggerConfig>;
};
export interface IEngine {
  run(argv: readonly string[]): Promise<void>;
  initialize(): Promise<void>;
}
