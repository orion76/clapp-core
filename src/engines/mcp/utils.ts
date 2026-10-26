import { IAppConfig } from '@clapp/common';
import { McpServer, type Implementation } from '@modelcontextprotocol/server';



/**
 * Builds the server info the engine reports to a client during initialization.
 *
 * An MCP server introduces itself with `name`, `version` and `description`, and all three
 * come from the application config — a project presents itself to an MCP client the same
 * way it does to the CLI. The info is the only thing the server of the MVP is created
 * from: the engine has no options of its own.
 * @param config Application config
 * @returns Server info in the shape the SDK expects
 */
export function buildServerInfo(config: IAppConfig): Implementation {
  const { name, version, description } = config;

  return { name, version, description };
}

/**
 * Creates the MCP server of one connection.
 *
 * The stdio transport asks for an instance per connection, so this is a step of a factory
 * rather than a process-wide singleton: the returned server is connected to exactly one
 * connection and is closed with it. The server is built from its info alone — the MCP
 * engine has no options — and surfaces are not registered here: the engine registers the
 * entities of its registry on the server it just built, so every connection gets its own
 * surfaces.
 * @param info Server info reported to a client
 * @returns Server ready to be connected to the transport
 */
export function createMCPServer(info: Implementation): McpServer {
  return new McpServer(info);
}
