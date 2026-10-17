import type { ICommandConfig } from '@clapp/common';

/**
 * Scheme of the URI of an MCP resource.
 *
 * The URI of a resource is built from the path of the command in the hierarchy
 * (`board/list`), so a client addresses a command of the project the same way on every
 * surface: by the path an MCP name carries (`_concept.md` § 6.2).
 */
export const RESOURCE_URI_SCHEME = 'clapp://';

/**
 * Builds the URI of a resource whose command takes no arguments and no options.
 *
 * Such a resource is static: the client reads exactly this URI, and the command runs with
 * the defaults of its own definition.
 * @param path Path of the command in the hierarchy
 * @returns URI of the resource
 */
export function buildResourceUri(path: string): string {
  return `${RESOURCE_URI_SCHEME}${path}`;
}

/**
 * Builds the URI template of a resource whose command takes arguments or options.
 *
 * The template appends the RFC 6570 query expansion of the command parameters
 * (`clapp://npm-info{?type}`), so a client passes the values as the query of the URI it
 * reads. The SDK matches the URI against the template by the variable names, and it matches
 * strictly: a variable of the template is a mandatory part of the pattern, so a dynamic
 * resource is read with all of its parameters in the query
 * (`clapp://npm-info?type=summary`). An optional parameter of a command therefore has no
 * effect on a resource read — it is the argument schema of a tool that expresses an optional
 * argument, while a resource carries its parameters in the URI alone (`_concept.md` § 6.2).
 * @param path Path of the command in the hierarchy
 * @param variables Names of the arguments and options of the command
 * @returns URI template of the resource
 */
export function buildResourceUriTemplate(path: string, variables: string[]): string {
  return `${buildResourceUri(path)}{?${variables.join(',')}}`;
}

/**
 * Lists the variables of a resource URI template — the arguments and options of its command.
 *
 * The names come from the definition verbatim and in declaration order, because a client
 * passes them as the query of the URI and the command receives them under those names.
 * A command without arguments and options has no variables, and its entity is a static
 * resource rather than a template.
 * @param config Command config with the arguments and options of the command
 * @returns Names of the variables of the URI template, empty for a static resource
 */
export function buildResourceVariables(config: ICommandConfig): string[] {
  const argumentNames = (config.arguments ?? []).map((argument) => argument.name);
  const optionNames = (config.options ?? []).map((option) => option.name);

  return [...argumentNames, ...optionNames];
}
