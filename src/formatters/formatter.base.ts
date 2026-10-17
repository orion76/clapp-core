import { NodePluginBase } from '@orion76/node-plugin';

import type { IPluginFormatter, IPluginFormatterDefinition } from '@clapp/common';

/**
 * Base class of a formatter plugin. A formatter receives data and returns a
 * string; the concrete class only implements `format`.
 *
 * The class is shared by every formatter set of the core: the terminal
 * formatters of `plugins/formatters` write their string for a terminal, and the
 * MCP formatters of `plugins/mcp-formatters` write it for the protocol stream
 * of an MCP server. A host picks a set with the discovery patterns of
 * `PLUGIN_FORMATTER_TYPE`, so the sets stay free to diverge in their styling
 * while sharing the plugin contract.
 *
 * The `definition` property is delivered by property injection from
 * `NodePluginBase`: `@NodePlugin` copies the injections of the ancestors into
 * the decorated class, so a concrete formatter declares neither a constructor
 * nor `@inject(PLUGIN_DEFINITION)`.
 * @template D Input data type
 */
export abstract class PluginFormatterBase<D = unknown> extends NodePluginBase<IPluginFormatterDefinition> implements IPluginFormatter<D> {
  abstract format(data: D): Promise<string>;
}
