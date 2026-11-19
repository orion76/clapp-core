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

import { APP_CONFIG_TOKEN, CLAPP_LOGGER_TOKEN, SCHEMA_REGISTRY_TOKEN } from '../../public-api';
import type { ISchemaRegistry, ISchemaViolation } from '../../schemas/types';


/**
 * Main class for creating CLI applications
 */
@injectable()
export class CliEngine implements IEngine {
  @inject(CLAPP_LOGGER_TOKEN) private readonly logger!: TLogger;
  @inject(APP_CONFIG_TOKEN) private readonly config!: IAppConfig;
  @inject(COMMAND_SERVICE_TOKEN) private readonly commandService!: ICommandService;
  @inject(FORMATTER_MANAGER_TOKEN) private readonly formatterManager!: IPluginManager<IPluginFormatter>;
  @inject(SCHEMA_REGISTRY_TOKEN) private readonly schemaRegistry!: ISchemaRegistry;

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
   * Renders the result of a command that declares a data schema and writes it to stdout.
   *
   * The data is validated against the schema and rendered by the formatter the app config maps
   * to it, so wrong data fails with its violations instead of a broken table. A failed result
   * has no data: its reasons go to stderr, and empty output is not printed.
   * @param definition Definition of the command that produced the result
   * @param result Result returned by the command action
   * @throws Error when the schema of the command or the formatter mapped to it is not configured
   */
  private async formatCommandResult(definition: IPluginCommandDefinition, result: ICommandResult): Promise<void> {
    if (!result.success) {
      this.reportFailure(result);

      return;
    }

    const { dataSchema } = definition;
    if (!dataSchema) {
      return;
    }

    const schema = this.schemaRegistry.get(dataSchema);

    if (schema === undefined) {
      throw new Error(`Command '${definition.id}': data schema '${dataSchema}' is not registered.`);
    }

    const formatterId = this.config.schemas.formatters[dataSchema];

    if (formatterId === undefined) {
      throw new Error(
        `Command '${definition.id}': data schema '${dataSchema}' has no formatter in "schemas.formatters".`,
      );
    }

    const violations = this.collectViolations(definition.id, dataSchema, schema.validate(result.data));

    if (violations.length > 0) {
      this.reportFailure({ success: false, error: violations });

      return;
    }

    let output: string;
    try {
      const plugin = await this.formatterManager.getInstance(formatterId);
      output = await plugin.format(result.data);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Command '${definition.id}': formatter '${formatterId}' failed: ${reason}`);
    }

    if (output.length === 0) {
      return;
    }

    process.stdout.write(output.endsWith('\n') ? output : `${output}\n`);
  }

  /**
   * Turns the violations of a data schema into the reasons of a failed command result, in the
   * wording the pipeline uses for the values of a command.
   * @param commandId Identifier of the command whose data was validated
   * @param schemaId `$id` of the schema the data was validated against
   * @param violations Violations reported by the schema validator, `null` when the data conforms
   * @returns Reasons of the failure, in the order the validator reported them
   */
  private collectViolations(
    commandId: string,
    schemaId: string,
    violations: readonly ISchemaViolation[] | null,
  ): string[] {
    if (violations === null) {
      return [];
    }

    return violations.map((violation) => {
      const location = violation.instancePath !== undefined && violation.instancePath.length > 0
        ? violation.instancePath
        : '/';

      return `Command '${commandId}': data does not match schema '${schemaId}' at '${location}': ${violation.message ?? 'invalid value'}.`;
    });
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
