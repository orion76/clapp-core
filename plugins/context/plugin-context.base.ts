import { NodePluginBase } from '@orion76/node-plugin';

import type { IPluginContext, IPluginContextDefinition } from '@clapp/common';

/**
 * Base class for context plugins. A context contributes a value (process, cwd,
 * user home, app root) to the application context.
 * @template C Context value
 * @template A Context dependency values
 */
export abstract class PluginContextBase<C = {}, A extends unknown[] = unknown[]>
  extends NodePluginBase<IPluginContextDefinition<C>>
  implements IPluginContext<C, A>
{
  abstract getContext(...args: A): Promise<C>;
}
