import { providePluginManager } from '@orion76/node-plugin';
import { CommanderError } from 'commander';
import type { Container } from 'inversify';


import {
  EVENT_BUS_TOKEN,
  IPluginContext,
  PLUGIN_COMMAND_TYPE,
  PLUGIN_CONTEXT_TYPE,
  PLUGIN_FORMATTER_TYPE,
  Type,
} from '@clapp/common';
import { APP_CONFIG_PATH_DEFAULT } from './constants/paths';
import {
  APP_CONFIG_TOKEN,
  CLAPP_LOGGER_TOKEN,
  COMMAND_MANAGER_TOKEN,
  CONTEXT_MANAGER_TOKEN,
  ENGINE_TOKEN,
  FORMATTER_MANAGER_TOKEN,
} from './constants/tokens';


import { EventBus } from './events/event-bus';
import { ClappPluginLoader, type IClappPluginLoaderConfig } from './plugin-loader';
import { getAppConfig, resolveExitCode } from './public-api';
import type { IEngine, IInitAppOptions } from './types';

import { loggerBind, loggerCollectionBind } from './utils/logger';
import { IPluginCommand, IPluginFormatter } from '@clapp/common';
import { IPluginDiscoveryConfig } from './types/plugin-config';






/**
 * Converts the source based plugin config of a type into the config of the clapp
 * plugin loader: the patterns of every source (already resolved against the root
 * of their source) plus the `disabled` lists the loader applies per source and
 * per type.
 *
 * @param pluginConfig Discovery config of a plugin type
 * @returns Loader config of the plugin type
 */
function createLoaderConfig(pluginConfig: IPluginDiscoveryConfig): IClappPluginLoaderConfig {
  return {
    patterns: pluginConfig.sources.flatMap((source) => source.patterns),
    sources: pluginConfig.sources.map((source) => ({ patterns: source.patterns, disabled: source.disabled })),
    disabled: pluginConfig.disabled,
  };
}

export async function bootstrapApp(engineClass: Type<IEngine>, container: Container, options: IInitAppOptions = {}): Promise<IEngine> {
  const { appRoot } = options;
  const configPath = options.configPath ?? APP_CONFIG_PATH_DEFAULT;
  const config = await getAppConfig(configPath, appRoot);

  container.bind(EVENT_BUS_TOKEN).to(EventBus).inSingletonScope();

  loggerCollectionBind(container);

  container.bind(APP_CONFIG_TOKEN).toConstantValue(config);

  loggerBind('clapp_cli', config.loggers.clapp_cli, container, CLAPP_LOGGER_TOKEN);
  container.bind(ENGINE_TOKEN).to(engineClass).inSingletonScope();

  providePluginManager<IPluginCommand>(
    PLUGIN_COMMAND_TYPE,
    COMMAND_MANAGER_TOKEN,
    { config: createLoaderConfig(config.plugins[PLUGIN_COMMAND_TYPE]), pluginLoaderCls: ClappPluginLoader },
    container,
  );

  providePluginManager<IPluginContext>(
    PLUGIN_CONTEXT_TYPE,
    CONTEXT_MANAGER_TOKEN,
    { config: createLoaderConfig(config.plugins[PLUGIN_CONTEXT_TYPE]), pluginLoaderCls: ClappPluginLoader },
    container,
  );

  providePluginManager<IPluginFormatter>(
    PLUGIN_FORMATTER_TYPE,
    FORMATTER_MANAGER_TOKEN,
    { config: createLoaderConfig(config.plugins[PLUGIN_FORMATTER_TYPE]), pluginLoaderCls: ClappPluginLoader },
    container,
  );

  const app = container.get(ENGINE_TOKEN);

  await app.initialize();
  return app;
}

export async function run(engineClass: Type<IEngine>, container: Container, options?: IInitAppOptions) {
  try {
    const app = await bootstrapApp(engineClass, container, { ...options });
    await app.run(process.argv);
    process.exitCode = 0;
  } catch (error) {
    process.exitCode = resolveExitCode(error);
    if (process.exitCode !== 0) {
      reportFailedRun(error);
    }
  }
}

/**
 * Reports a CLI run that ended with a non-zero exit code.
 *
 * Commander errors are not reported here: commander has already written the parse error
 * message, the usage hint configured with `showHelpAfterError()` and, for `--help` /
 * `--version`, the requested text to the output streams. Printing the caught error again
 * would only duplicate that line or dump the `CommanderError` object with its stack.
 * Unexpected failures — command errors, configuration problems — are printed here with
 * their message and stack.
 * @param error Error caught by the CLI entrypoint
 */
function reportFailedRun(error: unknown): void {
  if (error instanceof CommanderError) {
    return;
  }
  console.error(error);
}
