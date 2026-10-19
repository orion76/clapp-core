import { COMMAND_KIND_GROUP, COMMAND_KIND_PROMPT, COMMAND_KIND_RESOURCE, COMMAND_KIND_TOOL, type UCommandKind } from '@clapp/common';

import type { ICommandNode } from '../../types';
import { buildEntityPath } from './entity-path';
import type { IMCPEntity, IMCPEntityRegistry } from './types';

/**
 * Builds the registry of MCP entities from the command hierarchy.
 *
 * The hierarchy is walked from the roots down: a node with children is a group — a
 * container that only contributes its `command` to the path of its subcommands — and
 * every leaf node becomes an entity of the surface matching its `kind`. The path of a
 * node is assembled from the `command` segments of the nodes above it and of its own
 * `command`, while `definition.id` stays the identifier the plugin is resolved by. A
 * leaf command is left out of the registry in two cases, each with a reason: it is a
 * group without subcommands (nothing to expose), or it declares no formatter (an MCP
 * surface renders a command result with its formatter, and such a command prints its
 * own output, which under the stdio transport would corrupt the protocol stream).
 * @param nodes Roots of the command hierarchy built by `buildHierarchy`
 * @returns Entities grouped by surface plus the skipped commands with their reasons
 */
export function buildEntityRegistry(nodes: ICommandNode[]): IMCPEntityRegistry {
  const registry: IMCPEntityRegistry = { tools: [], resources: [], prompts: [], skipped: [] };

  collectEntities(nodes, '', registry);

  return registry;
}

function collectEntities(nodes: ICommandNode[], prefix: string, registry: IMCPEntityRegistry): void {
  for (const node of nodes) {
    const { definition } = node;
    const { command, kind, formatter } = definition;
    const path = buildEntityPath(prefix, command);

    if (node.children.length > 0) {
      collectEntities(node.children, path, registry);
      continue;
    }

    if (kind === COMMAND_KIND_GROUP) {
      registry.skipped.push({ path, definition, reason: 'group node without subcommands' });
      continue;
    }

    if (!formatter) {
      registry.skipped.push({ path, definition, reason: 'no formatter declared' });
      continue;
    }

    surface(registry, kind).push({ path, kind, formatter, definition });
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
