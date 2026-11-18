import type { CallToolResult, McpServer } from '@modelcontextprotocol/server';

import { buildEntityData } from './entity-data';
import { buildCommandValues } from './entity-input';
import { toErrorMessage } from './error-message';
import type { IMCPCommandInvoker, IMCPEntity } from './types';

/**
 * Registers the entities of kind `tool` on the MCP server of one connection.
 *
 * A tool is an action of the project, so the surface passes the arguments of the call to the
 * pipeline of the engine and returns what the engine renders for it. The response carries the
 * text of the MCP formatter as its only content block: the MVP hands out no
 * `structuredContent` and declares no `outputSchema`, because a command describes its output
 * through the data contract of its formatter alone (`_concept.md` § 6.2). The schema of the
 * call arguments and the annotations come from the command definition — a tool is not a
 * read-only operation, and the client sees that hint before it calls one.
 *
 * A call that fails — a command that returned `success: false`, a rejected action, a formatter
 * the MCP set does not know — becomes an error result (`isError`) whose text is the reason.
 * The connection survives it: the SDK would turn a thrown error into such a result as well,
 * and the surface answers with one itself, so the text and the shape of a failure are settled
 * in a single place.
 * @param server Server of one connection
 * @param entities Entities of kind `tool` from the registry
 * @param invoker Runner that executes a command and renders its result
 */
export function registerTools(server: McpServer, entities: IMCPEntity[], invoker: IMCPCommandInvoker): void {
  for (const entity of entities) {
    registerTool(server, entity, invoker);
  }
}

/**
 * Registers one tool: its name, its metadata, the argument schema of its command and the
 * callback that runs the command through the engine.
 */
function registerTool(server: McpServer, entity: IMCPEntity, invoker: IMCPCommandInvoker): void {
  const { name, title, description, argumentsSchema, annotations } = buildEntityData(entity);

  server.registerTool(
    name,
    { title, description, inputSchema: argumentsSchema, annotations },
    async (args: unknown): Promise<CallToolResult> => {
      try {
        const text = await invoker.invokeCommand(entity, buildCommandValues(entity, args));

        return { content: [{ type: 'text', text }] };
      } catch (error) {
        return { content: [{ type: 'text', text: toErrorMessage(error) }], isError: true };
      }
    },
  );
}
