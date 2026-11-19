import { glob } from 'node:fs/promises';

import type { ISchemaConfig } from '@clapp/common';
import { createValidator, loadSchema } from 'yaml-loader';

import type { ISchemaEntry } from './types';

/**
 * Loads the schema files of the application: the patterns of the sources are already
 * absolute, so a file is read through `loadSchema` by its path without a project root lookup
 * of its own, and the id of a schema is the `$id` the file declares.
 *
 * @param schemaConfig Schema section of the application config
 * @returns Loaded schemas, one per `$id`
 * @throws Error when a schema file has no `$id` or two files declare the same `$id`
 */
export async function loadSchemas(schemaConfig: ISchemaConfig): Promise<ISchemaEntry[]> {
  const patterns = schemaConfig.sources.flatMap((source) => source.patterns);
  const filePaths = await matchSchemaFiles(patterns);
  const entries: ISchemaEntry[] = [];
  const pathById = new Map<string, string>();

  for (const filePath of filePaths) {
    const document = await loadSchema(filePath);
    const id = readSchemaId(document);

    if (id === undefined) {
      throw new Error(`Schema file "${filePath}" has no "$id": a data schema is identified by its "$id".`);
    }

    const previousPath = pathById.get(id);

    if (previousPath !== undefined) {
      throw new Error(`Duplicate schema "$id" "${id}": declared by "${previousPath}" and "${filePath}".`);
    }

    pathById.set(id, filePath);

    const validate = createValidator(document);

    entries.push({ id, path: filePath, validate });
  }

  return entries;
}

/**
 * Matches the absolute patterns of the schema sources. A pattern that matches nothing — in
 * particular a pattern of a `project` source whose `schemas/` directory does not exist —
 * yields an empty result instead of failing the run, so an empty source never breaks the
 * application.
 *
 * @param patterns Absolute patterns of the schema files
 * @returns Sorted matched file paths
 */
async function matchSchemaFiles(patterns: string[]): Promise<string[]> {
  if (patterns.length === 0) {
    return [];
  }

  const matched: string[] = [];

  try {
    for await (const filePath of glob(patterns, { withFileTypes: false })) {
      matched.push(filePath);
    }
  } catch {
    return [];
  }

  return matched.sort();
}

/**
 * Reads the `$id` of a loaded schema document.
 * @param document Document returned by `loadSchema`
 * @returns The declared id, or `undefined` when the document declares none
 */
function readSchemaId(document: unknown): string | undefined {
  if (typeof document !== 'object' || document === null) {
    return undefined;
  }

  const { $id } = document as { $id?: unknown };

  return typeof $id === 'string' && $id.length > 0 ? $id : undefined;
}
