import type { IPluginManager } from '@orion76/node-plugin';
import type { ServiceIdentifier } from 'inversify';

import type { IClapp, IPluginCommand, IPluginContext, IPluginFormatter } from '@clapp/common';
import { ILoggerCollection, TLogger } from '@orion76/logger';
import { IAppConfig, ULoggerNames } from '../types';
import { IEngine } from '../engines/engine-facade.base';

export const LOGGER_COLLECTION_TOKEN: ServiceIdentifier<ILoggerCollection<ULoggerNames>> = Symbol('LOGGER_COLLECTION_TOKEN');

/**
 * Injection token of the command plugin manager registered by `Clapp`.
 */
export const COMMAND_MANAGER_TOKEN: ServiceIdentifier<IPluginManager<IPluginCommand>> = Symbol('COMMAND_MANAGER');
export const CONTEXT_MANAGER_TOKEN: ServiceIdentifier<IPluginManager<IPluginContext>> = Symbol('CONTEXT_MANAGER_');

/**
 * Injection token of the formatter plugin manager registered by `Clapp`.
 */
export const FORMATTER_MANAGER_TOKEN: ServiceIdentifier<IPluginManager<IPluginFormatter>> = Symbol('FORMATTER_MANAGER');

/**
 * Injection token of the resolved CLI configuration used by `Clapp`.
 */
export const APP_CONFIG_TOKEN: ServiceIdentifier<IAppConfig> = Symbol('CLI_CONFIG');

/**
 * Injection token of the CLI application instance.
 */
export const CLAPP_TOKEN: ServiceIdentifier<IClapp> = Symbol('CLAPP_TOKEN');
export const CLAPP_LOGGER_TOKEN: ServiceIdentifier<TLogger> = Symbol('CLAPP_LOGGER_TOKEN');

export const ENGINE_TOKEN: ServiceIdentifier<IEngine> = Symbol('ENGINE_TOKEN');
