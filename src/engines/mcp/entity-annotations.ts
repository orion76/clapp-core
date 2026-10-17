import type { ToolAnnotations } from '@modelcontextprotocol/server';

import { COMMAND_KIND_PROMPT, COMMAND_KIND_RESOURCE, COMMAND_KIND_TOOL, type UCommandKind } from '@clapp/common';

/**
 * Builds the annotations of an entity from the kind of its command.
 *
 * The conventions of the task (`_concept.md` § 6.2) tie the hint to the meaning of the
 * kind: a resource only queries information about the project and its state, so it never
 * changes anything, while a tool performs an action in the project within a workflow. A
 * prompt carries no annotations — it is an instruction for the model, not an operation on
 * the project. The SDK describes the hint for a tool only (the annotations of a resource
 * are audience, priority and lastModified), so the surface of a resource decides how the
 * hint reaches the client.
 * @param kind Kind of the command
 * @returns Annotations of the entity, or `undefined` when the kind has none
 */
export function buildEntityAnnotations(kind: UCommandKind): ToolAnnotations | undefined {
  switch (kind) {
    case COMMAND_KIND_RESOURCE:
      return { readOnlyHint: true };
    case COMMAND_KIND_TOOL:
      return { readOnlyHint: false };
    case COMMAND_KIND_PROMPT:
      return undefined;
  }
}
