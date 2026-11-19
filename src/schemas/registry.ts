import type { ISchemaConfig } from '@clapp/common';

import { loadSchemas } from './load-schemas';
import type { ISchemaEntry, ISchemaRegistry } from './types';

/**
 * Builds the registry over loaded schemas.
 * @param entries Schemas loaded from the configured sources
 * @returns Registry of the schemas
 */
export function createSchemaRegistry(entries: readonly ISchemaEntry[]): ISchemaRegistry {
  const schemas = new Map(entries.map((entry) => [entry.id, entry]));

  return {
    get: (id) => schemas.get(id),
  };
}

/**
 * Loads the schemas of the application and checks the formatter map against them.
 *
 * The checks run at start-up, so a broken map fails the application with a message that
 * names the section and the key, instead of leaving a command that cannot render its data
 * and a formatter that is silently never used.
 *
 * @param schemaConfig Schema section of the application config
 * @param formatterIds Ids of the formatter plugins the application loaded
 * @returns Registry of the loaded schemas
 * @throws Error when a schema file has no `$id`, two files declare the same `$id`, a key of
 * `schemas.formatters` has no schema file, or the map names a formatter that was not loaded
 */
export async function buildSchemaRegistry(
  schemaConfig: ISchemaConfig,
  formatterIds: readonly string[],
): Promise<ISchemaRegistry> {
  const entries = await loadSchemas(schemaConfig);
  const schemaIds = new Set(entries.map((entry) => entry.id));
  const loadedFormatterIds = new Set(formatterIds);

  for (const [schemaId, formatterId] of Object.entries(schemaConfig.formatters)) {
    if (!schemaIds.has(schemaId)) {
      throw new Error(`Schema "${schemaId}" of "schemas.formatters" has no schema file among the loaded sources.`);
    }

    if (!loadedFormatterIds.has(formatterId)) {
      throw new Error(
        `Schema "${schemaId}" of "schemas.formatters" maps to formatter "${formatterId}", but no formatter plugin with this id is loaded.`,
      );
    }
  }

  return createSchemaRegistry(entries);
}
