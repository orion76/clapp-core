import { IPluginBuilder, IPluginDiscovery, PluginManagerBase } from '@orion76/plugin';

import { IPluginCommand, IPluginCommandDefinition, PLUGIN_COMMAND_TYPE } from '@clapp/command';

/**
 * Plugin manager for commands
 * Manages command plugins registration and lifecycle
 */
export class CommandPluginManager extends PluginManagerBase<IPluginCommand> {
  type = PLUGIN_COMMAND_TYPE;

  constructor(
    protected pluginDiscovery: IPluginDiscovery<IPluginCommandDefinition>,
    protected pluginBuilder: IPluginBuilder<IPluginCommand>
  ) {
    super();
  }
}
