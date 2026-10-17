import type { ICommandConfig, ICommandOption } from '@clapp/common';

import type { IMCPCommandInput, IMCPEntity } from './types';

/**
 * Builds the input of the engine pipeline from the arguments an MCP client sent.
 *
 * An MCP client passes arguments as one object described by the argument schema of the
 * entity (`_concept.md` § 6.2), while the plugin contract takes positional arguments and
 * options (`getArguments(args, opts)`). This module is that reverse mapping — the single
 * place where an MCP argument object turns back into the input of a command:
 *
 * - `args` follows the declaration order of `config.arguments`, so the command receives the
 *   values at the positions it declares. An argument the client left out keeps its position
 *   with an `undefined` value — the same value the CLI passes for an optional argument, and
 *   the reason `args` is typed `string[]` like `ICommandExecArguments`; a variadic argument
 *   spreads over consecutive positions, as its values do in the argv of the CLI.
 * - `opts` carries the options of `config.options` that the client sent: an option left out
 *   is absent, exactly as `Command.opts()` reports the options of a CLI run, so a command
 *   keeps applying its own default for it.
 *
 * A value arrives in the type the argument schema declares. The SDK validates the object of a
 * tool or prompt call before the callback of the surface sees it; the string of a resource URI
 * template is decoded into the declared type of its option here. Nothing else is interpreted:
 * the mapping copies values and never inspects their meaning.
 * @param entity Entity whose command the input belongs to
 * @param input Arguments of the MCP call, empty when the client sent none
 * @returns Input of the engine pipeline
 */
export function buildCommandInput(entity: IMCPEntity, input: unknown): IMCPCommandInput {
  const values = toInputObject(input);
  const { config } = entity.definition;

  return { args: buildArgs(config, values), opts: buildOpts(config, values) };
}

/**
 * Narrows the arguments of an MCP call to a plain record.
 *
 * The SDK validates the arguments against the schema of the entity before the callback of a
 * surface runs, so the value is an object by contract. The guard keeps the mapping honest for
 * the paths that pass no arguments at all — reading a resource without a URI template — and
 * for a subject that is not an object.
 */
function toInputObject(input: unknown): Record<string, unknown> {
  if (typeof input !== 'object' || input === null) {
    return {};
  }

  return input as Record<string, unknown>;
}

/**
 * Builds the positional arguments of the pipeline input.
 *
 * A positional argument is addressed by its index, so an argument the client left out still
 * occupies its position: the command receives `undefined` there, which is what the CLI hands
 * over for an optional argument of a run.
 */
function buildArgs(config: ICommandConfig, values: Record<string, unknown>): string[] {
  const args: string[] = [];

  for (const argument of config.arguments ?? []) {
    const value = values[argument.name];

    if (argument.variadic) {
      pushVariadicValues(args, value);
      continue;
    }

    args.push(value as string);
  }

  return args;
}

/**
 * Appends the values of a variadic argument to the positional arguments.
 *
 * A variadic argument takes a list of values, and in the argv of the CLI those values occupy
 * consecutive positions, so they are appended one by one. A variadic argument is expected
 * last, as the CLI declares it.
 */
function pushVariadicValues(args: string[], value: unknown): void {
  if (value === undefined) {
    return;
  }

  const values = Array.isArray(value) ? value : [value];

  for (const item of values) {
    args.push(String(item));
  }
}

/**
 * Builds the options of the pipeline input by name.
 *
 * An option name the client did not mention is left out, so the command sees exactly the
 * options of the call — the same way it sees the parsed options of a CLI run.
 */
function buildOpts(config: ICommandConfig, values: Record<string, unknown>): Record<string, unknown> {
  const opts: Record<string, unknown> = {};

  for (const option of config.options ?? []) {
    const value = values[option.name];

    if (value === undefined) {
      continue;
    }

    opts[option.name] = toOptionValue(option, value);
  }

  return opts;
}

/**
 * Brings the value of an option to the type the option declares.
 *
 * A tool or prompt call delivers the value in the type of the argument schema, because the
 * SDK validates the argument object before the callback of the surface runs. A variable of a
 * resource URI template, in contrast, always arrives as a string — the query of the URI the
 * client read — so the declared type of the option decides how the string is decoded: a
 * command declares `boolean` or `number` and expects such a value, not the text of it.
 * A string that does not fit the declared type is an error naming the option: a client that
 * asked for `false` must not receive the output a truthy string would produce.
 */
function toOptionValue(option: ICommandOption, value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  switch (option.type) {
    case 'boolean':
      return decodeBoolean(option, value);
    case 'number':
      return decodeNumber(option, value);
    default:
      return value;
  }
}

/**
 * Decodes the text of a boolean option. A boolean takes no value on the command line, so the
 * query of the URI carries its state as `true` or `false`, and nothing else is a boolean.
 */
function decodeBoolean(option: ICommandOption, value: string): boolean {
  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  throw new Error(`Option '${option.name}' expects a boolean value ('true' or 'false'), got '${value}'.`);
}

/**
 * Decodes the text of a number option. An empty text is not a number: `Number('')` is `0`,
 * which would turn a value the client never sent into a meaningful one.
 */
function decodeNumber(option: ICommandOption, value: string): number {
  const decoded = Number(value);

  if (value.trim().length === 0 || Number.isNaN(decoded)) {
    throw new Error(`Option '${option.name}' expects a number, got '${value}'.`);
  }

  return decoded;
}
