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
  plugins: Record<UPluginTypes, IPluginDiscoveryConfig>;
  loggers: Record<ULoggerNames, ILoggerConfig>;
}

export type TCliConfigOverride = Omit<IAppConfig, 'plugins' | 'loggers'> & {
  plugins?: Record<UPluginTypes, IPluginDiscoveryConfig>;
  loggers?: Record<ULoggerNames, ILoggerConfig>;
};
export interface IEngine {
  run(argv: readonly string[]): Promise<void>;
  initialize(): Promise<void>;
}
