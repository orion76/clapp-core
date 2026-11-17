import { providePluginManager } from '@orion76/node-plugin';
import { CommanderError } from 'commander';
import type { Container, ServiceIdentifier } from 'inversify';

import {
  AppContext,
  COMMAND_ARGUMENT_MANAGER_TOKEN,
  COMMAND_MANAGER_TOKEN,
  COMMAND_SERVICE_TOKEN,
  CommandService,
  CONTEXT_MANAGER_TOKEN,
  CONTEXT_SERVICE_TOKEN,
  CONTEXT_TOKENS,
  EVENT_BUS_TOKEN,
  EventBus,
  FORMATTER_MANAGER_TOKEN,
  type IContextService,
  IEngine,
  IInitAppOptions,
  IPluginCommand,
  IPluginCommandArgument,
  IPluginContext,
  IPluginDiscoveryConfig,
  IPluginFormatter,
  PLUGIN_COMMAND_ARGUMENT_TYPE,
  PLUGIN_COMMAND_TYPE,
  PLUGIN_CONTEXT_TYPE,
  PLUGIN_FORMATTER_TYPE,
  type TContextAccessor,
  Type,
  getAppMeta,
  initAppMeta,
  resolveExitCode,
} from '@clapp/common';
import { APP_CONFIG_PATH_DEFAULT } from './constants/paths';
import { APP_CONFIG_TOKEN, CLAPP_LOGGER_TOKEN, ENGINE_TOKEN } from './constants/tokens';

import { ClappPluginLoader, type IClappPluginLoaderConfig } from './plugin-loader';
import { loadConfig } from './public-api';

import { resolveProjectRoot } from '@clapp/utils';

import { loggerBind, loggerCollectionBind } from './utils/logger';


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
    sources: pluginConfig.sources.map((source) => ({ patterns: source.patterns })),
  };
}

/**
 * Binds every built-in context token as a lazy accessor, so a plugin gets a context
 * value through `@inject(TOKEN)` and calls the accessor only when the value is needed.
 *
 * The accessor is lazy on purpose: `IContextService.get` is asynchronous while DI
 * injection is synchronous, so an eager binding would resolve every context at startup
 * and an unavailable one — no project root outside a project, for instance — would take
 * the whole host down, `--help` included. A lazy accessor keeps the failure in the
 * command that actually asks for the value.
 * @param container Application container
 */
function bindContextAccessors(container: Container): void {
  for (const token of CONTEXT_TOKENS) {
    container
      .bind<TContextAccessor<unknown>>(token)
      .toDynamicValue(() => () => container.get<IContextService>(CONTEXT_SERVICE_TOKEN).get(token));
  }
}


export async function bootstrapApp(engineClass: Type<IEngine>, container: Container, options: IInitAppOptions = {}): Promise<IEngine> {
  initAppMeta();
  const { cwd, userHome, appRoot } = getAppMeta();
  const projectRoot = resolveProjectRoot(cwd, userHome);
  const configPath = options.configPath ?? APP_CONFIG_PATH_DEFAULT;
  const config = await loadConfig(configPath, appRoot, projectRoot);

  container.bind(EVENT_BUS_TOKEN).to(EventBus).inSingletonScope();

  container.bind(CONTEXT_SERVICE_TOKEN).to(AppContext);
  bindContextAccessors(container);
  container.bind(COMMAND_SERVICE_TOKEN).to(CommandService).inSingletonScope();
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

  providePluginManager<IPluginCommandArgument>(
    PLUGIN_COMMAND_ARGUMENT_TYPE,
    COMMAND_ARGUMENT_MANAGER_TOKEN,
    { config: createLoaderConfig(config.plugins[PLUGIN_COMMAND_ARGUMENT_TYPE]), pluginLoaderCls: ClappPluginLoader },
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
