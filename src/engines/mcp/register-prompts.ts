import type { GetPromptResult, McpServer } from '@modelcontextprotocol/server';

import { buildEntityData } from './entity-data';
import { buildCommandValues } from './entity-input';
import type { IMCPCommandInvoker, IMCPEntity } from './types';

/**
 * Registers the entities of kind `prompt` on the MCP server of one connection.
 *
 * A prompt is an instruction for the model together with its arguments, and the instruction
 * of a project command is its own output rather than a text kept in the definition (decision
 * of the task, § 6.1 п. 6). The surface therefore describes the arguments of the command with
 * the generated schema and answers a `get` with one `user` message whose text the engine
 * renders from the command result: a client receives the instruction the command produced for
 * the arguments it asked with, and a command stays a command — it returns data for its
 * formatter, not a message of the protocol.
 *
 * A prompt carries no annotations, and the `get` callback of a failing command — a rejected
 * action, a missing MCP formatter — is reported to the client as an error of the request, as
 * on the resources surface: a prompt has no flag of its own for a failed result.
 * @param server Server of one connection
 * @param entities Entities of kind `prompt` from the registry
 * @param invoker Runner that executes a command and renders its result
 */
export function registerPrompts(server: McpServer, entities: IMCPEntity[], invoker: IMCPCommandInvoker): void {
  for (const entity of entities) {
    registerPrompt(server, entity, invoker);
  }
}

/**
 * Registers one prompt: its name, its metadata, the argument schema of its command and the
 * callback that runs the command through the engine and turns its result into a message.
 */
function registerPrompt(server: McpServer, entity: IMCPEntity, invoker: IMCPCommandInvoker): void {
  const { name, title, description, argumentsSchema } = buildEntityData(entity);
  const config = { title, description, argsSchema: argumentsSchema };

  server.registerPrompt(name, config, async (args: unknown): Promise<GetPromptResult> => {
    const text = await invoker.invokeCommand(entity, buildCommandValues(entity, args));

    return { messages: [{ role: 'user', content: { type: 'text', text } }] };
  });
}
