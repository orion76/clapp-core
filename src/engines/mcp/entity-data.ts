import { buildEntityAnnotations } from './entity-annotations';
import { buildArgumentsStandardSchema } from './entity-schema';
import type { IMCPEntity, IMCPEntityData } from './types';

/**
 * Builds the MCP data of an entity from the definition of its command.
 *
 * All the data an MCP surface needs is derived from the command definition and the path
 * of the command in the hierarchy — the conventions of the task (`_concept.md` § 6.2)
 * require no metadata block of its own in the definition: the path is the name of the
 * entity, `label` is its title, `config.description` falls back to `label`, the arguments
 * and options of `config` become the argument schema, and the kind of the command selects
 * the annotations.
 *
 * The generator is pure: it neither builds the registry nor registers anything with the
 * SDK, so a surface may generate the data of an entity whenever it needs it. The surfaces
 * do that once per connection, when they register the entities of the registry.
 * @param entity Entity built by the registry
 * @returns Data of the entity in the shape the MCP surfaces register it with
 */
export function buildEntityData(entity: IMCPEntity): IMCPEntityData {
  const { path, kind, definition } = entity;
  const { label, config } = definition;

  return {
    name: path,
    title: label,
    description: config.description ?? label,
    argumentsSchema: buildArgumentsStandardSchema(config),
    annotations: buildEntityAnnotations(kind),
  };
}
