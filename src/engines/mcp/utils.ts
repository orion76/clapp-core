import { Implementation, McpServer } from '@modelcontextprotocol/server';

export async function createMCPServer(info: Implementation): Promise<McpServer> {
  const server = new McpServer(info);

  return Promise.resolve(server);
}
