import type { McpServer, McpServerFactory } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { TLogger, UConsoleLevels } from '@orion76/logger';
import type { IPluginManager } from '@orion76/node-plugin';
import { inject, injectable } from 'inversify';

import {
  COMMAND_MANAGER_TOKEN,
  EVENT_BUS_TOKEN,
  FORMATTER_MANAGER_TOKEN,
  IAppConfig,
  IClappLifecycleMap,
  type ICommandResult,
  IEngine,
  type IEventBus,
  type IPluginCommand,
  type IPluginFormatter,
  PLUGIN_COMMAND_TYPE,
} from '@clapp/common';



import { buildHierarchy } from '../../../../common/src/plugin-types/command/utils';
import { APP_CONFIG_TOKEN, CLAPP_LOGGER_TOKEN } from '../../public-api';
import { toErrorMessage } from './error-message';
import { registerPrompts } from './register-prompts';
import { registerResources } from './register-resources';
import { registerTools } from './register-tools';
import { buildEntityRegistry } from './registry';
import type { IMCPCommandInput, IMCPCommandInvoker, IMCPEntity, IMCPEntityRegistry, IMCPEntitySkip } from './types';
import { buildServerInfo, createMCPServer } from './utils';


@injectable()
export class MCPEngine implements IEngine, IMCPCommandInvoker {
  @inject(CLAPP_LOGGER_TOKEN) private readonly logger!: TLogger;
  @inject(APP_CONFIG_TOKEN) private readonly config!: IAppConfig;
  @inject(EVENT_BUS_TOKEN) private readonly eventBus!: IEventBus<IClappLifecycleMap>;
  @inject(COMMAND_MANAGER_TOKEN) private readonly pluginManager!: IPluginManager<IPluginCommand>;
  @inject(FORMATTER_MANAGER_TOKEN) private readonly formatterManager!: IPluginManager<IPluginFormatter>;

  /** Commands of the project grouped by the MCP surface they are exposed through. */
  private registry!: IMCPEntityRegistry;


  private readonly serverFactory: McpServerFactory = () => this.createServer();


  async initialize(): Promise<void> {
    const commandDefinitions = await this.pluginManager.getDefinitions();
    const commandNodes = buildHierarchy(commandDefinitions);
    const registry = buildEntityRegistry(commandNodes);

    this.reportSkipped(registry.skipped);
    this.registry = registry;
  }

  public async run(): Promise<void> {
    serveStdio(this.serverFactory, { onerror: (error) => this.reportServerError(error) });
  }

  public async executeCommand(entity: IMCPEntity, input: IMCPCommandInput): Promise<ICommandResult> {
    const { path, definition } = entity;
    const { args, opts } = input;

    try {
      await this.hook('command:start', path, { args, opts });
      const plugin = await this.pluginManager.getInstance(definition.id);

      if (typeof plugin.action !== 'function') {
        throw new Error(`Command '${path}' has no action to run.`);
      }

      await this.hook('command:arguments', path, { args, opts });
      const pluginArgs = await plugin.getArguments(args, opts);
      await this.hook('command:run', path, { args: pluginArgs });
      const result = await plugin.action(pluginArgs);

      if (result.success === false) {
        throw new Error(result.error?.join('; ') ?? `Command '${path}' failed`);
      }

      await this.hook('command:end', path, { result });

      return result;
    } catch (error) {
      this.log('Command execution error:', error, 'error');

      try {
        await this.hook('command:error', path, { error });
      } catch (hookError) {
        this.log('command:error hook failed:', hookError, 'error');
      }

      throw error;
    }
  }
  private hook<E extends keyof IClappLifecycleMap>(event: E, pluginId: string, data: IClappLifecycleMap[E]['data']) {
    return this.eventBus.hook(event, { id: pluginId, type: PLUGIN_COMMAND_TYPE, data })
  }

  public async invokeCommand(entity: IMCPEntity, input: IMCPCommandInput): Promise<string> {
    const result = await this.executeCommand(entity, input);

    return this.renderResult(entity, result);
  }

  /**
   * Builds the MCP server of one connection.
   *
   * The server is built from the server info of the application config and gets the surfaces
   * of the entities the engine collected during `initialize`: every connection receives its
   * own registration of them, which keeps them cheap and deterministic. A surface registers
   * the entities of its kind with the callbacks that run their commands through the pipeline
   * of the engine.
   * @returns Server ready to be connected to the transport
   */
  private createServer(): McpServer {
    const server = createMCPServer(buildServerInfo(this.config));
    const { tools, resources, prompts } = this.registry;

    registerTools(server, tools, this);
    registerResources(server, resources, this);
    registerPrompts(server, prompts, this);

    return server;
  }

  private async renderResult(entity: IMCPEntity, result: ICommandResult): Promise<string> {
    try {
      const formatter = await this.resolveFormatter(entity.formatter);

      return await formatter.format(result.data);
    } catch (error) {
      throw new Error(`Command '${entity.path}': formatter '${entity.formatter}' failed: ${toErrorMessage(error)}`);
    }
  }

  private async resolveFormatter(formatterId: string): Promise<IPluginFormatter> {
    const definitions = await this.formatterManager.getDefinitions();

    if (!definitions.some((definition) => definition.id === formatterId)) {
      throw new Error(
        `formatter '${formatterId}' is not available: no formatter plugin with this identifier is registered`,
      );
    }

    return this.formatterManager.getInstance(formatterId);
  }

  /**
   * Reports the commands that have no MCP surface.
   * @param skipped Commands left out of the registry, each with its reason
   */
  private reportSkipped(skipped: IMCPEntitySkip[]): void {
    for (const { path, reason } of skipped) {
      this.reportToStderr(`command '${path}' is not exposed: ${reason}`);
    }
  }

  private reportServerError(error: unknown): void {
    this.reportToStderr(`transport error: ${toErrorMessage(error)}`);
  }

  private reportToStderr(message: string): void {
    process.stderr.write(`[mcp] ${message}\n`);
  }

  private log(message: string, data: unknown, level?: UConsoleLevels) {
    this.logger.send([message, data], level);
  }
}
