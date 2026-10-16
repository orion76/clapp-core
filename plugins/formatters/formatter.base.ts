import { NodePluginBase } from '@orion76/node-plugin';

import type { IPluginFormatter, IPluginFormatterDefinition } from '@clapp/common';

/**
 * Base class of a formatter plugin. A formatter receives data and returns a
 * string ready for the terminal; the concrete class only implements `format`.
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
