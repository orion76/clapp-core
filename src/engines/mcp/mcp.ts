import type { McpServer, McpServerFactory } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { TLogger, UConsoleLevels } from '@orion76/logger';
import type { IPluginManager } from '@orion76/node-plugin';
import { inject, injectable } from 'inversify';

import {
  EVENT_BUS_TOKEN,
  type ICommandResult,
  type IEventBus,
  type IPluginCommand,
  type IPluginFormatter,
  PLUGIN_COMMAND_TYPE,
} from '@clapp/common';

import {
  CLAPP_LOGGER_TOKEN,
  APP_CONFIG_TOKEN,
  COMMAND_MANAGER_TOKEN,
  FORMATTER_MANAGER_TOKEN,
} from '../../public-api';
import { IAppConfig, IEngine } from '../../types';
import { buildHierarchy } from '../../utils';
import { toErrorMessage } from './error-message';
import { buildEntityRegistry } from './registry';
import { registerPrompts } from './register-prompts';
import { registerResources } from './register-resources';
import { registerTools } from './register-tools';
import type { IMCPCommandInput, IMCPCommandInvoker, IMCPEntity, IMCPEntityRegistry, IMCPEntitySkip } from './types';
import { buildServerInfo, createMCPServer } from './utils';

/**
 * Engine that runs a project as an MCP server over the commands of its plugins.
 *
 * The engine maps the commands of the project to the MCP surfaces by their kind
 * (`resource` → Resources, `tool` → Tools, `prompt` → Prompts) and keeps its own
 * command registry and execution pipeline. Neither is shared with `CliEngine`: the two
 * engines differ in the command input (an argument object described by a JSON Schema
 * against argv) and in the result sink (the response of an MCP surface against stdout),
 * and a common command executor is a later piece of work. The engine never writes a
 * command result to stdout — under the stdio transport stdout carries the protocol
 * stream — and reports its diagnostics to stderr.
 *
 * The MVP transport is stdio: `run` hands the server factory to `serveStdio`, which owns
 * stdin/stdout and builds one server per connection. The server introduces itself with the
 * `name`, `version` and `description` of the application (from `IAppConfig`); the engine
 * has no options of its own.
 *
 * Every connection gets its own registration of the entities of the registry: the surfaces
 * of the engine (`register-tools.ts`, `register-resources.ts`, `register-prompts.ts`) put
 * them on the server it just built, and all three run a command through `invokeCommand`, so
 * the text of a result is produced in one place and rendered with the formatter of the
 * command.
 */
@injectable()
export class MCPEngine implements IEngine, IMCPCommandInvoker {
  @inject(CLAPP_LOGGER_TOKEN) private readonly logger!: TLogger;
  @inject(APP_CONFIG_TOKEN) private readonly config!: IAppConfig;
  @inject(EVENT_BUS_TOKEN) private readonly eventBus!: IEventBus;
  @inject(COMMAND_MANAGER_TOKEN) private readonly pluginManager!: IPluginManager<IPluginCommand>;
  @inject(FORMATTER_MANAGER_TOKEN) private readonly formatterManager!: IPluginManager<IPluginFormatter>;

  /** Commands of the project grouped by the MCP surface they are exposed through. */
  private registry!: IMCPEntityRegistry;

  /**
   * Factory the stdio transport asks for the MCP server of every connection.
   *
   * The transport creates an instance per connection — plus one for a `server/discover`
   * probe that it discards when the client falls back to `initialize` — so the server and
   * its surfaces are built per connection and never shared between them. The factory is an
   * arrow function closing over the engine, which is how the server it builds reaches the
   * dependencies the engine received from the DI container.
   */
  private readonly serverFactory: McpServerFactory = () => this.createServer();

  /**
   * Reads the command definitions of the project and builds the entity registry.
   *
   * The definitions come from the command plugin manager — the same set `CliEngine`
   * turns into a commander tree — and are arranged into a hierarchy by `buildHierarchy`.
   * Every leaf command becomes an entity of its surface, with the path of the group nodes
   * as a name prefix; commands that cannot be exposed (a group without subcommands, a
   * command without a formatter) are reported to stderr.
   */
  async initialize(): Promise<void> {
    const commandDefinitions = await this.pluginManager.getDefinitions();
    const commandNodes = buildHierarchy(commandDefinitions);
    const registry = buildEntityRegistry(commandNodes);

    this.reportSkipped(registry.skipped);
    this.registry = registry;
  }

  /**
   * Runs the project as an MCP server over stdio.
   *
   * The transport reads the protocol stream from stdin and writes it to stdout, and the
   * engine adds nothing to those streams — its diagnostics go to stderr. Command input does
   * not come from the process arguments either (an MCP client sends the arguments of a
   * command as an object over the protocol), so the `argv` of `IEngine.run` is not used.
   * The call returns once the transport is listening; the open stdin stream keeps the
   * process alive, and the transport closes itself, ending the process, when the client
   * closes the connection.
   */
  public async run(): Promise<void> {
    // The handle is not kept: the transport owns the connection and closes itself when
    // stdin reaches end of file, which ends the process as well.
    serveStdio(this.serverFactory, { onerror: (error) => this.reportServerError(error) });
  }

