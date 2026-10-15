import { providePluginManager } from '@orion76/node-plugin';
import { CommanderError } from 'commander';
import type { Container } from 'inversify';

import { EVENT_BUS_TOKEN, type IPluginCommand, type IPluginContext, type IPluginFormatter } from '@clapp/common';

import { IClapp, PLUGIN_COMMAND_TYPE, PLUGIN_CONTEXT_TYPE, PLUGIN_FORMATTER_TYPE } from '@clapp/common';
import { Clapp } from './clapp';
import { APP_CONFIG_PATH_DEFAULT } from './constants/paths';
import {
  CLAPP_LOGGER_TOKEN,
  CLI_CONFIG_TOKEN,
  COMMAND_MANAGER_TOKEN,
  CONTEXT_MANAGER_TOKEN,
  FORMATTER_MANAGER_TOKEN,
} from './constants/tokens';
import { EventBus } from './events/event-bus';
import { createAppConfig, getAppConfig, resolveExitCode } from './public-api';
import type { IInitAppOptions } from './types';
import { loggerBind, loggerCollectionBind } from './utils/logger';

export async function bootstrapApp(container: Container, options: IInitAppOptions = {}): Promise<IClapp> {
  const {
    configPath = APP_CONFIG_PATH_DEFAULT,
    config: configOverride,
    appRoot = process.cwd(),
    argv = process.argv,
  } = options;
  const config = configOverride ? createAppConfig(appRoot, configOverride) : await getAppConfig(configPath, appRoot);

  container.bind(EVENT_BUS_TOKEN).to(EventBus).inSingletonScope();

  loggerCollectionBind(container);

  container.bind(CLI_CONFIG_TOKEN).toConstantValue(config);

  loggerBind('clapp_cli', config.loggers.clapp_cli, container, CLAPP_LOGGER_TOKEN);
  container.bind(Clapp).toSelf().inSingletonScope();

  providePluginManager<IPluginCommand>(
    PLUGIN_COMMAND_TYPE,
    COMMAND_MANAGER_TOKEN,
    { config: config.plugins[PLUGIN_COMMAND_TYPE] },
    container,
  );

  providePluginManager<IPluginContext>(
    PLUGIN_CONTEXT_TYPE,
    CONTEXT_MANAGER_TOKEN,
    { config: config.plugins[PLUGIN_CONTEXT_TYPE] },
    container,
  );

  providePluginManager<IPluginFormatter>(
    PLUGIN_FORMATTER_TYPE,
    FORMATTER_MANAGER_TOKEN,
    { config: config.plugins[PLUGIN_FORMATTER_TYPE] },
    container,
  );
  const app = container.get(Clapp);

  await app.initialize(argv);
  return app;
}

export async function run(container: Container, options?: IInitAppOptions) {
  const argv = options?.argv ?? process.argv;
  try {
    const app = await bootstrapApp(container, { ...options, argv });
    await app.run(argv);
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
