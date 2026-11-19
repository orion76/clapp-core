import type { ServiceIdentifier } from 'inversify';

import type { IAppConfig, IClapp, IEngine } from '@clapp/common';
import { ILoggerCollection, TLogger } from '@orion76/logger';

import type { ISchemaRegistry } from '../schemas/types';


export const LOGGER_COLLECTION_TOKEN: ServiceIdentifier<ILoggerCollection> = Symbol('LOGGER_COLLECTION_TOKEN');


/**
 * Injection token of the resolved CLI configuration used by `Clapp`.
 */
export const APP_CONFIG_TOKEN: ServiceIdentifier<IAppConfig> = Symbol('CLI_CONFIG');

/**
 * Injection token of the data schema registry of the application.
 */
export const SCHEMA_REGISTRY_TOKEN: ServiceIdentifier<ISchemaRegistry> = Symbol('SCHEMA_REGISTRY_TOKEN');

/**
 * Injection token of the CLI application instance.
 */
export const CLAPP_TOKEN: ServiceIdentifier<IClapp> = Symbol('CLAPP_TOKEN');
export const CLAPP_LOGGER_TOKEN: ServiceIdentifier<TLogger> = Symbol('CLAPP_LOGGER_TOKEN');

export const ENGINE_TOKEN: ServiceIdentifier<IEngine> = Symbol('ENGINE_TOKEN');