  /**
   * Runs a command through the execution pipeline of the engine.
   *
   * The pipeline emits the same lifecycle events as the one in `CliEngine` and lets the
   * command itself turn the raw input into typed arguments (`getArguments`), so the plugin
   * contract stays the same for both engines. Unlike the CLI engine it renders nothing:
   * the result is returned to the caller, because under the stdio transport stdout carries
   * the protocol stream and the text is assembled on the surface that invoked the command.
   *
   * A command that fails — a rejected `action`, an entity without an action, or a result
   * with `success: false` — is reported through `command:error` and rethrown. `invokeCommand`
   * renders a successful result only, and the surface that called it answers with the failure
   * in the shape of its kind: an error result (`isError`) for a tool, an error of the request
   * for a resource read and a prompt get. Neither drops the connection.
   * @param entity Entity of the invoked command
   * @param input Raw command input (positional arguments and options)
   * @returns Result returned by the command action
   */
  public async executeCommand(entity: IMCPEntity, input: IMCPCommandInput): Promise<ICommandResult> {
    const { path, definition } = entity;
    const { args, opts } = input;

    try {
      await this.eventBus.hook('command:start', { id: path, type: PLUGIN_COMMAND_TYPE, args, opts });
      const plugin = await this.pluginManager.getInstance(definition.id);

      if (typeof plugin.action !== 'function') {
        throw new Error(`Command '${path}' has no action to run.`);
      }

      await this.eventBus.hook('command:arguments', { id: path, type: PLUGIN_COMMAND_TYPE, args, opts });
      const pluginArgs = await plugin.getArguments(args, opts);
      await this.eventBus.hook('command:run', { id: path, type: PLUGIN_COMMAND_TYPE, args: pluginArgs });
      const result = await plugin.action(pluginArgs);

      if (result.success === false) {
        throw new Error(result.error?.join('; ') ?? `Command '${path}' failed`);
      }

      await this.eventBus.hook('command:end', { id: path, type: PLUGIN_COMMAND_TYPE, result });

      return result;
    } catch (error) {
      this.log('Command execution error:', error, 'error');

      try {
        await this.eventBus.hook('command:error', { id: path, type: PLUGIN_COMMAND_TYPE, error });
      } catch (hookError) {
        this.log('command:error hook failed:', hookError, 'error');
      }

      throw error;
    }
  }

  /**
   * Runs the command of an entity and renders the text of its result.
   *
   * The surfaces of the engine call this (see `IMCPCommandInvoker`): it is the pipeline of
   * `executeCommand` plus the resolution of the formatter of the command, so every surface hands
   * out the same text for the same command result and no surface knows how that text is produced.
   * @param entity Entity of the invoked command
   * @param input Raw command input (positional arguments and options)
   * @returns Text of the command result, rendered with the formatter of the command
   */
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

  /**
   * Renders the result of a command with the formatter it declares.
   *
   * The identifier comes from `definition.formatter` and is resolved in the formatter plugin
   * manager the engine received from the DI container — the same manager a CLI run resolves its
   * formatters in. Which plugins it holds is the choice of the host: a host that serves an MCP
   * server points the discovery patterns of `PLUGIN_FORMATTER_TYPE` at a set that renders for the
   * protocol stream (the built-in set of `src/plugins/mcp-formatters`), so the same command identifier
   * is served by a formatter of that set. There is deliberately no fallback to another set: the
   * host configures exactly one, and a formatter whose plugin is not registered is an error. The
   * engine never renders a result with a formatter it did not resolve.
   *
   * A formatter that cannot render — a missing plugin, a failing `format` — is reported as an
   * error of the command, so the surface answers with it instead of a content block.
   * @param entity Entity whose command returned the result
   * @param result Result returned by the command action
   * @returns Text the surface returns as the content of its response
   */
  private async renderResult(entity: IMCPEntity, result: ICommandResult): Promise<string> {
    try {
      const formatter = await this.resolveFormatter(entity.formatter);

      return await formatter.format(result.data);
    } catch (error) {
      throw new Error(`Command '${entity.path}': formatter '${entity.formatter}' failed: ${toErrorMessage(error)}`);
    }
  }

  /**
   * Resolves the formatter plugin of an identifier in the formatter manager of the engine.
   *
   * An identifier without a registered plugin is reported as a clear error naming the missing
   * formatter, so a command that declares a formatter the configured set does not provide fails
   * with a reason instead of rendering with the wrong set.
   * @param formatterId Identifier from `definition.formatter`
   * @returns Formatter plugin of the identifier
   */
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

  /**
   * Reports an out-of-band error of the transport.
   *
   * The transport calls this for failures it cannot answer on the wire — a malformed
   * JSON-RPC frame, an unsupported protocol revision. Such an error neither breaks the
   * connection nor reaches the client, so it is a diagnostic and goes to stderr.
   * @param error Error reported by the transport
   */
  private reportServerError(error: unknown): void {
    this.reportToStderr(`transport error: ${toErrorMessage(error)}`);
  }

  /**
   * Writes a diagnostic line to stderr.
   *
   * stderr is the only output channel the engine may use: stdout carries the protocol
   * stream of the stdio transport, and the core logger is not an option either — it writes
   * through `console.log`, which is stdout as well.
   * @param message Message to report
   */
  private reportToStderr(message: string): void {
    process.stderr.write(`[mcp] ${message}\n`);
  }

  private log(message: string, data: unknown, level?: UConsoleLevels) {
    this.logger.send([message, data], level);
  }
}
