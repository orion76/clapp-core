import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from '@jest/globals';

import type { ISchemaConfig } from '@clapp/common';

import { loadSchemas } from '../../src/schemas/load-schemas.js';

/** Schema of a table, written in the dialect the registry compiles. */
const TABLE_SCHEMA = [
  '$schema: https://json-schema.org/draft/2020-12/schema',
  '$id: task-list',
  'type: object',
  'required: [headers, rows]',
  'additionalProperties: false',
  'properties:',
  '  headers:',
  '    type: array',
  '    items:',
  '      type: string',
  '  rows:',
  '    type: array',
  '    items:',
  '      type: array',
  '      items:',
  '        type: string',
  '',
].join('\n');

/** Second schema, small enough to be spelled inline. */
const BRIEF_SCHEMA = '$id: brief\ntype: object\nproperties:\n  goal:\n    type: string\n';

const temporaryDirs: string[] = [];

afterAll(() => {
  for (const dir of temporaryDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

/**
 * Writes schema files into a throwaway directory and returns their absolute patterns.
 * @param files Schema files by their name inside the `schemas/` directory
 * @returns Absolute pattern that matches the written files
 */
function createSchemaSource(files: Record<string, string>): string {
  const tmpDir = join(process.cwd(), 'tmp');
  mkdirSync(tmpDir, { recursive: true });

  const root = mkdtempSync(join(tmpDir, 'load-schemas-'));
  temporaryDirs.push(root);

  const schemasDir = join(root, 'schemas');
  mkdirSync(schemasDir, { recursive: true });

  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(schemasDir, name), content);
  }

  return join(schemasDir, '**', '*.schema.yml');
}

/**
 * Builds a schema section whose single source owns the given pattern.
 * @param pattern Absolute pattern of the schema files
 * @returns Schema section of a config
 */
function configWithPattern(pattern: string): ISchemaConfig {
  return { sources: [{ type: 'path', path: '/', patterns: [pattern] }], formatters: {} };
}

describe('loadSchemas', () => {
  it('registers every matched file by the $id it declares', async () => {
    const pattern = createSchemaSource({ 'task-list.schema.yml': TABLE_SCHEMA, 'brief.schema.yml': BRIEF_SCHEMA });

    const entries = await loadSchemas(configWithPattern(pattern));

    expect(entries.map((entry) => entry.id)).toEqual(['brief', 'task-list']);
    expect(entries.every((entry) => entry.path.endsWith('.schema.yml'))).toBe(true);
  });

  it('compiles a validator that accepts data conforming to the schema', async () => {
    const pattern = createSchemaSource({ 'task-list.schema.yml': TABLE_SCHEMA });
    const entries = await loadSchemas(configWithPattern(pattern));
    const entry = entries[0];

    expect(entry.validate({ headers: ['id'], rows: [['a']] })).toBeNull();
  });

  it('reports the violations of data that does not conform', async () => {
    const pattern = createSchemaSource({ 'task-list.schema.yml': TABLE_SCHEMA });
    const entries = await loadSchemas(configWithPattern(pattern));
    const violations = entries[0].validate({ headers: 'id', rows: [] });

    expect(violations?.[0]?.instancePath).toBe('/headers');
  });

  it('reports a schema file without $id and names the file', async () => {
    const pattern = createSchemaSource({ 'broken.schema.yml': 'type: object\n' });

    await expect(loadSchemas(configWithPattern(pattern))).rejects.toThrow(/broken\.schema\.yml" has no "\$id"/);
  });

  it('reports a duplicate $id between two files and names both', async () => {
    const pattern = createSchemaSource({
      'first.schema.yml': '$id: task-list\ntype: object\n',
      'second.schema.yml': '$id: task-list\ntype: object\n',
    });

    await expect(loadSchemas(configWithPattern(pattern))).rejects.toThrow(
      /Duplicate schema "\$id" "task-list": declared by ".*first\.schema\.yml" and ".*second\.schema\.yml"/,
    );
  });

  it('yields nothing when the section declares no sources', async () => {
    await expect(loadSchemas({ sources: [], formatters: {} })).resolves.toEqual([]);
  });

  it('yields nothing when a source pattern matches no file', async () => {
    const pattern = join(process.cwd(), 'tmp', 'absent-schemas', '**', '*.schema.yml');

    await expect(loadSchemas(configWithPattern(pattern))).resolves.toEqual([]);
  });
});
