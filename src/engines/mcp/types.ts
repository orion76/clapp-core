import type { StandardSchemaWithJSON, ToolAnnotations } from '@modelcontextprotocol/server';

import type { IPluginCommandDefinition, UCommandKind } from '@clapp/common';

/**
 * Command exposed through an MCP surface.
 *
 * Only a leaf command becomes an entity: a group node is a container that carries
 * the path prefix of its subcommands and is never an entity of its own. `path` is
 * the full path of the command in the hierarchy — the `command` segments of its
 * nodes joined with `/` (`board/list`) — and is the name an MCP client sees. `formatter` is never empty,
 * because the surface renders the result of a command with its formatter, and a
 * command without one is left out of the registry.
 */
export interface IMCPEntity {
  path: string;
  kind: UCommandKind;
  formatter: string;
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
 * A surface registers the entities of its kind with callbacks that receive an argument object
 * from an MCP client. The runner is the narrow view of the engine those callbacks use: it
 * turns the object into the input of the pipeline, runs the command and renders its result
 * with the formatter the command declares. Every surface therefore returns the same text of a
 * command result, and no surface knows how that text is produced.
 */
export interface IMCPCommandInvoker {
  /**
   * Runs the command of an entity and returns the text of its formatted result.
   * @param entity Entity the surface registered
   * @param input Raw command input (positional arguments and options)
   * @returns Text of the command result, rendered with the formatter of the command
   */
  invokeCommand(entity: IMCPEntity, input: IMCPCommandInput): Promise<string>;
}

/**
 * Raw input of the engine execution pipeline.
 *
 * An MCP client passes arguments as an object described by a JSON Schema, while the
 * plugin contract takes positional arguments and options (`getArguments(args, opts)`).
 * The surface that registers an entity converts one shape into the other; the pipeline
 * receives the input in the shape the plugin contract expects.
 */
export interface IMCPCommandInput {
  /** Positional arguments in the order declared by the command. */
  args: string[];
  /** Options by name, as the command declares them. */
  opts: Record<string, unknown>;
}
