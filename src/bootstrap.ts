import { providePluginManager, type IPluginManager } from '@orion76/node-plugin';
import { CommanderError } from 'commander';
import type { Container } from 'inversify';

import {
  COMMAND_ARGUMENT_MANAGER_TOKEN,
  COMMAND_MANAGER_TOKEN,
  COMMAND_RUNNER_TOKEN,
  COMMAND_SERVICE_TOKEN,
  CommandRunner,
  CommandService,
  CONTEXT_MANAGER_TOKEN,
  EVENT_BUS_TOKEN,
  EventBus,
  FORMATTER_MANAGER_TOKEN,
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
  Type,
  assertKnownArgumentNames,
  getAppMeta,
  initAppMeta,
  resolveExitCode,
} from '@clapp/common';
import { APP_CONFIG_PATH_DEFAULT } from './constants/paths';
import { APP_CONFIG_TOKEN, CLAPP_LOGGER_TOKEN, ENGINE_TOKEN, SCHEMA_REGISTRY_TOKEN } from './constants/tokens';

import { ClappPluginLoader, type IClappPluginLoaderConfig } from './plugin-loader';
import { loadConfig } from './public-api';
import { buildSchemaRegistry } from './schemas';

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
    disabled: pluginConfig.disabled ?? [],
    sources: pluginConfig.sources.map((source) => ({ patterns: source.patterns, disabled: source.disabled ?? [] })),
  };
}

/**
 * Binds the value of every discovered context plugin under the token of its own
 * definition. The value is created on the first request of the token and cached by
 * the singleton scope, so nothing is built while the definitions are walked — a
 * context may inject the tokens of other contexts registered in the same loop.
 * @param container Application container
 * @param manager Manager of the context plugins
 */
export async function bindContextValues(container: Container, manager: IPluginManager<IPluginContext>): Promise<void> {
  const definitions = await manager.getDefinitions();

  for (const definition of definitions) {
    container
      .bind<unknown>(definition.id)
      .toResolvedValue(async () => {
        const plugin = await manager.getInstance(definition.id);
        return plugin.getContext();
      })
      .inSingletonScope();
  }
}


export async function bootstrapApp(engineClass: Type<IEngine>, container: Container, options: IInitAppOptions = {}): Promise<IEngine> {
  initAppMeta();
  const { cwd, userHome, appRoot } = getAppMeta();
  const projectRoot = resolveProjectRoot(cwd, userHome);
  const configPath = options.configPath ?? APP_CONFIG_PATH_DEFAULT;
  const config = await loadConfig(configPath, appRoot, projectRoot);

  container.bind(EVENT_BUS_TOKEN).to(EventBus).inSingletonScope();

  container.bind(COMMAND_SERVICE_TOKEN).to(CommandService).inSingletonScope();
  container.bind(COMMAND_RUNNER_TOKEN).to(CommandRunner).inSingletonScope();
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

  const argumentManager = await container.getAsync(COMMAND_ARGUMENT_MANAGER_TOKEN);
  assertKnownArgumentNames(await argumentManager.getDefinitions());

  providePluginManager<IPluginContext>(
    PLUGIN_CONTEXT_TYPE,
    CONTEXT_MANAGER_TOKEN,
    { config: createLoaderConfig(config.plugins[PLUGIN_CONTEXT_TYPE]), pluginLoaderCls: ClappPluginLoader },
    container,
  );

  const contextManager = await container.getAsync(CONTEXT_MANAGER_TOKEN);
  await bindContextValues(container, contextManager);

  providePluginManager<IPluginFormatter>(
    PLUGIN_FORMATTER_TYPE,
    FORMATTER_MANAGER_TOKEN,
    { config: createLoaderConfig(config.plugins[PLUGIN_FORMATTER_TYPE]), pluginLoaderCls: ClappPluginLoader },
    container,
  );

  const formatterManager = await container.getAsync(FORMATTER_MANAGER_TOKEN);
  const formatterDefinitions = await formatterManager.getDefinitions();
  const schemaRegistry = await buildSchemaRegistry(
    config.schemas,
    formatterDefinitions.map((definition) => definition.id),
  );

  container.bind(SCHEMA_REGISTRY_TOKEN).toConstantValue(schemaRegistry);

  const app = await container.getAsync(ENGINE_TOKEN);

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
