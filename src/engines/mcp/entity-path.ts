/**
 * Separator of the path segments in the name of an entity (`board/list`).
 *
 * The path of a command in the hierarchy is both the name an MCP client sees and — with
 * the `clapp://` scheme — the URI of a resource, so the separator lives in a single
 * place: a client that rejects `/` in a name needs this constant changed only.
 */
export const ENTITY_PATH_SEPARATOR = '/';

/**
 * Builds the path of a command in the hierarchy.
 *
 * A group node contributes its `command` to the path of its subcommands, so the path is
 * assembled on the way down the hierarchy: `board` plus `list` gives `board/list`, which
 * is the name of the entity. A root command has no parent path and is named by its own
 * `command`. The segment is the `command` of a definition — the name the command has on
 * the surface — and never its `id`, which is the identifier of the plugin definition.
 * @param parentPath Path of the parent node, empty for a root command
 * @param command Name of the node on the surface (its `command`)
 * @returns Full path of the node, used as the MCP name of its entity
 */
export function buildEntityPath(parentPath: string, command: string): string {
  return parentPath ? `${parentPath}${ENTITY_PATH_SEPARATOR}${command}` : command;
}
