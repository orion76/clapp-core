import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { IPluginManager } from '@orion76/node-plugin';

import {
  COMMAND_KIND_RESOURCE,
  PLUGIN_COMMAND_TYPE,
  PLUGIN_FORMATTER_TYPE,
  type IAppConfig,
  type ICommandResult,
  type IPluginCommandDefinition,
  type IPluginFormatter,
  type IPluginFormatterDefinition,
  type UPluginTypes,
} from '@clapp/common';

import { APP_CONFIG_DEFAULT } from '../../../src/config/config.js';
import { CliEngine } from '../../../src/engines/clapp/clapp.js';
import type { ISchemaEntry, ISchemaRegistry, ISchemaViolation } from '../../../src/schemas/types.js';

/** Data of a table command, the shape the schema of the cases describes. */
interface ITableData {
  headers: string[];
  rows: string[][];
}

/** Spied output of the engine: the rendering path writes to the process streams. */
interface IOutputStreams {
  stdout: string[][];
  stderr: string[][];
}

/**
 * Builds a command definition with the fields the rendering path reads.
 * @param dataSchema `$id` of the schema the command declares, when it declares one
 * @returns Definition of the command
 */
function createDefinition(dataSchema?: string): IPluginCommandDefinition {
  const definition = {
    type: PLUGIN_COMMAND_TYPE,
    id: 'task_list',
    label: 'List tasks',
    command: 'list',
    kind: COMMAND_KIND_RESOURCE,
    dataSchema,
    config: {},
  };

  return definition as IPluginCommandDefinition;
}

/**
 * Builds a registry over entries without reading files.
 * @param entries Entries the registry knows
 * @returns Registry over the entries
 */
function createRegistry(entries: ISchemaEntry[]): ISchemaRegistry {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));

  return { get: (id: string) => byId.get(id) };
}

/**
 * Builds the schema section with the formatter map of a case.
 * @param formatters Formatter plugin id by the `$id` of the schema
 * @returns Full application config of the case
 */
function createConfig(formatters: Record<string, string>): IAppConfig {
  const plugins = APP_CONFIG_DEFAULT.plugins as Record<UPluginTypes, unknown>;

  return {
    ...APP_CONFIG_DEFAULT,
    plugins: plugins as IAppConfig['plugins'],
    schemas: { sources: [], formatters },
  };
}

/**
 * Renders the result of a definition as the engine does, with the dependencies of the case.
 * @param options Dependencies of the case
 * @returns Promise of the rendering
 */
async function renderResult(options: {
  config: IAppConfig;
  definition: IPluginCommandDefinition;
  result: ICommandResult;
  registry: ISchemaRegistry;
  formatter?: IPluginFormatter;
}): Promise<void> {
  const engine = new CliEngine();
  const dependencies = engine as unknown as {
    config: IAppConfig;
    schemaRegistry: ISchemaRegistry;
    formatterManager: IPluginManager<IPluginFormatter>;
  };

  dependencies.config = options.config;
  dependencies.schemaRegistry = options.registry;
  dependencies.formatterManager = {
    getDefinition: async () => {
      throw new Error('not used by the rendering path');
    },
    getDefinitions: async () => [],
    getInstance: async () => {
      if (options.formatter === undefined) {
        throw new Error('no formatter of the case');
      }

      return options.formatter;
    },
  };

  const renderer = engine as unknown as {
    formatCommandResult(definition: IPluginCommandDefinition, result: ICommandResult): Promise<void>;
  };

  await renderer.formatCommandResult(options.definition, options.result);
}

/**
 * Builds a formatter double that records the data it was asked to render.
 * @param output Text the formatter writes for any data
 * @param calls Recorded input data
 * @returns Formatter plugin double
 */
function createFormatter(output: string, calls: unknown[]): IPluginFormatter {
  const definition: IPluginFormatterDefinition = {
    type: PLUGIN_FORMATTER_TYPE,
    id: 'table',
    label: 'Table',
  };

  return {
    id: definition.id,
    label: definition.label,
    type: definition.type,
    definition,
    format: async (data: unknown) => {
      calls.push(data);
      return output;
    },
  };
}

const TABLE_DATA: ITableData = { headers: ['id'], rows: [['task-list']] };

/** Schema entry that accepts any document. */
const PASSING_ENTRY: ISchemaEntry = { id: 'task-list', path: '/schemas/task-list.schema.yml', validate: () => null };

