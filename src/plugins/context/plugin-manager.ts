import { IPluginBuilderAsync, IPluginDiscoveryAsync, PluginManagerBaseAsync } from '@orion76/plugin';


import { PLUGIN_CONTEXT_TYPE } from './plugin';
import { IPluginContext, IPluginContextDefinition } from './types';

/**
 * Plugin manager for commands
 * Manages command plugins registration and lifecycle
 */
export class PluginManager extends PluginManagerBaseAsync<IPluginContext> {
  type = PLUGIN_CONTEXT_TYPE;

  constructor(
    protected pluginDiscovery: IPluginDiscoveryAsync<IPluginContextDefinition>,
    protected pluginBuilder: IPluginBuilderAsync<IPluginContext>
  ) {
    super();
  }
  async getDefinitions(): Promise<IPluginContextDefinition[]> {
    return this.pluginDiscovery.getDefinitions();
  }
}
