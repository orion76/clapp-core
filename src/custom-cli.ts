import { Argument, Command, createOption, Option } from 'commander';

import { IPluginManagerAsync } from '@orion76/plugin';
import { getLogger } from './logger-init';
import { createPluginManager } from './plugins/command';
import {
  CLIConfig,
  IClapp,
  ICommandArgument,
  ICommandDefintion,
  ICommandOption,
  IPluginCommand,
  IPluginCommandDefinition,
  isCommand,
  isMainCommand,
  UPluginCommandDefinition,
} from '@clapp/common';

const logger = getLogger('clapp_cli');
/**
 * Main class for creating CLI applications
 */
export class Clapp implements IClapp {
  private program: Command;

  private pluginManager!: IPluginManagerAsync<IPluginCommand>;

  constructor(private config: CLIConfig) {
    logger.send(['--- Creating CLI application:', config.name]);
    this.program = this.createProgram();
  }

  /**
   * Initialize the CLI application asynchronously
   */
  async initialize(): Promise<void> {
    this.pluginManager = await createPluginManager(this.config.projects, this.config.commandDiscovery);
    const commandDefinitions = await this.pluginManager.getDefinitions();
    this.createCommands(commandDefinitions);
  }

  /**
   * Sets up basic Commander program parameters
   */
  private createProgram(): Command {
    const program = new Command();
    const { name, description, version } = this.config;
    program //
      .name(name)
      .configureHelp({ sortSubcommands: true })
      .description(description)
      .version(version);

    return program;
  }

  /**
   * Runs command line argument processing
   * @param argv Command line arguments
   */
  public async run(argv?: string[]): Promise<void> {
    await this.program.parseAsync(argv);
  }

  /**
   * Creates quick static method for creating and running CLI application
   * @param config Application configuration
   * @returns Promise that resolves to initialized CLI instance
   */
  public static async create(config: CLIConfig): Promise<Clapp> {
    const cli = new Clapp(config);
    await cli.initialize();
    return cli;
  }

  private createCommand(name: string, description: string, config: ICommandDefintion) {
    logger.send(['[CLAPP] createCommand', name]);
    const command = this.program.command(name);

    command.description(description);

    if (config.aliases && config.aliases.length > 0) {
      command.aliases(config.aliases);
    }

    // Add arguments
    if (config.arguments) {
      for (const arg of config.arguments) {
        const argument = this.buildCommandArgument(arg);
        command.addArgument(argument);
      }
    }

    // Add options
    if (config.options) {
      for (const optionConf of config.options) {
        const option = this.buildCommandOption(optionConf);
        command.addOption(option);
      }
    }

    return command;
  }

  private _createCommand(definition: IPluginCommandDefinition) {
    const { id, label, command: commandDefinitin } = definition;
    const description = label;
    const commandPlugin = this.createCommand(id, description, commandDefinitin);
    commandPlugin.action(async (...allArgs: any[]) => {
      try {
        const { name, args, opts } = this.parseCommandArgs(allArgs);
        const plugin = await this.pluginManager.getInstance(name);
        logger.send(['createCommands', { args, opts }]);
        if (typeof plugin.action === 'function') {
          const pluginArgs = plugin.getArguments(args, opts);
          const result: any = plugin.action(pluginArgs);
          if (result && typeof result.then === 'function') {
            await result;
          }
        }
        process.exit(0);
      } catch (error) {
        logger.send(['Command execution error:', error], 'error');
        process.exit(1);
      }
    });
    return commandPlugin;
  }

  createCommands(commandDefinitions: UPluginCommandDefinition[]) {
    return commandDefinitions.map((definition) => {
      if (isCommand(definition)) {
        return this._createCommand(definition);
      }

      if (isMainCommand(definition)) {
        const { commands, id, label } = definition;
        const commandPlugin = this.program.command(id);
        commandPlugin.description(label);
        this.createCommands(commands).forEach((sub) => commandPlugin.addCommand(sub));
        return commandPlugin;
      }
      throw new Error('Command definitioni is failure');
    });
  }

  parseCommandArgs(allArgs: any[]) {
    const command = allArgs[allArgs.length - 1]; // Command object is always last
    const opts = command.opts(); // Get options from Command object
    const args = allArgs.slice(0, -2); // All except last are arguments
    return { name: command.name(), args, opts };
  }

  /**
   * Build argument syntax for Commander
   * @param argConfig Argument configuration
   * @returns Argument syntax string
   */
  private buildCommandArgument(argConfig: ICommandArgument): Argument {
    let commandArgument = argConfig.name;

    if (argConfig.variadic) {
      commandArgument += '...';
    }

    const argument = new Argument(commandArgument, argConfig.description);

    if (argConfig.required) {
      argument.argRequired();
    } else {
      argument.argOptional();
    }

    if (argConfig.choices) {
      argument.choices(argConfig.choices);
    }
    if (argConfig.parseArg) {
      argument.argParser(argConfig.parseArg);
    }

    return argument;
  }

  /**
   * Build option flags for Commander
   * @param optionConfig Option configuration
   * @returns Option flags string
   */
  private buildCommandOption(optionConfig: ICommandOption): Option {
    // const option = new Option();

    let flags: string[] = [];

    if (optionConfig.short) {
      flags.push(`-${optionConfig.short}`);
    }

    if (optionConfig.name) {
      if (flags.length > 0) {
        flags.push(', ');
      }
      flags.push(`--${optionConfig.name}`);
    }

    if (optionConfig.type !== 'boolean') {
      const valueName = optionConfig.name || optionConfig.short || 'value';
      if (optionConfig.required) {
        flags.push(` <${valueName}>`);
      } else {
        flags.push(` [${valueName}]`);
      }
    }
    const option = createOption(flags.join(''), optionConfig.description);

    if (optionConfig.choices) {
      option.choices(optionConfig.choices);
    }
    if (optionConfig.defaultValue) {
      option.default(optionConfig.defaultValue);
    }
    return option;
  }
}
