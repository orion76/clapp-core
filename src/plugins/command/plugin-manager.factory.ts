


import { IPluginDiscoveryConfig } from '@clapp/common';
import { CommandPluginBuilder } from './plugin-builder';
import { CommandPluginDiscovery } from './plugin-discovery/plugin-discovery';
import { CommandPluginManager } from './plugin-manager';

export async function createPluginManager(projects: string[], config: IPluginDiscoveryConfig) {
  const pluginDiscovery = new CommandPluginDiscovery(projects, config);

  const pluginBuilder = new CommandPluginBuilder();

  return new CommandPluginManager(pluginDiscovery, pluginBuilder);
}
