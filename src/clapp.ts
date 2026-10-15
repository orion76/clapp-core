import type { IPluginManager } from '@orion76/node-plugin';
import { Command } from 'commander';
import { inject, injectable } from 'inversify';

import {
  EVENT_BUS_TOKEN,
  type IClapp,
  type ICommandResult,
  type IEventBus,
  type IPluginCommand,
  type IPluginCommandDefinition,
  type IPluginFormatter,
  PLUGIN_COMMAND_TYPE
} from '@clapp/common';

import { TLogger, UConsoleLevels } from '@orion76/logger';
import { CLAPP_LOGGER_TOKEN, CLI_CONFIG_TOKEN, COMMAND_MANAGER_TOKEN, FORMATTER_MANAGER_TOKEN } from './constants/tokens';
import type { ICliConfig, ICommandExecArguments, ICommandNode } from './types';
import { buildHierarchy, createProgram, initializeCommand, isInformationalInvocation } from './utils';

/**
 * Main class for creating CLI applications
 */
@injectable()
export class Clapp implements IClapp {
  @inject(CLAPP_LOGGER_TOKEN) private readonly logger!: TLogger;
  @inject(CLI_CONFIG_TOKEN) private readonly config!: ICliConfig;
  @inject(EVENT_BUS_TOKEN) private readonly eventBus!: IEventBus;
  @inject(COMMAND_MANAGER_TOKEN) private readonly pluginManager!: IPluginManager<IPluginCommand>;
  @inject(FORMATTER_MANAGER_TOKEN) private readonly formatterManager!: IPluginManager<IPluginFormatter>;

  private program!: Command;

  /**
   * Initialize the CLI application asynchronously
   * @param argv Process arguments used to detect informational runs (`--help`, `--version`);
   *   defaults to `process.argv`
   */
  async initialize(argv: readonly string[] = process.argv): Promise<void> {
    const commandDefinitions = await this.pluginManager.getDefinitions();
    this.program = createProgram(this.config);

    if (commandDefinitions.length === 0 && !isInformationalInvocation(argv)) {
      // Discovery found nothing: the patterns may not match the application root, so the
      // help of the program would list no commands. The CLI still prints its help to
      // stdout and exits successfully, the warning is only a hint on stderr. Informational
      // runs (`--help`, `--version`) print the requested text and exit successfully, so the
      // hint would only be noise there.
      console.error('warning: no commands found — check plugin discovery patterns');
    }

    this.createCommands(buildHierarchy(commandDefinitions));
    // Registered after the subcommands on purpose: the root tolerates extra operands so
    // that its action handler reports an unknown command instead of commander's
    // `too many arguments` error, while the subcommands keep strict argument checks
    // (`allowExcessArguments` is inherited by subcommands at creation time only).
    this.program.allowExcessArguments();
  }

  private log(message: string, data: unknown, level?: UConsoleLevels) {
    this.logger.send([message, data], level);
  }
  /**
   * Runs command line argument processing
   * @param argv Command line arguments
   */
  public async run(argv?: string[]): Promise<void> {
    await this.program.parseAsync(argv);
  }

  private async _commandAction(id: string, { name, args, opts }: ICommandExecArguments) {
    try {
      await this.eventBus.hook('command:start', { id: name, type: PLUGIN_COMMAND_TYPE, args, opts });
      const plugin = await this.pluginManager.getInstance(id);
      this.log('createCommands', { args, opts });
      if (typeof plugin.action === 'function') {
        await this.eventBus.hook('command:arguments', { id: name, type: PLUGIN_COMMAND_TYPE, args, opts });
        const pluginArgs = await plugin.getArguments(args, opts);
        await this.eventBus.hook('command:run', { id: name, type: PLUGIN_COMMAND_TYPE, args: pluginArgs });
        const result = await plugin.action(pluginArgs);
        if (result.success === false) {
          throw new Error(result.error?.join('; ') ?? `Command '${name}' failed`);
        }
        await this.formatCommandResult(plugin.definition, result);
        await this.eventBus.hook('command:end', { id: name, type: PLUGIN_COMMAND_TYPE, result });
      }
    } catch (error) {
      this.log('Command execution error:', error, 'error');
      try {
        await this.eventBus.hook('command:error', { id: name, type: PLUGIN_COMMAND_TYPE, error });
      } catch (hookError) {
        this.log('command:error hook failed:', hookError, 'error');
      }
      throw error;
    }
  }

  /**
   * Prints the result of a command through the formatter named by its definition.
   *
   * The formatter plugin is resolved by the identifier from `definition.formatter`
   * and receives `result.data`. An identifier that matches no discovered formatter
   * and a failing `format(...)` are reported as command errors, so the run ends
   * with a non-zero exit code instead of silently succeeding. A command without a
   * formatter prints nothing here: its action writes its own output.
   * @param definition Definition of the executed command
   * @param result Result returned by the command action
   */
  private async formatCommandResult(definition: IPluginCommandDefinition, result: ICommandResult): Promise<void> {
    const { formatter } = definition;
    if (!formatter) {
      return;
    }

    let output: string;
    try {
      const plugin = await this.formatterManager.getInstance(formatter);
      output = await plugin.format(result.data);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Command '${definition.id}': formatter '${formatter}' failed: ${reason}`);
    }

    if (output.length === 0) {
      return;
    }

    process.stdout.write(output.endsWith('\n') ? output : `${output}\n`);
  }

  private _createCommand(target: Command, definition: IPluginCommandDefinition) {
    const { id, label, config } = definition;
    const description = config.description ?? label;

    const command = target.command(id);
    initializeCommand(command, description, config);
    command.action(async (...allArgs: any[]) => this._commandAction(id, this.parseCommandArgs(allArgs)));

    return command;
  }

  createCommands(nodes: ICommandNode[], parent?: Command): Command[] {
    const target = parent ?? this.program;
    return nodes.map((node) => {
      if (node.children.length > 0) {
        // Group node: command container without its own action; subcommands are attached recursively.
        // `target.command(...)` already registers the group on its parent, so the returned child
        // commands must not be added to it a second time.
        const group = target.command(node.definition.id);
        group.description(node.definition.label);
        this.createCommands(node.children, group);
        return group;
      }
      return this._createCommand(target, node.definition);
    });
  }

  parseCommandArgs(allArgs: any[]): ICommandExecArguments {
    const command = allArgs[allArgs.length - 1]; // Command object is always last
    const opts = command.opts(); // Get options from Command object
    const args = allArgs.slice(0, -2); // All except last are arguments
    return { name: command.name(), args, opts };
  }
}
