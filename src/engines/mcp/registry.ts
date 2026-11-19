import { COMMAND_KIND_GROUP, COMMAND_KIND_PROMPT, COMMAND_KIND_RESOURCE, COMMAND_KIND_TOOL, ICommandNode, type UCommandKind } from '@clapp/common';

import { buildEntityPath } from './entity-path';
import type { IMCPEntity, IMCPEntityRegistry } from './types';


/**
 * Builds the registry of the entities the surfaces expose.
 *
 * A command becomes an entity only when it names its data shape with `dataSchema` and the
 * app config maps that schema to a formatter: a surface renders a result as text, so a
 * command that cannot be rendered is left out with the reason instead of failing a call.
 * @param nodes Commands of the application as a hierarchy
 * @param formatters Formatter plugin ids by the `$id` of the data schema they render
 * @returns Registry of the entities by surface, plus the commands left out with their reasons
 */
export function buildEntityRegistry(nodes: ICommandNode[], formatters: Readonly<Record<string, string>>): IMCPEntityRegistry {
  const registry: IMCPEntityRegistry = { tools: [], resources: [], prompts: [], skipped: [] };

  collectEntities(nodes, '', registry, formatters);

  return registry;
}

/**
 * Walks the hierarchy and puts every leaf command that a surface can render into the registry
 * of its kind. A node with children is a group: it only carries the path prefix and never
 * becomes an entity itself.
 * @param nodes Nodes of the hierarchy to walk
 * @param prefix Path of the parent nodes
 * @param registry Registry the entities and the skipped commands are collected in
 * @param formatters Formatter plugin ids by the `$id` of the data schema they render
 */
function collectEntities(
  nodes: ICommandNode[],
  prefix: string,
  registry: IMCPEntityRegistry,
  formatters: Readonly<Record<string, string>>,
): void {
  for (const node of nodes) {
    const { definition } = node;
    const { command, kind, dataSchema } = definition;
    const path = buildEntityPath(prefix, command);

    if (node.children.length > 0) {
      collectEntities(node.children, path, registry, formatters);
      continue;
    }

    if (kind === COMMAND_KIND_GROUP) {
      registry.skipped.push({ path, definition, reason: 'group node without subcommands' });
      continue;
    }

    if (!dataSchema) {
      registry.skipped.push({ path, definition, reason: 'no data schema declared' });
      continue;
    }

    if (formatters[dataSchema] === undefined) {
      registry.skipped.push({
        path,
        definition,
        reason: `data schema '${dataSchema}' has no formatter in "schemas.formatters"`,
      });
      continue;
    }

    surface(registry, kind).push({ path, kind, dataSchema, definition });
  }
}

/**
 * Picks the registry list of the surface an entity kind maps to. The group marker is
 * filtered out by the caller, so the switch covers the three surfaces exhaustively.
 */
function surface(registry: IMCPEntityRegistry, kind: UCommandKind): IMCPEntity[] {
  switch (kind) {
    case COMMAND_KIND_RESOURCE:
      return registry.resources;
    case COMMAND_KIND_TOOL:
      return registry.tools;
    case COMMAND_KIND_PROMPT:
      return registry.prompts;
  }
}
