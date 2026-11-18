import type { McpServer, ReadResourceResult, Variables } from '@modelcontextprotocol/server';
import { ResourceTemplate } from '@modelcontextprotocol/server';

import { buildEntityData } from './entity-data';
import { buildCommandValues } from './entity-input';
import { buildResourceUri, buildResourceUriTemplate, buildResourceVariables } from './resource-uri';
import type { IMCPCommandInvoker, IMCPEntity } from './types';

/** Media type of the text a resource returns: the output of its formatter, as plain text. */
const RESOURCE_MIME_TYPE = 'text/plain';

/**
 * Registers the entities of kind `resource` on the MCP server of one connection.
 *
 * A resource is a query for information about the project or its state, so this surface
 * describes no arguments of its own: the parameters of the command travel in the URI
 * (`_concept.md` § 6.2). A command without arguments and options becomes a static resource
 * (`clapp://board/list`); a command with them becomes a URI template
 * (`clapp://npm-info{?type}`) whose parameters a client passes as the query of the URI. The
 * `read` callback answers with the text the engine renders as the single content of the
 * response and declares `text/plain` as its media type.
 *
 * Annotations. The conventions of the task record a read-only hint for the kind
 * (`entity-annotations.ts`), yet MCP describes a resource with `audience`, `priority` and
 * `lastModified` — `readOnlyHint` is a field of a tool, not of a resource, and there is no
 * place to carry it. The surface therefore passes no annotations at all: the kind of the
 * command already states that a resource only queries information, and the surface of a
 * resource is read-only by its own nature, so the hint cannot reach the client in another way.
 *
 * A read that fails — a rejected command, a missing MCP formatter, a parameter the client
 * encoded wrongly — is reported to the client as an error of the request. A resource has no
 * `isError` flag of its own, so that error is what a client sees instead of a content block;
 * it neither ends the connection nor affects the other resources.
 * @param server Server of one connection
 * @param entities Entities of kind `resource` from the registry
 * @param invoker Runner that executes a command and renders its result
 */
export function registerResources(server: McpServer, entities: IMCPEntity[], invoker: IMCPCommandInvoker): void {
  for (const entity of entities) {
    registerResource(server, entity, invoker);
  }
}

/**
 * Registers one resource: a static URI when the command takes no parameters, a URI template
 * with the names of its arguments and options otherwise.
 */
function registerResource(server: McpServer, entity: IMCPEntity, invoker: IMCPCommandInvoker): void {
  const { name, title, description } = buildEntityData(entity);
  const metadata = { title, description, mimeType: RESOURCE_MIME_TYPE };
  const variables = buildResourceVariables(entity.definition.config);

  if (variables.length === 0) {
    const uri = buildResourceUri(entity.path);

    server.registerResource(name, uri, metadata, async (requestedUri: URL): Promise<ReadResourceResult> => {
      const text = await invoker.invokeCommand(entity, buildCommandValues(entity, undefined));

      return buildReadResult(requestedUri, text);
    });

    return;
  }

  // The template carries no `list` callback: the entity of a command with parameters is the
  // entry of `resources/templates/list`, not an item of `resources/list`, because the surface
  // cannot enumerate the URIs of a parameterized resource on its own.
  const template = new ResourceTemplate(buildResourceUriTemplate(entity.path, variables), { list: undefined });

  server.registerResource(name, template, metadata, async (requestedUri: URL, uriVariables: Variables) => {
    const text = await invoker.invokeCommand(entity, buildCommandValues(entity, uriVariables));

    return buildReadResult(requestedUri, text);
  });
}

/**
 * Builds the response of a read: the text of the command result as the single content of the
 * resource, with the URI the client asked for and `text/plain` as its media type.
 */
function buildReadResult(requestedUri: URL, text: string): ReadResourceResult {
  return { contents: [{ uri: requestedUri.href, mimeType: RESOURCE_MIME_TYPE, text }] };
}
