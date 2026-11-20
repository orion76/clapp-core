import { describe, expect, it } from '@jest/globals';

import {
  COMMAND_KIND_GROUP,
  COMMAND_KIND_PROMPT,
  COMMAND_KIND_RESOURCE,
  COMMAND_KIND_TOOL,
  PLUGIN_COMMAND_TYPE,
  type ICommandNode,
  type IPluginCommandDefinition,
} from '@clapp/common';

import { buildEntityRegistry } from '../../../src/engines/mcp/registry.js';

/**
 * Builds a node of the command hierarchy.
 * @param fields Fields of the definition the registry reads
 * @param children Child nodes of the command
 * @returns Node of the hierarchy
 */
function createNode(
  fields: { id: string; command: string; kind: IPluginCommandDefinition['kind']; dataSchema?: string },
  children: ICommandNode[] = [],
): ICommandNode {
  const definition = {
    type: PLUGIN_COMMAND_TYPE,
    label: fields.id,
    config: {},
    ...fields,
  };

  return { definition: definition as IPluginCommandDefinition, children };
}

/** Formatter map of the cases: the schema ids a host can render. */
const FORMATTERS = { 'task-list': 'table', brief: 'ordered-list' };

describe('buildEntityRegistry', () => {
  it('exposes a command of every kind on the surface of its kind', () => {
    const registry = buildEntityRegistry(
      [
        createNode({ id: 'task_list', command: 'list', kind: COMMAND_KIND_RESOURCE, dataSchema: 'task-list' }),
        createNode({ id: 'task_add', command: 'add', kind: COMMAND_KIND_TOOL, dataSchema: 'task-list' }),
        createNode({ id: 'brief', command: 'brief', kind: COMMAND_KIND_PROMPT, dataSchema: 'brief' }),
      ],
      FORMATTERS,
    );

    expect(registry.resources.map((entity) => entity.path)).toEqual(['list']);
    expect(registry.tools.map((entity) => entity.path)).toEqual(['add']);
    expect(registry.prompts.map((entity) => entity.path)).toEqual(['brief']);
    expect(registry.skipped).toEqual([]);
  });

  it('carries the data schema and the definition into the entity', () => {
    const node = createNode({ id: 'task_list', command: 'list', kind: COMMAND_KIND_RESOURCE, dataSchema: 'task-list' });

    const registry = buildEntityRegistry([node], FORMATTERS);

    expect(registry.resources[0]).toMatchObject({ path: 'list', dataSchema: 'task-list' });
    expect(registry.resources[0].definition).toBe(node.definition);
  });

  it('prefixes the path of a subcommand with the command of its group', () => {
    const registry = buildEntityRegistry(
      [
        createNode({ id: 'task', command: 'task', kind: COMMAND_KIND_GROUP }, [
          createNode({ id: 'task_list', command: 'list', kind: COMMAND_KIND_RESOURCE, dataSchema: 'task-list' }),
        ]),
      ],
      FORMATTERS,
    );

    expect(registry.resources.map((entity) => entity.path)).toEqual(['task/list']);
    expect(registry.skipped).toEqual([]);
  });

  it('leaves out a command without a data schema and names the reason', () => {
    const registry = buildEntityRegistry([createNode({ id: 'board', command: 'board', kind: COMMAND_KIND_TOOL })], FORMATTERS);

    expect(registry.tools).toEqual([]);
    expect(registry.skipped).toHaveLength(1);
    expect(registry.skipped[0]).toMatchObject({ path: 'board', reason: 'no data schema declared' });
  });

  it('leaves out a command whose schema has no formatter in the map and names the schema', () => {
    const registry = buildEntityRegistry(
      [createNode({ id: 'skill_list', command: 'list', kind: COMMAND_KIND_RESOURCE, dataSchema: 'skill-list' })],
      FORMATTERS,
    );

    expect(registry.resources).toEqual([]);
    expect(registry.skipped[0]).toMatchObject({
      path: 'list',
      reason: 'data schema \'skill-list\' has no formatter in "schemas.formatters"',
    });
  });

  it('leaves out a group node without subcommands', () => {
    const registry = buildEntityRegistry(
      [createNode({ id: 'task', command: 'task', kind: COMMAND_KIND_GROUP })],
      FORMATTERS,
    );

    expect(registry.skipped).toHaveLength(1);
    expect(registry.skipped[0]).toMatchObject({ path: 'task', reason: 'group node without subcommands' });
  });

  it('exposes nothing when the application declares no formatter map', () => {
    const registry = buildEntityRegistry(
      [createNode({ id: 'task_list', command: 'list', kind: COMMAND_KIND_RESOURCE, dataSchema: 'task-list' })],
      {},
    );

    expect(registry.tools).toEqual([]);
    expect(registry.resources).toEqual([]);
    expect(registry.prompts).toEqual([]);
    expect(registry.skipped).toHaveLength(1);
  });
});
