import type { McpServer, McpServerFactory } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { TLogger, UConsoleLevels } from '@orion76/logger';
import type { IPluginManager } from '@orion76/node-plugin';
import { inject, injectable } from 'inversify';

import {
  buildHierarchy,
  COMMAND_MANAGER_TOKEN,
  COMMAND_RUNNER_TOKEN,
  FORMATTER_MANAGER_TOKEN,
  IAppConfig,
  type ICommandResult,
  type ICommandRunner,
  IEngine,
  type IPluginCommand,
  type IPluginFormatter,
} from '@clapp/common';

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
  @inject(COMMAND_MANAGER_TOKEN) private readonly pluginManager!: IPluginManager<IPluginCommand>;
  @inject(COMMAND_RUNNER_TOKEN) private readonly commandRunner!: ICommandRunner;
  @inject(FORMATTER_MANAGER_TOKEN) private readonly formatterManager!: IPluginManager<IPluginFormatter>;

  /** Commands of the project grouped by the MCP surface they are exposed through. */
  private registry!: IMCPEntityRegistry;


  private readonly serverFactory: McpServerFactory = () => this.createServer();


  /**
   * Builds the registry of the entities the surfaces expose.
   *
   * The argument chain rewrites the definitions before the registry is built: the registry
   * carries the rewritten definition into the argument schema and into the execution of an
   * MCP call, so an argument a chain step fills is advertised as optional and a client is
   * not required to send it.
   */
  async initialize(): Promise<void> {
    const commandDefinitions = await this.pluginManager.getDefinitions();
    const overriddenDefinitions = await Promise.all(
      commandDefinitions.map((definition) => this.commandRunner.prepareDefinition(definition)),
    );
    const commandNodes = buildHierarchy(overriddenDefinitions);
    const registry = buildEntityRegistry(commandNodes, this.config.schemas.formatters);

    this.reportSkipped(registry.skipped);
    this.registry = registry;
  }

  public async run(): Promise<void> {
    serveStdio(this.serverFactory, { onerror: (error) => this.reportServerError(error) });
  }

  /**
   * Runs the command of an entity through the runner the CLI host uses as well.
   *
   * The entity carries the definition the argument chain has already rewritten, so the
   * execution sees the same arguments, options and filled values as a CLI run of the command.
   * @param entity Entity the surface registered
   * @param input Values the client sent
   * @returns Result of the command action, or a failed result naming why it did not run
   */
  public async executeCommand(entity: IMCPEntity, input: IMCPCommandInput): Promise<ICommandResult> {
    try {
      return await this.commandRunner.run(entity.definition, input);
    } catch (error) {
      this.log('Command execution error:', error, 'error');

      throw error;
    }
  }

  /**
   * Runs the command of an entity and returns the text of its formatted result.
   * @param entity Entity the surface registered
   * @param input Values the client sent
   * @returns Text of the command result, rendered with the formatter of the command
   * @throws Error when the command reports a failed result or the formatter rejects the data
   */
  public async invokeCommand(entity: IMCPEntity, input: IMCPCommandInput): Promise<string> {
    const result = await this.executeCommand(entity, input);

    if (!result.success) {
      throw new Error(result.error?.join('; ') ?? `Command '${entity.path}' failed`);
    }

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

  /**
   * Renders the result of an entity with the formatter the app config maps to its schema.
   * @param entity Entity the surface registered
   * @param result Result of the command action
   * @returns Text of the result in the output format of the host
   * @throws Error when the schema of the entity has no formatter or the formatter rejects the data
   */
  private async renderResult(entity: IMCPEntity, result: ICommandResult): Promise<string> {
    const formatter = await this.resolveFormatter(entity.dataSchema);

    try {
      return await formatter.format(result.data);
    } catch (error) {
      throw new Error(
        `Command '${entity.path}': formatter '${formatter.definition.id}' failed: ${toErrorMessage(error)}`,
      );
    }
  }

  /**
   * Resolves the formatter the app config maps to a data schema.
   * @param dataSchema `$id` of the schema that describes the data of the command
   * @returns Formatter plugin registered for the schema
   * @throws Error when the schema has no formatter in `schemas.formatters` or the formatter is
   * not among the loaded plugins
   */
  private async resolveFormatter(dataSchema: string): Promise<IPluginFormatter> {
    const formatterId = this.config.schemas.formatters[dataSchema];

    if (formatterId === undefined) {
      throw new Error(`data schema '${dataSchema}' has no formatter in "schemas.formatters"`);
    }

    const definitions = await this.formatterManager.getDefinitions();

    if (!definitions.some((definition) => definition.id === formatterId)) {
      throw new Error(
        `formatter '${formatterId}' mapped to data schema '${dataSchema}' is not available: no formatter plugin with this identifier is registered`,
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
