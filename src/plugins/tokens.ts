import type { ServiceIdentifier } from 'inversify';
import type { IPluginManager } from '@orion76/node-plugin';
import type { CLIConfig, IPluginCommand } from '@clapp/common';

/**
 * Injection token of the command plugin manager registered by `Clapp`.
 */
export const COMMAND_MANAGER_TOKEN: ServiceIdentifier<IPluginManager<IPluginCommand>> = Symbol('COMMAND_MANAGER');

/**
 * Injection token of the CLI application configuration consumed by `Clapp`.
 * The value is bound in the scoped container created by `Clapp.create`.
 */
export const CLI_CONFIG_TOKEN: ServiceIdentifier<CLIConfig> = Symbol('CLI_CONFIG');
