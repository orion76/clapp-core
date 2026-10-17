import { fromJsonSchema, type JsonSchemaType, type StandardSchemaWithJSON } from '@modelcontextprotocol/server';

import type { ICommandArgument, ICommandConfig, ICommandOption } from '@clapp/common';

/**
 * Type of an option that declares no type of its own. The CLI treats such an option as a
 * value option (only `boolean` switches the value name off), so a string is the shape the
 * command receives.
 */
const DEFAULT_OPTION_TYPE = 'string';

/**
 * Builds the JSON Schema of the arguments an entity accepts.
 *
 * The schema describes one object: the positional arguments of the command by name and
 * its options. The mapping is the one fixed by the conventions of the task
 * (`_concept.md` § 6.2): `description` of the declaration, `enum` from `choices`,
 * `default` from `defaultValue`, and the type of an option from the declaration; a
 * positional argument is a string and a variadic one is an array of strings. `required`
 * lists the arguments and options declared as required; for a variadic argument it asks
 * for the property itself, not for a non-empty list, since the conventions say nothing
 * about the length.
 * @param config Command config with the arguments and options of the command
 * @returns JSON Schema of the argument object
 */
export function buildArgumentsJsonSchema(config: ICommandConfig): JsonSchemaType {
  const commandArguments = config.arguments ?? [];
  const options = config.options ?? [];
  const properties: Record<string, JsonSchemaType> = {};
  const required: string[] = [];

  for (const argument of commandArguments) {
    properties[argument.name] = buildArgumentSchema(argument);

    if (argument.required) {
      required.push(argument.name);
    }
  }

  for (const option of options) {
    properties[option.name] = buildOptionSchema(option);

    if (option.required) {
      required.push(option.name);
    }
  }

  const schema: JsonSchemaType = { type: 'object', properties };

  if (required.length > 0) {
    schema.required = required;
  }

  return schema;
}

/**
 * Builds the argument schema of an entity in the shape the SDK registers it with.
 *
 * The SDK describes the arguments of a tool and of a prompt with a Standard Schema and
 * derives the JSON Schema it advertises to a client from it; `fromJsonSchema` wraps a
 * plain JSON Schema, so the core needs no schema library of its own. Validation of the
 * incoming arguments is left to the default validator of the SDK.
 * @param config Command config with the arguments and options of the command
 * @returns Argument schema ready for `registerTool`/`registerPrompt`
 */
export function buildArgumentsStandardSchema(config: ICommandConfig): StandardSchemaWithJSON {
  return fromJsonSchema(buildArgumentsJsonSchema(config));
}

/**
 * Builds the schema of one positional argument.
 *
 * An argument is a string: the plugin contract hands positional values to the command as
 * they arrive. A variadic argument carries a list of such values, so its `choices`, if
 * any, constrain the items of the list rather than the list itself.
 */
function buildArgumentSchema(argument: ICommandArgument): JsonSchemaType {
  const { description, variadic, choices } = argument;

  if (variadic) {
    const items: JsonSchemaType = { type: 'string' };

    if (choices) {
      items.enum = choices;
    }

    return { type: 'array', description, items };
  }

  const schema: JsonSchemaType = { type: 'string', description };

  if (choices) {
    schema.enum = choices;
  }

  return schema;
}

/**
 * Builds the schema of one option.
 *
 * The type of an option comes from its declaration — `string`, `number` or `boolean` —
 * and an option without a declared type takes a value, so it is a string. `defaultValue`
 * becomes the default of the schema; a declared default of `false` or `0` is kept, since
 * such a value is as meaningful as any other.
 */
function buildOptionSchema(option: ICommandOption): JsonSchemaType {
  const { description, type, choices, defaultValue } = option;
  const schema: JsonSchemaType = { type: type ?? DEFAULT_OPTION_TYPE, description };

  if (choices) {
    schema.enum = choices;
  }

  if (defaultValue !== undefined) {
    schema.default = defaultValue;
  }

  return schema;
}
