import type { ICommandOption } from '@clapp/common';

import type { IMCPCommandInput, IMCPEntity } from './types';

/**
 * Builds the input of the command pipeline from the arguments an MCP client sent.
 *
 * An MCP client passes its arguments as one object described by the argument schema of the
 * entity (`_concept.md` § 6.2), and the command pipeline addresses values by the names a
 * command declares, so the object is the input of the pipeline as it is: no value is mapped
 * back to a position, and a value the client left out stays absent. The only work left is
 * decoding — the variable of a resource URI template always arrives as text, and the declared
 * type of its option decides how to read it (`toOptionValue`).
 * @param entity Entity whose command the input belongs to
 * @param input Arguments of the MCP call, empty when the client sent none
 * @returns Input of the command pipeline
 */
export function buildCommandValues(entity: IMCPEntity, input: unknown): IMCPCommandInput {
  const values = { ...toInputObject(input) };

  for (const option of entity.definition.config.options ?? []) {
    const value = values[option.name];

    if (value !== undefined) {
      values[option.name] = toOptionValue(option, value);
    }
  }

  return { values };
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
