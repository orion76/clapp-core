

import { IPluginCommandDefinition, IPluginDiscoveryConfig, PLUGIN_COMMAND_TYPE } from '@clapp/common';
import { getLogger } from 'packages/core/src/logger-init';
import { CommandPluginDiscoveryBase } from '../../common/plugin-discovery/plugin-discovery.base';


const logger = getLogger('command_discovery');

/**
 * Plugin discovery for commands
 * Loads command configurations from files and converts them to plugin definitions
 */
export class CommandPluginDiscovery extends CommandPluginDiscoveryBase<IPluginCommandDefinition> {
  type = PLUGIN_COMMAND_TYPE;

  constructor(
    protected projects: string[],
    protected config: IPluginDiscoveryConfig,
  ) {
    super();
    // Don't load definitions in constructor anymore
  }

  async initialize(): Promise<void> {
    this.definitions = await this.getDefinitions();
  }
}
