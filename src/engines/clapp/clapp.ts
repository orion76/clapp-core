import type { IPluginManager } from '@orion76/node-plugin';
import { Command } from 'commander';
import { inject, injectable } from 'inversify';

import {
  COMMAND_SERVICE_TOKEN,
  CONTEXT_SERVICE_TOKEN,
  FORMATTER_MANAGER_TOKEN,
  IAppConfig,
  ICommandService,
  type ICommandResult,
  type IEngine,
  type IPluginCommandDefinition,
  type IPluginFormatter
} from '@clapp/common';

import { TLogger, UConsoleLevels } from '@orion76/logger';

import { IContextService } from '../../../../common/src/plugin-types/context/types';
import { APP_CONFIG_TOKEN, CLAPP_LOGGER_TOKEN } from '../../public-api';


/**
 * Main class for creating CLI applications
 */
@injectable()
export class CliEngine implements IEngine {
  @inject(CLAPP_LOGGER_TOKEN) private readonly logger!: TLogger;
  @inject(APP_CONFIG_TOKEN) private readonly config!: IAppConfig;
  @inject(COMMAND_SERVICE_TOKEN) private readonly commandService!: ICommandService;
  @inject(CONTEXT_SERVICE_TOKEN) private readonly contextService!: IContextService;
  @inject(FORMATTER_MANAGER_TOKEN) private readonly formatterManager!: IPluginManager<IPluginFormatter>;

  private program!: Command;

  /**
   * Initialize the CLI application asynchronously
   * @param argv Process arguments used to detect informational runs (`--help`, `--version`);
   *   defaults to `process.argv`
   */
  async initialize(): Promise<void> {

    this.program = this.commandService.createProgram(this.config);

    const commands= await this.commandService.createAppCommands(this.program,this.contextService);
    this.program.commands
    this.program.allowExcessArguments();
  }

  private log(message: string, data: unknown, level?: UConsoleLevels) {
    this.logger.send([message, data], level);
  }
  /**
   * Runs command line argument processing
   * @param argv Command line arguments
   */
  public async run(argv: string[]): Promise<void> {
    await this.program.parseAsync(argv);
  }


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
  //   private async hook<E extends TEventName>(event: E, pluginId: string, data: TEventArgs<E>) {
  //   await this.eventBus.hook(event, { ...data, id: pluginId, type: PLUGIN_COMMAND_TYPE });
  // }
}
