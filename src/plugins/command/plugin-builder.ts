import { IPluginCommand, IPluginCommandDefinition } from '@clapp/command';
import { PluginBuilderBase } from '@orion76/plugin';

export class CommandPluginBuilder extends PluginBuilderBase<IPluginCommand> {
  build(definition: IPluginCommandDefinition): IPluginCommand {
    const { pluginClass, id } = definition;
    if (!pluginClass) {
      throw new Error(`[Command plugin] "pluginClass" for plugin: ${id} is missing.`);
    }
    return new pluginClass(definition);
  }
}
