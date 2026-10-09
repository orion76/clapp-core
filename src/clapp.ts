import { Argument, Command, createOption, Option } from 'commander';
import { providePluginManager, rootContainer, type IPluginManager } from '@orion76/node-plugin';
import { Container, inject, injectable, type ServiceIdentifier } from 'inversify';

import { getLogger } from './logger-init';
import { CLI_CONFIG_TOKEN, COMMAND_MANAGER_TOKEN } from './plugins/tokens';
import { EventBus } from './events/event-bus';
import { ensureTsLoader } from './utils';
import {
  CLIConfig,
  EVENT_BUS_TOKEN,
  IClapp,
  ICommandArgument,
  ICommandDefintion,
  ICommandOption,
  IEventBus,
  IPluginCommand,
  IPluginCommandDefinition,
  PLUGIN_COMMAND_TYPE,
  isCommand,
  isMainCommand,
  UPluginCommandDefinition,
} from '@clapp/common';

const logger = getLogger('clapp_cli');
/**
 * Main class for creating CLI applications
 */
@injectable()
export class Clapp implements IClapp {
  private program: Command;

  private pluginManager!: IPluginManager<IPluginCommand>;

  constructor(
    @inject(CLI_CONFIG_TOKEN) private config: CLIConfig,
    @inject(EVENT_BUS_TOKEN) private eventBus: IEventBus,
  ) {
    logger.send(['--- Creating CLI application:', config.name]);
    this.program = this.createProgram();
  }

  /**
   * Initialize the CLI application asynchronously
   */
  async initialize(): Promise<void> {
    await ensureTsLoader();
    providePluginManager<IPluginCommand>(
      PLUGIN_COMMAND_TYPE,
      COMMAND_MANAGER_TOKEN as ServiceIdentifier<IPluginManager<IPluginCommand>>,
      {
        config: this.config.commandDiscovery ?? { patterns: [] },
      },
    );
    this.pluginManager = rootContainer.get(COMMAND_MANAGER_TOKEN);
    const commandDefinitions = await this.pluginManager.getDefinitions();
    this.createCommands(commandDefinitions);
  }

  /**
   * Sets up basic Commander program parameters
   */
  private createProgram(): Command {
    this.eventBus.emit('app:create',this.config)
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
    if (!rootContainer.isBound(EVENT_BUS_TOKEN)) {
      rootContainer.bind(EVENT_BUS_TOKEN).to(EventBus).inSingletonScope();
    }

    const scope = new Container({ parent: rootContainer });
    scope.bind(CLI_CONFIG_TOKEN).toConstantValue(config);
    scope.bind(Clapp).toSelf();

    const cli = scope.get(Clapp);
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
      const { name, args, opts } = this.parseCommandArgs(allArgs);
      try {
        await this.eventBus.emit('command:start', { id: name, type: PLUGIN_COMMAND_TYPE, args, opts });
        const plugin = await this.pluginManager.getInstance(name);
        logger.send(['createCommands', { args, opts }]);
        if (typeof plugin.action === 'function') {
          await this.eventBus.emit('command:arguments', { id: name, type: PLUGIN_COMMAND_TYPE, args, opts });
          const pluginArgs = await plugin.getArguments(args, opts);
          await this.eventBus.emit('command:run', { id: name, type: PLUGIN_COMMAND_TYPE, args: pluginArgs });
          const result = await plugin.action(pluginArgs);
          await this.eventBus.emit('command:end', { id: name, type: PLUGIN_COMMAND_TYPE, result });
        }
        process.exit(0);
      } catch (error) {
        logger.send(['Command execution error:', error], 'error');
        await this.eventBus.emit('command:error', { id: name, type: PLUGIN_COMMAND_TYPE, error });
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
