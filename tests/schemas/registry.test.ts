import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from '@jest/globals';

import type { ISchemaConfig } from '@clapp/common';

import { createSchemaRegistry, buildSchemaRegistry } from '../../src/schemas/registry.js';

const TABLE_SCHEMA = [
  '$schema: https://json-schema.org/draft/2020-12/schema',
  '$id: task-list',
  'type: object',
  'required: [headers, rows]',
  'properties:',
  '  headers:',
  '    type: array',
  '  rows:',
  '    type: array',
  '',
].join('\n');

const temporaryDirs: string[] = [];

afterAll(() => {
  for (const dir of temporaryDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

/**
 * Writes one schema file into a throwaway directory.
 * @param name File name inside the `schemas/` directory
 * @param content Content of the file
 * @returns Schema section whose source matches the written file
 */
function createSchemaConfig(name: string, content: string): ISchemaConfig {
  const tmpDir = join(process.cwd(), 'tmp');
  mkdirSync(tmpDir, { recursive: true });

  const root = mkdtempSync(join(tmpDir, 'schema-registry-'));
  temporaryDirs.push(root);

  const schemasDir = join(root, 'schemas');
  mkdirSync(schemasDir, { recursive: true });
  writeFileSync(join(schemasDir, name), content);

  return { sources: [{ type: 'path', path: '/', patterns: [join(schemasDir, '**', '*.schema.yml')] }], formatters: {} };
}

describe('buildSchemaRegistry', () => {
  it('registers the loaded schemas by their $id', async () => {
    const config = createSchemaConfig('task-list.schema.yml', TABLE_SCHEMA);
    const withFormatterMap: ISchemaConfig = { ...config, formatters: { 'task-list': 'table' } };

    const registry = await buildSchemaRegistry(withFormatterMap, ['table']);

    expect(registry.get('task-list')?.id).toBe('task-list');
    expect(registry.get('absent')).toBeUndefined();
  });

  it('fails when a formatter map key has no schema file', async () => {
    const config = createSchemaConfig('task-list.schema.yml', TABLE_SCHEMA);
    const withUnknownKey: ISchemaConfig = { ...config, formatters: { 'task-list': 'table', 'skill-list': 'table' } };

    await expect(buildSchemaRegistry(withUnknownKey, ['table'])).rejects.toThrow(
      'Schema "skill-list" of "schemas.formatters" has no schema file among the loaded sources.',
    );
  });

  it('fails when the map names a formatter that no loaded plugin carries', async () => {
    const config = createSchemaConfig('task-list.schema.yml', TABLE_SCHEMA);
    const withUnknownFormatter: ISchemaConfig = { ...config, formatters: { 'task-list': 'ordered-list' } };

    await expect(buildSchemaRegistry(withUnknownFormatter, ['table'])).rejects.toThrow(
      /Schema "task-list" of "schemas.formatters" maps to formatter "ordered-list", but no formatter plugin with this id is loaded\./,
    );
  });

  it('accepts an empty section: no sources and no map', async () => {
    const registry = await buildSchemaRegistry({ sources: [], formatters: {} }, []);

    expect(registry.get('task-list')).toBeUndefined();
  });
});

describe('createSchemaRegistry', () => {
  it('looks an entry up by its id and reports the absent one as undefined', () => {
    const registry = createSchemaRegistry([
      { id: 'task-list', path: '/schemas/task-list.schema.yml', validate: () => null },
    ]);

    expect(registry.get('task-list')?.path).toBe('/schemas/task-list.schema.yml');
    expect(registry.get('brief')).toBeUndefined();
  });
});
