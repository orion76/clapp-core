import { COMMAND_KIND_GROUP, COMMAND_KIND_PROMPT, COMMAND_KIND_RESOURCE, COMMAND_KIND_TOOL, ICommandNode, type UCommandKind } from '@clapp/common';

import { buildEntityPath } from './entity-path';
import type { IMCPEntity, IMCPEntityRegistry } from './types';


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
