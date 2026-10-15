import type { IPluginManager } from '@orion76/node-plugin';
import type { ServiceIdentifier } from 'inversify';

import type { IClapp, IPluginCommand, IPluginContext } from '@clapp/common';
import { ILoggerCollection, TLogger } from '@orion76/logger';
import { ICliConfig, ULoggerNames } from '../types';

export const LOGGER_COLLECTION_TOKEN: ServiceIdentifier<ILoggerCollection<ULoggerNames>> = Symbol('LOGGER_COLLECTION_TOKEN');

/**
 * Injection token of the command plugin manager registered by `Clapp`.
 */
export const COMMAND_MANAGER_TOKEN: ServiceIdentifier<IPluginManager<IPluginCommand>> = Symbol('COMMAND_MANAGER');
export const CONTEXT_MANAGER_TOKEN: ServiceIdentifier<IPluginManager<IPluginContext>> = Symbol('CONTEXT_MANAGER_');

/**
 * Injection token of the resolved CLI configuration used by `Clapp`.
 */
export const CLI_CONFIG_TOKEN: ServiceIdentifier<ICliConfig> = Symbol('CLI_CONFIG');

/**
 * Injection token of the CLI application instance.
 */
export const CLAPP_TOKEN: ServiceIdentifier<IClapp> = Symbol('CLAPP_TOKEN');
export const CLAPP_LOGGER_TOKEN: ServiceIdentifier<TLogger> = Symbol('CLAPP_LOGGER_TOKEN');
