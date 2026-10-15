import { ICommandArgument, ICommandConfig, ICommandOption, IPluginCommandDefinition } from '@clapp/common';
import type { Option } from 'commander';
import { Argument, Command, CommanderError, createOption } from 'commander';
import { ICliConfig, ICommandNode } from '../types';

export function buildCommandArgument(argConfig: ICommandArgument): Argument {
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
export function buildCommandOption(optionConfig: ICommandOption): Option {
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

export function initializeCommand(command: Command, description: string, config: ICommandConfig): void {
  command.description(description);

  if (config.aliases && config.aliases.length > 0) {
    command.aliases(config.aliases);
  }

  // Add arguments
  if (config.arguments) {
    for (const arg of config.arguments) {
      const argument = buildCommandArgument(arg);
      command.addArgument(argument);
    }
  }

  // Add options
  if (config.options) {
    for (const optionConf of config.options) {
      const option = buildCommandOption(optionConf);
      command.addOption(option);
    }
  }
}

/**
 * Builds the command hierarchy from the flat definition list.
 * Definitions without `parent` become roots; a definition with `parent`
 * is attached to the node with that id. A reference to an unknown parent
 * is rejected with a clear error.
 */
export function buildHierarchy(commandDefinitions: IPluginCommandDefinition[]): ICommandNode[] {
  const nodes = new Map<string, ICommandNode>();
  for (const definition of commandDefinitions) {
    nodes.set(definition.id, { definition, children: [] });
  }

  const roots: ICommandNode[] = [];
  for (const definition of commandDefinitions) {
    const node = nodes.get(definition.id)!;
    if (definition.parent) {
      const parent = nodes.get(definition.parent);
      if (!parent) {
        throw new Error(`Command '${definition.id}' references unknown parent '${definition.parent}'.`);
      }
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

/**
 * Sets up basic Commander program parameters.
 *
 * The root command is given an action handler on purpose: commander prints the help of
 * a program on its own only when the program has subcommands and no argument was given,
 * and it does that through `help({ error: true })`, which exits with code 1. With the
 * handler the root prints its help and exits successfully instead — including the case
 * when no subcommand was registered at all (command discovery found nothing).
 *
 * The handler also reports operands that do not name a subcommand as an unknown command
 * instead of commander's `too many arguments` error, which is what a program without
 * registered arguments produces otherwise. For that to work the caller has to allow
 * excess arguments of the root after the subcommands are registered
 * (`allowExcessArguments` is inherited at creation time, so enabling it here would relax
 * the subcommands as well).
 * @param config CLI configuration used for the program
 * @returns Configured Commander program
 */
export function createProgram({ name, description, version }: ICliConfig): Command {
  const program = new Command();
  program //
    .name(name)
    .configureHelp({ sortSubcommands: true })
    .description(description)
    .version(version)
    .showHelpAfterError()
    .action((_options: unknown, command: Command) => {
      const unknownCommand = command.args[0];
      if (unknownCommand !== undefined) {
        // Commander only reports an unknown command by itself when the program has
        // subcommands; a program without registered arguments reports any operand as an
        // excess argument (`too many arguments`) instead. Report the same way in both cases.
        command.error(`error: unknown command '${unknownCommand}'`, { code: 'commander.unknownCommand' });
      }
      command.outputHelp();
    })
    .exitOverride();

  return program;
}

/**
 * Flags that make a run informational: commander prints the requested help or version text
 * and exits successfully without running any command.
 */
const INFORMATIONAL_FLAGS = ['-h', '--help', '-V', '--version'];

/**
 * Detects an informational invocation (`--help`, `-h`, `--version`, `-V`).
 *
 * Commander handles these flags itself, prints the requested text and exits with code 0, so
 * diagnostics about command discovery are noise for such runs. Checking the raw arguments is
 * enough here because commander recognises these flags anywhere in the argument list.
 * @param argv Process arguments (`process.argv` shape)
 * @returns `true` when the invocation only requests help or version
 */
export function isInformationalInvocation(argv: readonly string[]): boolean {
  return argv.some((argument) => INFORMATIONAL_FLAGS.includes(argument));
}

/**
 * Maps a caught CLI error to a process exit code.
 *
 * With `exitOverride()` commander throws a `CommanderError` instead of calling
 * `process.exit`. Such errors carry their own exit code: 0 for the requested
 * informational output (`--help`, `--version`), non-zero for parse errors and for the
 * implicit help commander shows for a group without a subcommand. Any other error is a
 * runtime failure and maps to exit code 1.
 * @param error Error caught by the CLI entrypoint
 * @returns Process exit code to use
 */
export function resolveExitCode(error: unknown): number {
  return error instanceof CommanderError ? error.exitCode : 1;
}