describe('CliEngine.formatCommandResult', () => {
  const streams: IOutputStreams = { stdout: [], stderr: [] };

  beforeEach(() => {
    streams.stdout = [];
    streams.stderr = [];

    jest.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
      streams.stdout.push([String(chunk)]);
      return true;
    });
    jest.spyOn(process.stderr, 'write').mockImplementation((chunk: string | Uint8Array) => {
      streams.stderr.push([String(chunk)]);
      return true;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('prints the data rendered by the formatter the schema map points at', async () => {
    const calls: unknown[] = [];

    await renderResult({
      config: createConfig({ 'task-list': 'table' }),
      definition: createDefinition('task-list'),
      result: { success: true, data: TABLE_DATA },
      registry: createRegistry([PASSING_ENTRY]),
      formatter: createFormatter('id\ntask-list', calls),
    });

    expect(calls).toEqual([TABLE_DATA]);
    expect(streams.stdout).toEqual([['id\ntask-list\n']]);
    expect(streams.stderr).toEqual([]);
  });

  it('keeps the newline the formatter already wrote', async () => {
    await renderResult({
      config: createConfig({ 'task-list': 'table' }),
      definition: createDefinition('task-list'),
      result: { success: true, data: TABLE_DATA },
      registry: createRegistry([PASSING_ENTRY]),
      formatter: createFormatter('id\ntask-list\n', []),
    });

    expect(streams.stdout).toEqual([['id\ntask-list\n']]);
  });

  it('prints nothing for an empty rendering', async () => {
    await renderResult({
      config: createConfig({ 'task-list': 'table' }),
      definition: createDefinition('task-list'),
      result: { success: true, data: TABLE_DATA },
      registry: createRegistry([PASSING_ENTRY]),
      formatter: createFormatter('', []),
    });

    expect(streams.stdout).toEqual([]);
  });

  it('reports the violations of data that does not match the schema instead of rendering it', async () => {
    const calls: unknown[] = [];
    const violations: ISchemaViolation[] = [{ instancePath: '/headers', message: 'must be array' }];
    const entry: ISchemaEntry = { ...PASSING_ENTRY, validate: () => violations };

    await renderResult({
      config: createConfig({ 'task-list': 'table' }),
      definition: createDefinition('task-list'),
      result: { success: true, data: { headers: 'id', rows: [] } },
      registry: createRegistry([entry]),
      formatter: createFormatter('never', calls),
    });

    expect(calls).toEqual([]);
    expect(streams.stdout).toEqual([]);
    expect(streams.stderr).toEqual([
      ["Command 'task_list': data does not match schema 'task-list' at '/headers': must be array.\n"],
    ]);
  });

  it('points at the document itself when a violation carries no instance path', async () => {
    const entry: ISchemaEntry = {
      ...PASSING_ENTRY,
      validate: () => [{ instancePath: '', message: 'must be object' }],
    };

    await renderResult({
      config: createConfig({ 'task-list': 'table' }),
      definition: createDefinition('task-list'),
      result: { success: true, data: 'text' },
      registry: createRegistry([entry]),
      formatter: createFormatter('never', []),
    });

    expect(streams.stderr).toEqual([
      ["Command 'task_list': data does not match schema 'task-list' at '/': must be object.\n"],
    ]);
  });

  it('leaves a command without a data schema to print its own output', async () => {
    const calls: unknown[] = [];

    await renderResult({
      config: createConfig({}),
      definition: createDefinition(),
      result: { success: true, data: TABLE_DATA },
      registry: createRegistry([]),
      formatter: createFormatter('never', calls),
    });

    expect(calls).toEqual([]);
    expect(streams.stdout).toEqual([]);
    expect(streams.stderr).toEqual([]);
  });

  it('writes the reasons of a failed result and renders nothing', async () => {
    await renderResult({
      config: createConfig({ 'task-list': 'table' }),
      definition: createDefinition('task-list'),
      result: { success: false, error: ['first reason', 'second reason'] },
      registry: createRegistry([PASSING_ENTRY]),
      formatter: createFormatter('never', []),
    });

    expect(streams.stderr).toEqual([['first reason\n'], ['second reason\n']]);
    expect(streams.stdout).toEqual([]);
  });

  it('fails a command whose data schema is not registered', async () => {
    const rendering = renderResult({
      config: createConfig({ absent: 'table' }),
      definition: createDefinition('absent'),
      result: { success: true, data: TABLE_DATA },
      registry: createRegistry([]),
      formatter: createFormatter('table', []),
    });

    await expect(rendering).rejects.toThrow("Command 'task_list': data schema 'absent' is not registered.");
  });

  it('fails a command whose schema has no formatter in the map', async () => {
    const rendering = renderResult({
      config: createConfig({}),
      definition: createDefinition('task-list'),
      result: { success: true, data: TABLE_DATA },
      registry: createRegistry([PASSING_ENTRY]),
      formatter: createFormatter('table', []),
    });

    await expect(rendering).rejects.toThrow(
      'Command \'task_list\': data schema \'task-list\' has no formatter in "schemas.formatters".',
    );
  });

  it('fails with the formatter reason when the formatter rejects the data', async () => {
    const definition: IPluginFormatterDefinition = { type: PLUGIN_FORMATTER_TYPE, id: 'table', label: 'Table' };
    const failing: IPluginFormatter = {
      id: definition.id,
      label: definition.label,
      type: definition.type,
      definition,
      format: async () => {
        throw new Error('cell too long');
      },
    };

    const rendering = renderResult({
      config: createConfig({ 'task-list': 'table' }),
      definition: createDefinition('task-list'),
      result: { success: true, data: TABLE_DATA },
      registry: createRegistry([PASSING_ENTRY]),
      formatter: failing,
    });

    await expect(rendering).rejects.toThrow("Command 'task_list': formatter 'table' failed: cell too long");
  });
});
