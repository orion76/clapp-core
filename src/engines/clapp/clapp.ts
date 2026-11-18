import type { IPluginManager } from '@orion76/node-plugin';
import { Command } from 'commander';
import { inject, injectable } from 'inversify';

import {
  COMMAND_SERVICE_TOKEN,
  FORMATTER_MANAGER_TOKEN,
  IAppConfig,
  ICommandService,
  type ICommandResult,
  type IEngine,
  type IPluginCommandDefinition,
  type IPluginFormatter
} from '@clapp/common';

import { TLogger, UConsoleLevels } from '@orion76/logger';

import { APP_CONFIG_TOKEN, CLAPP_LOGGER_TOKEN } from '../../public-api';


/**
 * Main class for creating CLI applications
 */
@injectable()
export class CliEngine implements IEngine {
  @inject(CLAPP_LOGGER_TOKEN) private readonly logger!: TLogger;
  @inject(APP_CONFIG_TOKEN) private readonly config!: IAppConfig;
  @inject(COMMAND_SERVICE_TOKEN) private readonly commandService!: ICommandService;
  @inject(FORMATTER_MANAGER_TOKEN) private readonly formatterManager!: IPluginManager<IPluginFormatter>;

  private program!: Command;

  /**
   * Initialize the CLI application asynchronously
   * @param argv Process arguments used to detect informational runs (`--help`, `--version`);
   *   defaults to `process.argv`
   */
  async initialize(): Promise<void> {

    this.program = this.commandService.createProgram(this.config);

    await this.commandService.createAppCommands(this.program, (definition, result) =>
      this.formatCommandResult(definition, result),
    );
    this.program.allowExcessArguments();
  }

  private log(message: string, data: unknown, level?: UConsoleLevels) {
    this.logger.send([message, data], level);
  }
  /**
   * Runs command line argument processing
   * @param argv Command line arguments; a frozen array or `as const` tuple is accepted
   */
  public async run(argv: readonly string[]): Promise<void> {
    await this.program.parseAsync(argv);
  }


  /**
   * Renders the result of a command that declares a formatter and writes it to stdout.
   *
   * A failed result carries no data to format: its reasons go to stderr, so a run that
   * produced nothing says why. An empty formatter output is not printed.
   * @param definition Definition of the command that produced the result
   * @param result Result returned by the command action
   */
  private async formatCommandResult(definition: IPluginCommandDefinition, result: ICommandResult): Promise<void> {
    if (!result.success) {
      this.reportFailure(result);

      return;
    }

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

  /**
   * Writes the reasons of a failed command result to stderr.
   * @param result Result that carries the reasons in `error`
   */
  private reportFailure(result: ICommandResult): void {
    for (const reason of result.error ?? []) {
      process.stderr.write(`${reason}\n`);
    }
  }
}
