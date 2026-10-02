import { IPluginBuilderAsync, IPluginDiscoveryAsync, PluginManagerBaseAsync } from '@orion76/plugin';
import { IPluginCommand, PLUGIN_COMMAND_TYPE, IPluginCommandDefinition } from '@clapp/common';


/**
 * Plugin manager for commands
 * Manages command plugins registration and lifecycle
 */
export class CommandPluginManager extends PluginManagerBaseAsync<IPluginCommand> {
  type = PLUGIN_COMMAND_TYPE;

  constructor(
    protected pluginDiscovery: IPluginDiscoveryAsync<IPluginCommandDefinition>,
    protected pluginBuilder: IPluginBuilderAsync<IPluginCommand>
  ) {
    super();
  }
}
