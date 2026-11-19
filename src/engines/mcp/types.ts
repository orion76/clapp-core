import type { StandardSchemaWithJSON, ToolAnnotations } from '@modelcontextprotocol/server';

import type { IPluginCommandDefinition, UCommandKind } from '@clapp/common';

/**
 * Command exposed through an MCP surface: a leaf command whose data schema the app config
 * maps to a formatter. `path` is the full path in the hierarchy (`board/list`), the name an
 * MCP client sees; `dataSchema` is never empty, because a command that cannot be rendered is
 * left out of the registry. A group node only carries the path prefix of its subcommands.
 */
export interface IMCPEntity {
  path: string;
  kind: UCommandKind;
  dataSchema: string;
  definition: IPluginCommandDefinition;
}

/**
 * Command of the project that has no MCP surface, with the reason it was left out.
 * The engine reports these commands to stderr when it initializes.
 */
export interface IMCPEntitySkip {
  path: string;
  definition: IPluginCommandDefinition;
  reason: string;
}

/**
 * Commands of the application, grouped by the MCP surface they map to. The registry
 * is built once during `initialize` and read by the surfaces the engine registers
 * for every connection.
 */
export interface IMCPEntityRegistry {
  /** Entities of kind `tool` — MCP Tools (`tools/list`, `tools/call`). */
  tools: IMCPEntity[];
  /** Entities of kind `resource` — MCP Resources (`resources/list`, `resources/read`). */
  resources: IMCPEntity[];
  /** Entities of kind `prompt` — MCP Prompts (`prompts/list`, `prompts/get`). */
  prompts: IMCPEntity[];
  /** Commands without a surface, reported to stderr during `initialize`. */
  skipped: IMCPEntitySkip[];
}

/**
 * MCP data of a command entity, generated from the definition of its command.
 *
 * The data is what a surface registers an entity with, and every field of it is derived
 * from the command definition and the path of the command in the hierarchy
 * (`_concept.md` § 6.2), so a client sees the same values whichever surface serves the
 * entity. A surface maps the fields onto its own registration shape: `argumentsSchema`
 * becomes the `inputSchema` of a tool and the `argsSchema` of a prompt, and `annotations`
 * are passed where MCP carries them.
 */
export interface IMCPEntityData {
  /** Name of the entity — the path of the command in the hierarchy (`board/list`). */
  name: string;
  /** Title of the entity — the `label` of the command definition. */
  title: string;
  /** Description — `config.description` of the definition, or its `label` as a fallback. */
  description: string;
  /** Schema of the arguments and options of the command, in the shape the SDK accepts. */
  argumentsSchema: StandardSchemaWithJSON;
  /**
   * Annotations matching the kind of the command. Only a tool receives them: a prompt has
   * none, and a resource cannot carry the read-only hint of its kind either — MCP describes a
   * resource with `audience`, `priority` and `lastModified` rather than with `readOnlyHint`
   * (see `register-resources.ts`).
   */
  annotations?: ToolAnnotations;
}

/**
 * Runner the surfaces of the engine invoke a command through.
 *
 * A surface hands the argument object of an MCP client to the runner, which runs the command
 * through the pipeline and renders the result with the formatter mapped to its data schema,
 * so every surface returns the same text and no surface knows how that text is produced.
 */
export interface IMCPCommandInvoker {
  /**
   * Runs the command of an entity and returns the text of its formatted result.
   * @param entity Entity the surface registered
   * @param input Raw command input (positional arguments and options)
   * @returns Text of the command result, rendered with the formatter mapped to the data schema
   */
  invokeCommand(entity: IMCPEntity, input: IMCPCommandInput): Promise<string>;
}

/**
 * Raw input of the engine execution pipeline.
 *
 * An MCP client passes its arguments as one object described by the JSON Schema of the
 * entity, and the command pipeline addresses values by the names a command declares, so the
 * object is the input as it is: nothing is mapped back to positions. The surface that
 * registers an entity only brings the values to the types the command declares
 * (`entity-input.ts`); the pipeline itself is the one the CLI host runs.
 */
export interface IMCPCommandInput {
  /** Values by the argument and option names the command declares. */
  values: Record<string, unknown>;
}
