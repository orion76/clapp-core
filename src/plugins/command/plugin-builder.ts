import { IPluginCommand, IPluginCommandDefinition } from '@clapp/command';
import { PluginBuilderBaseAsync } from '@orion76/plugin';

export class CommandPluginBuilder extends PluginBuilderBaseAsync<IPluginCommand> {
  async build(definition: IPluginCommandDefinition): Promise<IPluginCommand> {
    const { pluginClass, id } = definition;
    if (!pluginClass) {
      throw new Error(`[Command plugin] "pluginClass" for plugin: ${id} is missing.`);
    }
    return new pluginClass(definition);
  }
}
